const test = require('node:test');
const assert = require('node:assert/strict');
const { generateShowSlots, runProductionCatalogueSeed } = require('../scripts/seed-production-catalogue');

const fixedNow = () => new Date('2030-01-01T00:00:00.000Z');

function createHarness(databaseName = 'imovies', duplicateCinemas = []) {
  const state = { movies: new Map(), cinemas: new Map(), shows: new Map(), operations: [], duplicateCinemas };
  const model = (name, keyFor) => ({
    findOne(filter) {
      state.operations.push([name, 'findOne']);
      const record = state[name].get(keyFor(filter));
      const query = { select() { return this; }, lean: async () => record || null };
      return query;
    },
    async updateOne(filter, update, options) {
      state.operations.push([name, 'updateOne', options]);
      const key = keyFor(filter);
      if (state[name].has(key)) return { upsertedCount: 0 };
      const document = { ...update.$setOnInsert, _id: `${name}-${state[name].size + 1}` };
      state[name].set(key, document);
      return { upsertedCount: 1 };
    },
  });
  const dependencies = {
    connectDatabase: async () => { state.operations.push(['connection', 'connect']); },
    mongoose: { connection: { db: { databaseName } } },
    Movie: model('movies', (filter) => filter.slug),
    Cinema: {
      ...model('cinemas', (filter) => `${filter.name}|${filter.city}`),
      aggregate(pipeline) {
        state.operations.push(['cinemas', 'aggregate', pipeline]);
        return { exec: async () => state.duplicateCinemas };
      },
    },
    Show: model('shows', (filter) => `${filter.cinema}|${filter.screen}|${filter.startsAt.toISOString()}`),
  };
  return { dependencies, state };
}

test('production catalogue seeder refuses any database other than imovies before model access', async () => {
  const { dependencies, state } = createHarness('test');
  await assert.rejects(runProductionCatalogueSeed({ dryRun: true }, dependencies), /database must be exactly imovies/);
  assert.deepEqual(state.operations, [['connection', 'connect']]);
});

test('dry-run reports intended inserts and existing rows without database writes', async () => {
  const { dependencies, state } = createHarness();
  const summary = await runProductionCatalogueSeed({ dryRun: true, now: fixedNow }, dependencies);
  assert.equal(summary.mode, 'dry-run');
  assert.deepEqual(summary.movies, { toInsert: 8, existing: 0 });
  assert.deepEqual(summary.cinemas, { toInsert: 2, existing: 0 });
  assert.equal(summary.shows.toInsert, 56);
  assert.equal(summary.shows.existing, 0);
  assert.equal(state.operations.some(([, operation]) => operation === 'updateOne'), false);
});

test('show slots use Asia/Kolkata dates and wall-clock times regardless of machine timezone', () => {
  const slots = generateShowSlots(fixedNow);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const localTimes = slots.map(({ startsAt }) => {
    const parts = Object.fromEntries(formatter.formatToParts(startsAt)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  });
  assert.equal(slots.length, 56);
  assert.equal(localTimes[0], '2030-01-01 10:30');
  assert.equal(localTimes[1], '2030-01-01 13:45');
  assert.equal(localTimes[4], '2030-01-01 10:30');
  assert.equal(localTimes[localTimes.length - 1], '2030-01-07 20:40');
  assert.ok(localTimes.every((value) => / (10:30|13:45|17:15|20:40)$/.test(value)));
});

test('dry-run names existing inactive movies and cinemas without activating them', async () => {
  const { dependencies, state } = createHarness();
  state.movies.set('the-last-orbit', {
    _id: 'movie-1', duration: 142, title: 'The Last Orbit', slug: 'the-last-orbit', isActive: false,
  });
  state.cinemas.set('IMovies Downtown|Bengaluru', {
    _id: 'cinema-1', name: 'IMovies Downtown', city: 'Bengaluru',
  });
  const summary = await runProductionCatalogueSeed({ dryRun: true, now: fixedNow }, dependencies);
  assert.deepEqual(summary.inactiveRecords, [
    { type: 'movie', title: 'The Last Orbit', slug: 'the-last-orbit', warning: 'Existing record is inactive and will remain inactive.' },
    { type: 'cinema', name: 'IMovies Downtown', city: 'Bengaluru', warning: 'Existing record is inactive and will remain inactive.' },
  ]);
  assert.equal(state.operations.some(([, operation]) => operation === 'updateOne'), false);
  assert.equal(state.movies.get('the-last-orbit').isActive, false);
  assert.equal(Object.hasOwn(state.cinemas.get('IMovies Downtown|Bengaluru'), 'isActive'), false);
});

test('duplicate cinemas are reported and stop the seeder before any writes', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const duplicates = [{ name: 'IMovies Downtown', city: 'Bengaluru', count: 2 }];
  const { dependencies, state } = createHarness('imovies', duplicates);
  await assert.rejects(runProductionCatalogueSeed({ dryRun: false, confirmProduction: true }, dependencies), (error) => {
    assert.equal(error.name, 'DuplicateCinemaError');
    assert.deepEqual(error.duplicates, duplicates);
    return true;
  });
  assert.ok(state.operations.some(([, operation]) => operation === 'aggregate'));
  assert.equal(state.operations.some(([, operation]) => operation === 'updateOne'), false);
});

test('upserts are idempotent and preserve existing movie, cinema, and show records', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const { dependencies, state } = createHarness();
  const first = await runProductionCatalogueSeed({ dryRun: false, confirmProduction: true, now: fixedNow }, dependencies);
  assert.equal(first.movies.toInsert, 8);
  assert.equal(first.cinemas.toInsert, 2);
  assert.equal(first.shows.toInsert, 56);

  const beforeDryRun = state.operations.filter(([, operation]) => operation === 'updateOne').length;
  const dryRun = await runProductionCatalogueSeed({ dryRun: true, now: fixedNow }, dependencies);
  assert.deepEqual(dryRun.movies, { toInsert: 0, existing: 8 });
  assert.deepEqual(dryRun.cinemas, { toInsert: 0, existing: 2 });
  assert.equal(dryRun.shows.toInsert, 0);
  assert.equal(dryRun.shows.existing, 56);
  assert.equal(state.operations.filter(([, operation]) => operation === 'updateOne').length, beforeDryRun);

  const preservedMovie = state.movies.get('the-last-orbit');
  preservedMovie.title = 'Existing Movie Title';
  preservedMovie.isActive = false;
  const preservedCinema = state.cinemas.get('IMovies Downtown|Bengaluru');
  preservedCinema.address = 'Existing Cinema Address';
  preservedCinema.isActive = false;
  const preservedShow = state.shows.values().next().value;
  preservedShow.bookedSeats = ['A1'];
  preservedShow.isActive = false;

  const second = await runProductionCatalogueSeed({ dryRun: false, confirmProduction: true, now: fixedNow }, dependencies);
  assert.deepEqual(second.movies, { toInsert: 0, existing: 8 });
  assert.deepEqual(second.cinemas, { toInsert: 0, existing: 2 });
  assert.equal(second.shows.toInsert, 0);
  assert.equal(second.shows.existing, 56);
  assert.equal(preservedMovie.title, 'Existing Movie Title');
  assert.equal(preservedMovie.isActive, false);
  assert.equal(preservedCinema.address, 'Existing Cinema Address');
  assert.equal(preservedCinema.isActive, false);
  assert.deepEqual(preservedShow.bookedSeats, ['A1']);
  assert.equal(preservedShow.isActive, false);
  assert.ok(state.operations.filter(([, operation]) => operation === 'updateOne')
    .every(([, , options]) => options.timestamps === false));
});

test('seeder never accesses or modifies users or bookings and writes require explicit production confirmation', async () => {
  const { dependencies, state } = createHarness();
  dependencies.User = { create() { throw new Error('Users must never be accessed'); } };
  dependencies.Booking = { create() { throw new Error('Bookings must never be accessed'); } };
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(runProductionCatalogueSeed({ dryRun: false }, dependencies), /confirm-production/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
  assert.equal(state.operations.some(([name]) => ['users', 'bookings'].includes(name)), false);
  assert.equal(state.operations.some(([, operation]) => operation === 'updateOne'), false);

  const previousNodeEnvForFlagCheck = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    await assert.rejects(runProductionCatalogueSeed({ dryRun: false, confirmProduction: true }, dependencies), /NODE_ENV=production/);
  } finally {
    if (previousNodeEnvForFlagCheck === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvForFlagCheck;
  }
});

test('already-connected mode skips reconnecting while retaining the production database guard', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const { dependencies, state } = createHarness();
  const summary = await runProductionCatalogueSeed({
    dryRun: false,
    confirmProduction: true,
    alreadyConnected: true,
    now: fixedNow,
  }, dependencies);
  assert.equal(summary.databaseName, 'imovies');
  assert.equal(state.operations.some(([name]) => name === 'connection'), false);
  assert.equal(state.operations.some(([name]) => ['users', 'bookings'].includes(name)), false);

  const wrongDatabase = createHarness('test');
  await assert.rejects(runProductionCatalogueSeed({
    dryRun: false,
    confirmProduction: true,
    alreadyConnected: true,
  }, wrongDatabase.dependencies), /database must be exactly imovies/);
  assert.deepEqual(wrongDatabase.state.operations, []);
});

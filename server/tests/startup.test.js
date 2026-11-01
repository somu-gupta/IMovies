const test = require('node:test');
const assert = require('node:assert/strict');
const { CATALOGUE_SEED_MARKER_ID, startServer } = require('../src/startup');

function createHarness({ databaseName = 'imovies', marker = null } = {}) {
  const state = { marker, markerReads: 0, markerWrites: 0, markerWriteError: null, markerAcknowledged: true, connectCalls: 0, seedCalls: [], listenCalls: 0, logs: [], warnings: [], errors: [] };
  const database = {
    databaseName,
    collection(name) {
      if (name === 'movies') return { countDocuments: async () => 0 };
      assert.equal(name, 'startupMarkers');
      return {
        async findOne(filter) {
          state.markerReads += 1;
          assert.deepEqual(filter, { _id: CATALOGUE_SEED_MARKER_ID });
          return state.marker;
        },
        async updateOne(filter, update, options) {
          state.markerWrites += 1;
          assert.deepEqual(filter, { _id: CATALOGUE_SEED_MARKER_ID });
          assert.ok(update.$set.completedAt instanceof Date);
          assert.equal(options.upsert, true);
          if (state.markerWriteError) throw state.markerWriteError;
          if (!state.marker) state.marker = { _id: filter._id };
          Object.assign(state.marker, update.$set);
          return { acknowledged: state.markerAcknowledged };
        },
      };
    },
  };
  const app = { listen() { state.listenCalls += 1; } };
  const logger = {
    log: (...args) => state.logs.push(args),
    warn: (...args) => state.warnings.push(args),
    error: (...args) => state.errors.push(args),
  };
  const seedCatalogue = async (options) => state.seedCalls.push(options);
  return {
    state,
    args: {
      app,
      connectDatabase: async () => { state.connectCalls += 1; },
      mongoose: { connection: { db: database } },
      port: 5000,
      env: { NODE_ENV: 'production', SEED_DEMO_CATALOGUE: 'true' },
      logger,
      seedCatalogue,
    },
  };
}

test('catalogue seeding is opt-in and normal startup continues without the flag', async () => {
  const { args, state } = createHarness();
  args.env.SEED_DEMO_CATALOGUE = 'false';
  await startServer(args);
  assert.equal(state.connectCalls, 1);
  assert.equal(state.seedCalls.length, 0);
  assert.equal(state.markerReads, 0);
  assert.equal(state.listenCalls, 1);
});

test('successful opt-in seed writes a persistent completion marker after seeding', async () => {
  const { args, state } = createHarness();
  await startServer(args);
  assert.deepEqual(state.seedCalls, [{ dryRun: false, confirmProduction: true, alreadyConnected: true }]);
  assert.equal(state.markerWrites, 1);
  assert.ok(state.marker.completedAt instanceof Date);
  assert.equal(state.listenCalls, 1);
});

test('a persistent completion marker prevents seeding on later server startups', async () => {
  const { args, state } = createHarness({ marker: { _id: CATALOGUE_SEED_MARKER_ID, completedAt: new Date() } });
  await startServer(args);
  await startServer(args);
  assert.equal(state.seedCalls.length, 0);
  assert.equal(state.markerReads, 2);
  assert.equal(state.markerWrites, 0);
  assert.equal(state.listenCalls, 2);
});

test('seed failures log sanitized error metadata, leave no completion marker, and allow normal startup', async () => {
  const { args, state } = createHarness();
  args.seedCatalogue = async () => { throw Object.assign(new Error('contains sensitive connection detail'), { name: 'DuplicateCinemaError', code: 'DUPLICATE' }); };
  await startServer(args);
  assert.equal(state.markerWrites, 0);
  assert.equal(state.marker, null);
  assert.equal(state.listenCalls, 1);
  assert.deepEqual(state.errors, [['Production catalogue seed failed', { name: 'DuplicateCinemaError', code: 'DUPLICATE' }]]);
  assert.equal(JSON.stringify(state.errors).includes('sensitive'), false);
});

test('marker persistence failure after successful seeding logs a sanitized warning and continues startup', async () => {
  const { args, state } = createHarness();
  state.markerWriteError = Object.assign(new Error('private connection details'), { name: 'MongoNetworkError', code: 'NETWORK' });
  await startServer(args);
  assert.equal(state.seedCalls.length, 1);
  assert.equal(state.markerWrites, 1);
  assert.equal(state.marker, null);
  assert.equal(state.listenCalls, 1);
  assert.equal(state.errors.length, 0);
  assert.deepEqual(state.warnings, [[
    'Production catalogue seed succeeded, but completion marker persistence failed; a later restart may seed again.',
    { name: 'MongoNetworkError', code: 'NETWORK' },
  ]]);
  assert.equal(JSON.stringify(state.warnings).includes('private'), false);
});

test('an unacknowledged marker write is reported as a persistence warning', async () => {
  const { args, state } = createHarness();
  state.markerAcknowledged = false;
  await startServer(args);
  assert.equal(state.seedCalls.length, 1);
  assert.equal(state.markerWrites, 1);
  assert.equal(state.listenCalls, 1);
  assert.equal(state.logs.some(([message]) => message === 'Production catalogue seed completed'), false);
  assert.equal(state.warnings[0][0], 'Production catalogue seed succeeded, but completion marker write was not acknowledged; a later restart may seed again.');
});

test('opt-in seeding refuses a database other than imovies before marker or seeder access', async () => {
  const { args, state } = createHarness({ databaseName: 'test' });
  await startServer(args);
  assert.equal(state.seedCalls.length, 0);
  assert.equal(state.markerReads, 0);
  assert.equal(state.markerWrites, 0);
  assert.equal(state.listenCalls, 1);
});

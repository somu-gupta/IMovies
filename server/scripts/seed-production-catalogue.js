const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const connectDatabase = require('../src/config/database');
const Movie = require('../src/models/Movie');
const Cinema = require('../src/models/Cinema');
const Show = require('../src/models/Show');

const movieDefinitions = [
  ['The Last Orbit', 'the-last-orbit', 'Sci-Fi', 'English', 142, 8.7, 'U/A 13+', 'On the edge of a dying star system, one pilot carries humanity’s last chance home.', 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=780&q=85'],
  ['Blue Hour', 'blue-hour', 'Drama', 'Hindi', 128, 8.2, 'U/A 13+', 'Two strangers find their way back to the people they love during one unexpected night in the city.', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=780&q=85'],
  ['Wildwood', 'wildwood', 'Adventure', 'English', 116, 7.9, 'U', 'A young cartographer enters an ancient forest where every trail remembers those who walked it before.', 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=780&q=85'],
  ['The Art of Us', 'the-art-of-us', 'Romance', 'Tamil', 134, 8.4, 'U/A 16+', 'A restless painter and a meticulous restorer discover that some things are more beautiful unfinished.', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=780&q=85'],
  ['Redline', 'redline', 'Action', 'English', 109, 7.6, 'A', 'One final race. One impossible city. A driver with nothing left to lose.', 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=780&q=85'],
  ['Monsoon Notes', 'monsoon-notes', 'Drama', 'Malayalam', 121, 8.1, 'U', 'A daughter returns to the coast and finds letters that change everything she knew about home.', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=780&q=85'],
  ['Little Giants', 'little-giants', 'Family', 'Hindi', 98, 7.8, 'U', 'A spirited neighbourhood team gets one summer to prove the smallest players can dream biggest.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=780&q=85'],
  ['Afterimage', 'afterimage', 'Thriller', 'Telugu', 132, 8.0, 'U/A 16+', 'A crime photographer sees details in her images that were never there when she took them.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=780&q=85'],
];

const cinemaDefinitions = [
  { name: 'IMovies Downtown', city: 'Bengaluru', address: '12 Theatre Road, Central District', screens: [{ name: 'Screen 1', capacity: 60 }, { name: 'Screen 2', capacity: 60 }] },
  { name: 'IMovies Lakeside', city: 'Bengaluru', address: '8 Lakeview Avenue, North Quarter', screens: [{ name: 'Screen 1', capacity: 60 }, { name: 'Screen 2', capacity: 60 }] },
];

const times = [[10, 30], [13, 45], [17, 15], [20, 40]];
const SHOW_TIME_ZONE = 'Asia/Kolkata';
const dependencies = { mongoose, connectDatabase, Movie, Cinema, Show };

function parseArgs(args) {
  const allowed = new Set(['--dry-run', '--confirm-production']);
  if (args.some((arg) => !allowed.has(arg)) || new Set(args).size !== args.length) {
    throw new Error('Use --dry-run or --confirm-production');
  }
  if (args.includes('--dry-run') && args.includes('--confirm-production')) {
    throw new Error('Choose either --dry-run or --confirm-production');
  }
  return { dryRun: !args.includes('--confirm-production'), confirmProduction: args.includes('--confirm-production') };
}

async function findBy(model, filter, projection) {
  return model.findOne(filter).select(projection).lean();
}

async function upsertPreservingExisting(model, filter, document, dryRun, projection) {
  const existing = await findBy(model, filter, projection);
  if (existing) return { record: existing, inserted: false };
  if (dryRun) return { record: null, inserted: true };

  const timestamp = new Date();
  const result = await model.updateOne(filter, {
    $setOnInsert: { ...document, createdAt: timestamp, updatedAt: timestamp },
  }, {
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
    timestamps: false,
  });
  return {
    record: await findBy(model, filter, projection),
    inserted: result.upsertedCount === 1,
  };
}

function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

function zonedDateTimeToUtc(year, month, day, hour, minute, timeZone) {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = getZonedDateParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, 0);
    const adjustment = targetAsUtc - representedAsUtc;
    candidate += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(candidate);
}

function generateShowSlots(now = () => new Date()) {
  const startedAt = now();
  const localToday = getZonedDateParts(startedAt, SHOW_TIME_ZONE);
  const calendarDate = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day));
  const slots = [];

  for (let day = 0; day < 7; day += 1) {
    const date = new Date(calendarDate);
    date.setUTCDate(date.getUTCDate() + day);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const dayOfMonth = date.getUTCDate();
    for (let cinemaIndex = 0; cinemaIndex < cinemaDefinitions.length; cinemaIndex += 1) {
      for (let slot = 0; slot < times.length; slot += 1) {
        const startsAt = zonedDateTimeToUtc(year, month, dayOfMonth, times[slot][0], times[slot][1], SHOW_TIME_ZONE);
        if (startsAt <= startedAt) continue;
        slots.push({ day, cinemaIndex, slot, startsAt });
      }
    }
  }
  return slots;
}

async function findDuplicateCinemas(Cinema) {
  return Cinema.aggregate([
    { $group: { _id: { name: '$name', city: '$city' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $project: { _id: 0, name: '$_id.name', city: '$_id.city', count: 1 } },
  ]).exec();
}

class DuplicateCinemaError extends Error {
  constructor(duplicates) {
    super('Duplicate cinemas with the same name and city were found');
    this.name = 'DuplicateCinemaError';
    this.duplicates = duplicates;
  }
}

function inactiveWarning(kind, record) {
  if (record.isActive === true) return null;
  if (kind === 'movie') {
    return { type: 'movie', title: record.title, slug: record.slug, warning: 'Existing record is inactive and will remain inactive.' };
  }
  return { type: 'cinema', name: record.name, city: record.city, warning: 'Existing record is inactive and will remain inactive.' };
}

async function runProductionCatalogueSeed(options = {}, injected = dependencies) {
  const dryRun = options.dryRun !== false;
  if (!dryRun && (!options.confirmProduction || process.env.NODE_ENV !== 'production')) {
    throw new Error('Writes require NODE_ENV=production and --confirm-production');
  }

  if (!options.alreadyConnected) {
    const originalLog = console.log;
    console.log = () => {};
    try {
      await injected.connectDatabase();
    } finally {
      console.log = originalLog;
    }
  }

  const database = injected.mongoose.connection.db;
  if (!database || database.databaseName !== 'imovies') {
    throw new Error('Connected database must be exactly imovies');
  }

  const duplicateCinemas = await findDuplicateCinemas(injected.Cinema);
  if (duplicateCinemas.length) throw new DuplicateCinemaError(duplicateCinemas);

  const summary = {
    mode: dryRun ? 'dry-run' : 'write',
    databaseName: database.databaseName,
    movies: { toInsert: 0, existing: 0 },
    cinemas: { toInsert: 0, existing: 0 },
    shows: { toInsert: 0, existing: 0, slotsConsidered: 0 },
    inactiveRecords: [],
  };

  const movieRecords = [];
  for (const [title, slug, genre, language, duration, rating, certificate, description, posterUrl] of movieDefinitions) {
    const result = await upsertPreservingExisting(injected.Movie, { slug }, {
      title, slug, description, genre, language, duration, rating, certificate, posterUrl, isActive: true,
    }, dryRun, '_id duration isActive title slug');
    summary.movies[result.inserted ? 'toInsert' : 'existing'] += 1;
    movieRecords.push(result.record);
    if (dryRun && result.record) {
      const warning = inactiveWarning('movie', result.record);
      if (warning) summary.inactiveRecords.push(warning);
    }
  }

  const cinemaRecords = [];
  for (const item of cinemaDefinitions) {
    const result = await upsertPreservingExisting(injected.Cinema, { name: item.name, city: item.city }, {
      ...item,
      isActive: true,
    }, dryRun, '_id isActive name city');
    summary.cinemas[result.inserted ? 'toInsert' : 'existing'] += 1;
    cinemaRecords.push(result.record);
    if (dryRun && result.record) {
      const warning = inactiveWarning('cinema', result.record);
      if (warning) summary.inactiveRecords.push(warning);
    }
  }

  if (!dryRun && (movieRecords.some((movie) => !movie?._id) || cinemaRecords.some((cinema) => !cinema?._id))) {
    throw new Error('Required catalogue references could not be resolved');
  }

  for (const { day, cinemaIndex, slot, startsAt } of generateShowSlots(options.now)) {
    const cinema = cinemaRecords[cinemaIndex];
    const screen = slot % 2 ? 'Screen 2' : 'Screen 1';
    const filter = cinema?._id ? { cinema: cinema._id, screen, startsAt } : null;
    summary.shows.slotsConsidered += 1;

    if (dryRun) {
      const existing = filter && await findBy(injected.Show, filter, '_id');
      summary.shows[existing ? 'existing' : 'toInsert'] += 1;
      continue;
    }

    const movieIndex = (day * 2 + cinemaIndex * 3 + slot) % movieRecords.length;
    const movie = movieRecords[movieIndex];
    const endsAt = new Date(startsAt.getTime() + (movie.duration + 25) * 60000);
    const result = await upsertPreservingExisting(injected.Show, filter, {
      movie: movie._id,
      cinema: cinema._id,
      screen,
      startsAt,
      endsAt,
      ticketPrice: cinemaIndex ? 220 : 180,
      capacity: 60,
      bookedSeats: [],
      isActive: true,
    }, false, '_id');
    summary.shows[result.inserted ? 'toInsert' : 'existing'] += 1;
  }

  return summary;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (!options.dryRun && process.env.NODE_ENV !== 'production') {
    throw new Error('Write mode requires NODE_ENV=production');
  }
  const summary = await runProductionCatalogueSeed(options);
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main()
    .catch((error) => {
      if (error instanceof DuplicateCinemaError) {
        process.stderr.write(`${JSON.stringify({ error: 'duplicate_cinemas', duplicates: error.duplicates })}\n`);
      } else {
        process.stderr.write(`Production catalogue seed aborted (${error.name || 'Error'}${error.code ? `, code ${error.code}` : ''}).\n`);
      }
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { generateShowSlots, main, parseArgs, runProductionCatalogueSeed };

const runProductionCatalogueSeed = require('../scripts/seed-production-catalogue').runProductionCatalogueSeed;

const CATALOGUE_SEED_MARKER_ID = 'demo-catalogue-v1';

async function logMovieDiagnostic(database, logger) {
  try {
    const movies = database.collection('movies');
    const [totalMovies, activeMovies, inactiveOrMissingIsActive] = await Promise.all([
      movies.countDocuments({}),
      movies.countDocuments({ isActive: true }),
      movies.countDocuments({ $or: [{ isActive: false }, { isActive: { $exists: false } }] }),
    ]);
    logger.log('MongoDB startup movie diagnostic', {
      databaseName: database.databaseName,
      totalMovies,
      activeMovies,
      inactiveOrMissingIsActive,
    });
  } catch {
    // A temporary diagnostic failure must not prevent the API from starting.
  }
}

async function seedCatalogueOnce({ database, env, seedCatalogue, logger }) {
  if (env.SEED_DEMO_CATALOGUE !== 'true') return;

  try {
    if (database.databaseName !== 'imovies') throw new Error('Connected database must be exactly imovies');

    const markers = database.collection('startupMarkers');
    const marker = await markers.findOne({ _id: CATALOGUE_SEED_MARKER_ID });
    if (marker?.completedAt) {
      logger.log('Production catalogue seed already completed');
      return;
    }

    // The explicit opt-in is the production write confirmation; the seeder
    // still enforces NODE_ENV=production and its imovies database guard.
    await seedCatalogue({
      dryRun: false,
      confirmProduction: true,
      alreadyConnected: true,
    });
    let markerResult;
    try {
      markerResult = await markers.updateOne({ _id: CATALOGUE_SEED_MARKER_ID }, {
        $set: { completedAt: new Date(), task: 'production-catalogue-seed' },
      }, { upsert: true });
    } catch (error) {
      logger.warn('Production catalogue seed succeeded, but completion marker persistence failed; a later restart may seed again.', {
        name: error.name || 'Error',
        code: error.code,
      });
      return;
    }
    if (!markerResult?.acknowledged) {
      logger.warn('Production catalogue seed succeeded, but completion marker write was not acknowledged; a later restart may seed again.');
      return;
    }
    logger.log('Production catalogue seed completed');
  } catch (error) {
    logger.error('Production catalogue seed failed', {
      name: error.name || 'Error',
      code: error.code,
    });
  }
}

async function startServer({ app, connectDatabase, mongoose, port, env = process.env, logger = console, seedCatalogue = runProductionCatalogueSeed }) {
  await connectDatabase();
  const database = mongoose.connection.db;
  await logMovieDiagnostic(database, logger);
  await seedCatalogueOnce({ database, env, seedCatalogue, logger });
  app.listen(port, () => logger.log(`IMovies API listening on port ${port}`));
}

module.exports = { CATALOGUE_SEED_MARKER_ID, seedCatalogueOnce, startServer };

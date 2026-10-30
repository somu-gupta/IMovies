require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/database');
const mongoose = require('mongoose');

const port = Number(process.env.PORT) || 5000;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
connectDatabase().then(async () => {
  try {
    const database = mongoose.connection.db;
    const movies = database.collection('movies');
    const [totalMovies, activeMovies, inactiveOrMissingIsActive] = await Promise.all([
      movies.countDocuments({}),
      movies.countDocuments({ isActive: true }),
      movies.countDocuments({ $or: [{ isActive: false }, { isActive: { $exists: false } }] }),
    ]);
    console.log('MongoDB startup movie diagnostic', {
      databaseName: database.databaseName,
      totalMovies,
      activeMovies,
      inactiveOrMissingIsActive,
    });
  } catch {
    // A temporary diagnostic failure must not prevent the API from starting.
  }

  app.listen(port, () => console.log(`IMovies API listening on port ${port}`));
}).catch((error) => {
  console.error('Could not start IMovies API', { name: error.name, code: error.code });
  process.exitCode = 1;
});

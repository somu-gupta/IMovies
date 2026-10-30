const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

function hasValidDiagnosticToken(req, expectedToken) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) return false;

  const suppliedDigest = crypto.createHash('sha256').update(match[1]).digest();
  const expectedDigest = crypto.createHash('sha256').update(expectedToken).digest();
  return crypto.timingSafeEqual(suppliedDigest, expectedDigest);
}

router.get('/movies', async (req, res) => {
  const expectedToken = process.env.MOVIE_DIAGNOSTIC_TOKEN;
  if (!expectedToken || expectedToken.length < 32 || !hasValidDiagnosticToken(req, expectedToken)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.set('Cache-Control', 'no-store');
  res.set('Vary', 'Authorization');

  try {
    const database = mongoose.connection.db;
    if (!database) return res.status(503).json({ error: 'Database unavailable' });

    const movies = database.collection('movies');
    const [totalMovies, activeMovies, inactiveOrMissingIsActive] = await Promise.all([
      movies.countDocuments({}),
      movies.countDocuments({ isActive: true }),
      movies.countDocuments({ $or: [{ isActive: false }, { isActive: { $exists: false } }] }),
    ]);

    return res.json({
      databaseName: database.databaseName,
      totalMovies,
      activeMovies,
      inactiveOrMissingIsActive,
    });
  } catch {
    return res.status(503).json({ error: 'Diagnostic unavailable' });
  }
});

module.exports = router;

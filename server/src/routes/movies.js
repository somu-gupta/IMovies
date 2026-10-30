const express = require('express');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.get('/', async (req, res) => {
  const filter = { isActive: true };
  if (req.query.genre) filter.genre = req.query.genre;
  if (req.query.language) filter.language = req.query.language;
  if (req.query.search) filter.title = { $regex: String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const movies = await Movie.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return res.json({ success: true, data: { movies } });
});
router.get('/:id', async (req, res) => {
  const movie = await Movie.findOne({ $or: [{ slug: req.params.id }, ...( /^[a-f\d]{24}$/i.test(req.params.id) ? [{ _id: req.params.id }] : [])], isActive: true });
  if (!movie) return res.status(404).json({ success: false, error: { message: 'Movie not found' } });
  const shows = await Show.find({ movie: movie._id, isActive: true, startsAt: { $gte: new Date() } }).populate('cinema', 'name city address').sort({ startsAt: 1 }).limit(100).lean();
  return res.json({ success: true, data: { movie, shows } });
});
router.post('/', authenticate, adminOnly, async (req, res) => {
  const body = req.body || {};
  if (!body.title || !body.slug || !body.description || !body.genre || !body.language || !Number.isFinite(Number(body.duration))) return res.status(400).json({ success: false, error: { message: 'Title, slug, description, genre, language and duration are required' } });
  const movie = await Movie.create({ ...body, posterUrl: body.posterUrl || '' });
  return res.status(201).json({ success: true, data: { movie } });
});
router.patch('/:id', authenticate, adminOnly, async (req, res) => {
  if (req.body?.isActive === false && await Show.exists({ movie: req.params.id, startsAt: { $gte: new Date() } })) return res.status(409).json({ success: false, error: { message: 'Deactivate or reschedule future shows before removing this movie from the catalogue.' } });
  const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
  if (!movie) return res.status(404).json({ success: false, error: { message: 'Movie not found' } });
  return res.json({ success: true, data: { movie } });
});
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  if (await Show.exists({ movie: req.params.id })) return res.status(409).json({ success: false, error: { message: 'This movie has show records. Deactivate it instead of deleting it.' } });
  const movie = await Movie.findByIdAndDelete(req.params.id);
  if (!movie) return res.status(404).json({ success: false, error: { message: 'Movie not found' } });
  return res.json({ success: true, data: { deleted: true } });
});
module.exports = router;

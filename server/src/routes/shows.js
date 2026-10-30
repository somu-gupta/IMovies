const express = require('express');
const Show = require('../models/Show');
const Cinema = require('../models/Cinema');
const Movie = require('../models/Movie');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.get('/', async (req, res) => {
  const filter = { isActive: true, startsAt: { $gte: new Date() } };
  if (req.query.movie) filter.movie = req.query.movie;
  if (req.query.date) {
    const date = new Date(req.query.date);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ success: false, error: { message: 'Invalid date' } });
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    filter.startsAt = { $gte: start, $lt: end };
  }
  if (req.query.cinema) filter.cinema = req.query.cinema;
  const shows = await Show.find(filter).populate('cinema', 'name city address').populate('movie', 'title slug').sort({ startsAt: 1 }).limit(200).lean();
  return res.json({ success: true, data: { shows } });
});
async function getAvailability(req, res) {
  const show = await Show.findOne({ _id: req.params.id, isActive: true }).select('capacity bookedSeats ticketPrice startsAt').lean();
  if (!show) return res.status(404).json({ success: false, error: { message: 'Show not found' } });
  return res.json({ success: true, data: { capacity: show.capacity, bookedSeats: show.bookedSeats, available: show.capacity - show.bookedSeats.length, ticketPrice: show.ticketPrice, startsAt: show.startsAt } });
}
router.get('/:id/availability', getAvailability);
router.get('/:id/seats', getAvailability);
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { movie, cinema, screen, startsAt, endsAt, ticketPrice } = req.body || {};
  const cinemaDoc = await Cinema.findById(cinema); const movieDoc = await Movie.findById(movie);
  if (!movieDoc || !cinemaDoc || !cinemaDoc.isActive) return res.status(400).json({ success: false, error: { message: 'Choose an active movie and cinema' } });
  const screenDoc = cinemaDoc.screens.find((item) => item.name === screen);
  const start = new Date(startsAt); const end = new Date(endsAt);
  if (!screenDoc || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start <= new Date() || !Number.isFinite(Number(ticketPrice)) || Number(ticketPrice) < 0) return res.status(400).json({ success: false, error: { message: 'Show time, screen and price are invalid' } });
  const show = await Show.create({ movie, cinema, screen, startsAt: start, endsAt: end, ticketPrice: Number(ticketPrice), capacity: screenDoc.capacity });
  return res.status(201).json({ success: true, data: { show } });
});
router.patch('/:id', authenticate, adminOnly, async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) return res.status(404).json({ success: false, error: { message: 'Show not found' } });
  const booked = show.bookedSeats.length > 0;
  if (booked && (req.body.startsAt || req.body.cinema || req.body.screen || req.body.capacity)) return res.status(409).json({ success: false, error: { message: 'Time, cinema, screen and capacity are locked after seats are booked' } });
  if (req.body.ticketPrice !== undefined) show.ticketPrice = Number(req.body.ticketPrice);
  if (req.body.isActive !== undefined) show.isActive = Boolean(req.body.isActive);
  await show.save();
  return res.json({ success: true, data: { show } });
});
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) return res.status(404).json({ success: false, error: { message: 'Show not found' } });
  if (show.bookedSeats.length) return res.status(409).json({ success: false, error: { message: 'Shows with booked seats cannot be deleted. Deactivate it instead.' } });
  await show.deleteOne();
  return res.json({ success: true, data: { deleted: true } });
});
module.exports = router;

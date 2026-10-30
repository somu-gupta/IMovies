const express = require('express');
const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
const unavailable = () => Object.assign(new Error('One or more selected seats are unavailable'), { status: 409 });

async function createWithTransaction(userId, showId, seats) {
  const session = await mongoose.startSession();
  let booking;
  try {
    await session.withTransaction(async () => {
      const show = await Show.findOneAndUpdate({ _id: showId, isActive: true, startsAt: { $gt: new Date() }, bookedSeats: { $nin: seats }, $expr: { $lte: [{ $add: [{ $size: '$bookedSeats' }, seats.length] }, '$capacity'] } }, { $addToSet: { bookedSeats: { $each: seats } } }, { returnDocument: 'after', session }).populate('movie').populate('cinema');
      if (!show) throw unavailable();
      if (show.bookedSeats.length > show.capacity) throw unavailable();
      [booking] = await Booking.create([{ reference: randomBytes(6).toString('hex').toUpperCase(), user: userId, show: show._id, movie: show.movie._id, cinema: show.cinema._id, seats, totalAmount: show.ticketPrice * seats.length }], { session });
    });
    return booking;
  } finally {
    await session.endSession();
  }
}

function supportsTransactions(error) {
  return error?.code === 20 || error?.code === 303 || /replica set|transaction numbers|mongos/i.test(error?.message || '');
}

async function createWithAtomicFallback(userId, showId, seats) {
  const show = await Show.findOneAndUpdate({ _id: showId, isActive: true, startsAt: { $gt: new Date() }, bookedSeats: { $nin: seats }, $expr: { $lte: [{ $add: [{ $size: '$bookedSeats' }, seats.length] }, '$capacity'] } }, { $addToSet: { bookedSeats: { $each: seats } } }, { returnDocument: 'after' }).populate('movie').populate('cinema');
  if (!show || show.bookedSeats.length > show.capacity) throw unavailable();
  try {
    return await Booking.create({ reference: randomBytes(6).toString('hex').toUpperCase(), user: userId, show: show._id, movie: show.movie._id, cinema: show.cinema._id, seats, totalAmount: show.ticketPrice * seats.length });
  } catch (error) {
    if (error.name === 'ValidationError' || error.code === 11000) await Show.updateOne({ _id: show._id }, { $pullAll: { bookedSeats: seats } });
    throw error;
  }
}

router.post('/', authenticate, async (req, res) => {
  const { showId, seats } = req.body || {};
  if (!mongoose.isValidObjectId(showId) || !Array.isArray(seats) || seats.length < 1 || seats.length > 8 || seats.some((seat) => typeof seat !== 'string' || !/^[A-Z]{1,2}\d{1,2}$/.test(seat)) || new Set(seats).size !== seats.length) {
    return res.status(400).json({ success: false, error: { message: 'Select between 1 and 8 distinct valid seats' } });
  }
  try {
    let booking;
    try { booking = await createWithTransaction(req.user.id, showId, seats); }
    catch (error) { if (!supportsTransactions(error)) throw error; booking = await createWithAtomicFallback(req.user.id, showId, seats); }
    await booking.populate('movie cinema show');
    return res.status(201).json({ success: true, data: { booking } });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ success: false, error: { message: error.message } });
    throw error;
  }
});

async function listMyBookings(req, res) {
  const bookings = await Booking.find({ user: req.user._id }).populate('movie', 'title slug posterUrl').populate({ path: 'show', select: 'startsAt endsAt screen' }).populate('cinema', 'name city address').sort({ createdAt: -1 }).lean();
  return res.json({ success: true, data: { bookings } });
}
router.get('/me', authenticate, listMyBookings);
router.get('/my', authenticate, listMyBookings);

router.get('/admin/all', authenticate, adminOnly, async (_req, res) => {
  const bookings = await Booking.find().populate('user', 'name email').populate('movie', 'title').populate('cinema', 'name').populate('show', 'startsAt screen').sort({ createdAt: -1 }).limit(500).lean();
  return res.json({ success: true, data: { bookings } });
});

router.get('/:id', authenticate, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id }).populate('movie', 'title slug posterUrl').populate('cinema', 'name city address').populate('show', 'startsAt endsAt screen');
  if (!booking) return res.status(404).json({ success: false, error: { message: 'Booking not found' } });
  return res.json({ success: true, data: { booking } });
});

router.post('/:id/cancel', authenticate, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id, status: 'confirmed' }).populate('show');
  if (!booking) return res.status(404).json({ success: false, error: { message: 'Booking not found or already cancelled' } });
  if (booking.show.startsAt.getTime() - Date.now() < 2 * 60 * 60 * 1000) return res.status(400).json({ success: false, error: { message: 'Bookings can only be cancelled at least 2 hours before showtime' } });
  const cancelled = await Booking.findOneAndUpdate(
    { _id: booking._id, user: req.user._id, status: 'confirmed' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  );
  if (!cancelled) return res.status(409).json({ success: false, error: { message: 'This booking has already been cancelled' } });
  await Show.updateOne({ _id: booking.show._id }, { $pullAll: { bookedSeats: booking.seats } });
  return res.json({ success: true, data: { booking: cancelled } });
});

module.exports = router;

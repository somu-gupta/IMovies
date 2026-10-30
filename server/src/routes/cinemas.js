const express = require('express');
const Cinema = require('../models/Cinema');
const Show = require('../models/Show');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.get('/', async (_req, res) => res.json({ success: true, data: { cinemas: await Cinema.find({ isActive: true }).sort({ city: 1, name: 1 }).lean() } }));
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { name, city, address, screens } = req.body || {};
  if (!name || !city || !address || !Array.isArray(screens) || !screens.length) return res.status(400).json({ success: false, error: { message: 'Cinema details and at least one screen are required' } });
  return res.status(201).json({ success: true, data: { cinema: await Cinema.create({ name, city, address, screens }) } });
});
router.patch('/:id', authenticate, adminOnly, async (req, res) => {
  const cinema = await Cinema.findById(req.params.id);
  if (!cinema) return res.status(404).json({ success: false, error: { message: 'Cinema not found' } });
  if (req.body?.isActive === false && await Show.exists({ cinema: cinema._id, startsAt: { $gte: new Date() } })) return res.status(409).json({ success: false, error: { message: 'Deactivate or reschedule future shows before removing this cinema.' } });
  if (Array.isArray(req.body.screens)) {
    const shows = await Show.find({ cinema: cinema._id });
    const booked = await Show.exists({ cinema: cinema._id, bookedSeats: { $ne: [] } });
    if (booked && JSON.stringify(req.body.screens) !== JSON.stringify(cinema.screens.map(({ name, capacity }) => ({ name, capacity })))) return res.status(409).json({ success: false, error: { message: 'Screens cannot be changed while bookings exist' } });
    if (shows.length && req.body.screens.some((screen) => !cinema.screens.some((existing) => existing.name === screen.name))) return res.status(409).json({ success: false, error: { message: 'Remove or reschedule existing shows before adding screens' } });
  }
  Object.assign(cinema, req.body);
  await cinema.save();
  return res.json({ success: true, data: { cinema } });
});
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  if (await Show.exists({ cinema: req.params.id })) return res.status(409).json({ success: false, error: { message: 'This cinema has show records and cannot be deleted' } });
  const cinema = await Cinema.findByIdAndDelete(req.params.id);
  if (!cinema) return res.status(404).json({ success: false, error: { message: 'Cinema not found' } });
  return res.json({ success: true, data: { deleted: true } });
});
module.exports = router;

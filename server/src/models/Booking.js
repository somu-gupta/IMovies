const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
  movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  cinema: { type: mongoose.Schema.Types.ObjectId, ref: 'Cinema', required: true },
  seats: { type: [String], required: true, validate: { validator: (seats) => seats.length > 0 && new Set(seats).size === seats.length && seats.every((seat) => /^[A-Z]{1,2}\d{1,2}$/.test(seat)), message: 'Seats must be unique, valid and non-empty' } },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
}, { timestamps: true });

bookingSchema.index({ show: 1, seats: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('Booking', bookingSchema);

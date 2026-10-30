const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true, index: true },
  cinema: { type: mongoose.Schema.Types.ObjectId, ref: 'Cinema', required: true },
  screen: { type: String, required: true, trim: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true, validate: { validator(value) { return !this.startsAt || value > this.startsAt; }, message: 'Show end time must be after its start time' } },
  ticketPrice: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1, max: 500 },
  bookedSeats: { type: [String], default: [], validate: { validator: (seats) => new Set(seats).size === seats.length && seats.every((seat) => /^[A-Z]{1,2}\d{1,2}$/.test(seat)), message: 'Booked seats must be unique and valid' } },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

showSchema.index({ cinema: 1, screen: 1, startsAt: 1 }, { unique: true });
showSchema.index({ movie: 1, startsAt: 1, isActive: 1 });
module.exports = mongoose.model('Show', showSchema);

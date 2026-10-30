const mongoose = require('mongoose');

const cinemaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  screens: {
    type: [{ name: { type: String, required: true, trim: true, maxlength: 80 }, capacity: { type: Number, required: true, min: 1, max: 500 } }],
    validate: { validator: (screens) => screens.length > 0 && new Set(screens.map((screen) => screen.name)).size === screens.length, message: 'A cinema needs screens with unique names' },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Cinema', cinemaSchema);

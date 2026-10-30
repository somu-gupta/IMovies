const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  description: { type: String, required: true, maxlength: 2000 },
  genre: { type: String, required: true, trim: true, maxlength: 40 },
  language: { type: String, required: true, trim: true, maxlength: 40 },
  duration: { type: Number, required: true, min: 1, max: 500 },
  rating: { type: Number, min: 0, max: 10, default: 0 },
  certificate: { type: String, default: 'U/A', maxlength: 20 },
  posterUrl: { type: String, default: '', maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

movieSchema.index(
  { title: 'text', genre: 1, language: 1 },
  { default_language: 'none', language_override: 'textSearchLanguage' },
);
module.exports = mongoose.model('Movie', movieSchema);

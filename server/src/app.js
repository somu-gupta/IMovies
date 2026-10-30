const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const cinemaRoutes = require('./routes/cinemas');
const showRoutes = require('./routes/shows');
const bookingRoutes = require('./routes/bookings');

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '20kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
});

app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') console.error('Request failed', { name: err.name, code: err.code });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: { message: 'The request body must contain valid JSON' } });
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, error: { message: 'The request body is too large' } });
  if (err.code === 11000) return res.status(409).json({ success: false, error: { message: 'A record with those details already exists' } });
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ success: false, error: { message: 'The submitted data is invalid' } });
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.status ? err.message : 'An unexpected error occurred' },
  });
});

module.exports = app;

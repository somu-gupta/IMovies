const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const authRateLimit = require('../middleware/authRateLimit');

const router = express.Router();
function tokenFor(user) { return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }

router.post('/register', authRateLimit, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, error: { message: 'Enter a valid name, email and password (at least 8 characters)' } });
  }
  try {
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password });
    return res.status(201).json({ success: true, data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: { message: 'An account with that email already exists' } });
    throw error;
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) return res.status(400).json({ success: false, error: { message: 'Email and password are required' } });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(password))) return res.status(401).json({ success: false, error: { message: 'Email or password is incorrect' } });
  return res.json({ success: true, data: { user: publicUser(user), token: tokenFor(user) } });
});

router.get('/me', authenticate, (req, res) => res.json({ success: true, data: { user: publicUser(req.user) } }));

module.exports = router;

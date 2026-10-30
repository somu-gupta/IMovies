const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authenticate(req, res, next) {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, error: { message: 'Sign in to continue' } });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ success: false, error: { message: 'Account is no longer available' } });
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, error: { message: 'Your session is invalid or expired' } });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: { message: 'Administrator access required' } });
  return next();
}

module.exports = { authenticate, adminOnly };

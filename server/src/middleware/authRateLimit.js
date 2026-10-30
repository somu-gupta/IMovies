const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 12;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
}, WINDOW_MS);
cleanupTimer.unref();

function authRateLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.until < now) attempts.set(key, { count: 1, until: now + WINDOW_MS });
  else if (current.count >= LIMIT) return res.status(429).json({ success: false, error: { message: 'Too many attempts. Try again later.' } });
  else current.count += 1;
  return next();
}

module.exports = authRateLimit;

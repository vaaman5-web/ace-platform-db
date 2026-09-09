const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/database');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Auth token required' });
  try {
    const decoded = jwt.verify(header.slice(7), config.jwt.secret);
    const result = await db.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [decoded.sub]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid user' });
    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { authenticate, authorize };

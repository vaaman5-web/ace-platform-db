const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config/env');
const { authenticate } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name, degree, cgpa, primary_lang, target_track } = req.body;
    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const r = await db.query(
      'INSERT INTO users (email, password_hash, full_name, degree, cgpa, primary_lang, target_track) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, full_name, role',
      [email, hash, full_name, degree, cgpa, primary_lang, target_track]
    );
    const user = r.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch(e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }, token });
  } catch(e) { next(e); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
module.exports = router;

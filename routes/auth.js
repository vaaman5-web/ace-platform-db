const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config/env');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { sendVerificationCode } = require('../services/emailService');

const PROVIDERS = ['google', 'facebook', 'x', 'linkedin'];
const EMAIL_CODE_PROVIDERS = ['google', 'linkedin']; // verify via emailed code
const PASSWORD_PROVIDERS = ['facebook', 'x'];       // verify via username + password
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use('/login', authLimiter);
router.use('/register', authLimiter);
router.use('/oauth', authLimiter);
router.use('/phone', authLimiter);
router.use('/email-code', authLimiter);
router.use('/provider', authLimiter);

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function publicUser(u) {
  return { id: u.id, email: u.email, full_name: u.full_name, role: u.role, auth_provider: u.auth_provider, phone: u.phone, avatar_url: u.avatar_url };
}

// Manual OAuth: client app performs the provider handshake, then posts the verified profile here.
router.post('/oauth/:provider', async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Unsupported provider. Use google, facebook, x or linkedin.' });

    const { provider_id, email, full_name, avatar_url } = req.body || {};
    if (!provider_id || !String(provider_id).trim()) {
      return res.status(400).json({ error: 'provider_id from the ' + provider + ' account is required' });
    }
    if (provider !== 'x' && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ error: 'A valid email from the ' + provider + ' account is required' });
    }

    let name = (full_name && String(full_name).trim()) || (email ? String(email).split('@')[0] : provider + '_user');

    const byProvider = await db.query(
      'SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2 LIMIT 1',
      [provider, String(provider_id).trim()]
    );
    if (byProvider.rows.length) {
      const user = byProvider.rows[0];
      return res.json({ user: publicUser(user), token: signToken(user), method: provider });
    }

    if (email) {
      const byEmail = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [String(email).toLowerCase().trim()]);
      if (byEmail.rows.length) {
        const existing = byEmail.rows[0];
        return res.status(409).json({
          error: 'This ' + provider + ' account email is already registered with "' + existing.auth_provider + '" sign-in. Please use that method to log in.',
          registered_with: existing.auth_provider
        });
      }
    }

    const nameTaken = await db.query('SELECT 1 FROM users WHERE full_name = $1 AND auth_provider <> $2 LIMIT 1', [name, 'email']);
    if (nameTaken.rows.length) name = name + '-' + provider_id.slice(-4);

    const r = await db.query(
      `INSERT INTO users (email, password_hash, full_name, auth_provider, provider_id, avatar_url)
       VALUES ($1, NULL, $2, $3, $4, $5)
       RETURNING *`,
      [email ? String(email).toLowerCase().trim() : null, name, provider, String(provider_id).trim(), avatar_url || null]
    );
    const user = r.rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user), method: provider, created: true });
  } catch (e) { next(e); }
});

// Mobile: request OTP
router.post('/phone/request-otp', async (req, res, next) => {
  try {
    const phone = String((req.body || {}).phone || '').trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a valid mobile number with country code, e.g. +919876543210' });
    }

    const existing = await db.query('SELECT id, auth_provider FROM users WHERE phone = $1 LIMIT 1', [phone]);
    if (existing.rows.length && existing.rows[0].auth_provider !== 'phone') {
      return res.status(409).json({ error: 'This mobile number is already registered with "' + existing.rows[0].auth_provider + '" sign-in.', registered_with: existing.rows[0].auth_provider });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.query(
      `INSERT INTO phone_verifications (phone, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [phone, codeHash, expiresAt]
    );

    // Dev convenience: return the code so the flow can be tested without an SMS provider.
    const payload = { message: 'OTP sent to ' + phone, expires_in: 300 };
    if (config.isDev()) payload.dev_otp = code;
    res.json(payload);
  } catch (e) { next(e); }
});

// Mobile: verify OTP -> login or one-tap signup
router.post('/phone/verify-otp', async (req, res, next) => {
  try {
    const { phone: rawPhone, otp, full_name } = req.body || {};
    const phone = String(rawPhone || '').trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'Invalid mobile number' });
    if (!otp || !/^\d{6}$/.test(String(otp))) return res.status(400).json({ error: 'Enter the 6-digit OTP' });

    const r = await db.query(
      `SELECT * FROM phone_verifications
       WHERE phone = $1 AND verified = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'OTP expired. Please request a new one.' });

    const row = r.rows[0];
    if (row.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
    const ok = await bcrypt.compare(String(otp), row.code_hash);
    if (!ok) {
      await db.query('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return res.status(400).json({ error: 'Incorrect OTP' });
    }
    await db.query('UPDATE phone_verifications SET verified = TRUE WHERE id = $1', [row.id]);

    const existing = await db.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
    if (existing.rows.length) {
      const user = existing.rows[0];
      return res.json({ user: publicUser(user), token: signToken(user), method: 'phone' });
    }

    const name = (full_name && String(full_name).trim()) || 'User-' + phone.slice(-4);
    const inserted = await db.query(
      `INSERT INTO users (email, password_hash, full_name, auth_provider, phone)
       VALUES (NULL, NULL, $1, 'phone', $2) RETURNING *`,
      [name, phone]
    );
    const user = inserted.rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user), method: 'phone', created: true });
  } catch (e) { next(e); }
});

// Email + password register (kept for backward compatibility; one of the sign-up options)
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name, degree, cgpa, primary_lang, target_track } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ error: 'email, password and full_name are required' });
    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const r = await db.query(
      `INSERT INTO users (email, password_hash, full_name, degree, cgpa, primary_lang, target_track, auth_provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'email') RETURNING *`,
      [email, hash, full_name, degree, cgpa, primary_lang, target_track]
    );
    const user = r.rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user), method: 'email' });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered. Please log in instead.' });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rows.length || !r.rows[0].password_hash) {
      const provider = r.rows.length ? r.rows[0].auth_provider : null;
      if (provider && provider !== 'email') {
        return res.status(409).json({ error: 'This account uses "' + provider + '" sign-in. Please use that method.', registered_with: provider });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ user: publicUser(user), token: signToken(user), method: 'email' });
  } catch (e) { next(e); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

// Which methods exist for an identifier (email or phone) — powers the "only one type" UX
router.get('/methods', async (req, res, next) => {
  try {
    const id = String(req.query.identifier || '').trim();
    if (!id) return res.status(400).json({ error: 'identifier query param required' });
    let rows = [];
    if (/^\+?[1-9]\d{7,14}$/.test(id)) {
      rows = (await db.query('SELECT auth_provider FROM users WHERE phone = $1 LIMIT 1', [id])).rows;
    } else {
      rows = (await db.query('SELECT auth_provider FROM users WHERE email = $1 LIMIT 1', [id.toLowerCase()])).rows;
    }
    res.json({ registered_with: rows.length ? rows[0].auth_provider : null });
  } catch (e) { next(e); }
});

// ==================== Provider verification: Google / LinkedIn (email code) ====================
// Step 1: user enters email -> server emails a 6-digit code
router.post('/email-code/request', async (req, res, next) => {
  try {
    const provider = String((req.body || {}).provider || '').toLowerCase();
    if (!EMAIL_CODE_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'This flow is only for Google and LinkedIn sign-in.' });
    const email = String((req.body || {}).email || '').toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    // One-identity rule: email already registered with a different method?
    const existing = await db.query('SELECT auth_provider FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rows.length && existing.rows[0].auth_provider !== provider) {
      return res.status(409).json({
        error: 'This email is already registered with "' + existing.rows[0].auth_provider + '" sign-in. Please use that method.',
        registered_with: existing.rows[0].auth_provider
      });
    }

    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.query('INSERT INTO email_verifications (email, code_hash, expires_at) VALUES ($1, $2, $3)', [email, codeHash, expiresAt]);

    const label = provider === 'google' ? 'Google' : 'LinkedIn';
    const { devCode } = await sendVerificationCode(email, code, label);
    const payload = { message: 'Verification code sent to ' + email, expires_in: 600 };
    if (devCode) payload.dev_code = devCode; // dev only (no SMTP configured)
    res.json(payload);
  } catch (e) { next(e); }
});

// Step 2: verify code -> login or create account
router.post('/email-code/verify', async (req, res, next) => {
  try {
    const provider = String((req.body || {}).provider || '').toLowerCase();
    if (!EMAIL_CODE_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'This flow is only for Google and LinkedIn sign-in.' });
    const email = String((req.body || {}).email || '').toLowerCase().trim();
    const code = String((req.body || {}).code || '').trim();
    const fullName = String((req.body || {}).full_name || '').trim();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email.' });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit verification code.' });

    const r = await db.query(
      `SELECT * FROM email_verifications
       WHERE email = $1 AND verified = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    const row = r.rows[0];
    if (row.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    const ok = await bcrypt.compare(code, row.code_hash);
    if (!ok) {
      await db.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return res.status(400).json({ error: 'Incorrect code.' });
    }
    await db.query('UPDATE email_verifications SET verified = TRUE WHERE id = $1', [row.id]);

    // Existing user with same provider -> login
    const byEmail = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (byEmail.rows.length) {
      const user = byEmail.rows[0];
      return res.json({ user: publicUser(user), token: signToken(user), method: provider });
    }

    // New user -> create account under this provider
    let name = fullName || email.split('@')[0];
    const nameTaken = await db.query('SELECT 1 FROM users WHERE full_name = $1 AND auth_provider <> $2 LIMIT 1', [name, 'email']);
    if (nameTaken.rows.length) name = name + '-' + provider;
    const inserted = await db.query(
      `INSERT INTO users (email, password_hash, full_name, auth_provider, provider_id)
       VALUES ($1, NULL, $2, $3, $4) RETURNING *`,
      [email, name, provider, 'emailcode:' + crypto.randomUUID()]
    );
    const user = inserted.rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user), method: provider, created: true });
  } catch (e) { next(e); }
});

// ==================== Provider verification: Facebook / X (username + password) ====================
// Simulates the platform credential check: first use registers the credential, later uses verify it.
router.post('/provider/credentials', async (req, res, next) => {
  try {
    const provider = String((req.body || {}).provider || '').toLowerCase();
    if (!PASSWORD_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'This flow is only for Facebook and X sign-in.' });
    const username = String((req.body || {}).username || '').trim();
    const password = String((req.body || {}).password || '');
    const fullName = String((req.body || {}).full_name || '').trim();
    if (!username || username.length < 3) return res.status(400).json({ error: 'Enter your ' + (provider === 'x' ? 'X' : 'Facebook') + ' username (min 3 characters).' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const providerId = provider + ':' + username.toLowerCase();
    const existing = await db.query('SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2 LIMIT 1', [provider, providerId]);

    if (existing.rows.length) {
      const user = existing.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'Incorrect password for this ' + (provider === 'x' ? 'X' : 'Facebook') + ' account.' });
      return res.json({ user: publicUser(user), token: signToken(user), method: provider });
    }

    // New account: check username not already claimed on this provider by another email identity
    const duplicateUsername = await db.query(
      "SELECT 1 FROM users WHERE provider_id = $1 LIMIT 1",
      [providerId]
    );
    if (duplicateUsername.rows.length) return res.status(409).json({ error: 'That username is taken on ' + provider + '. Try signing in instead.' });

    const hash = await bcrypt.hash(password, config.bcryptRounds);
    let name = fullName || username;
    const nameTaken = await db.query('SELECT 1 FROM users WHERE full_name = $1 AND auth_provider <> $2 LIMIT 1', [name, 'email']);
    if (nameTaken.rows.length) name = name + '-' + provider;
    const inserted = await db.query(
      `INSERT INTO users (email, password_hash, full_name, auth_provider, provider_id)
       VALUES (NULL, $1, $2, $3, $4) RETURNING *`,
      [hash, name, provider, providerId]
    );
    const user = inserted.rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user), method: provider, created: true });
  } catch (e) { next(e); }
});

module.exports = router;

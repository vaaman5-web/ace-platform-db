const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const r = await db.query('SELECT * FROM companies WHERE is_active = TRUE ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
    const total = await db.query('SELECT COUNT(*) FROM companies WHERE is_active = TRUE');
    res.json({ companies: r.rows, total: parseInt(total.rows[0].count), page, limit });
  } catch(e) { next(e); }
});

router.post('/compare', async (req, res, next) => {
  try {
    const { ids } = req.body;
    const r = await db.query('SELECT * FROM companies WHERE id = ANY($1::int[])', [ids]);
    res.json({ companies: r.rows });
  } catch(e) { next(e); }
});

module.exports = router;

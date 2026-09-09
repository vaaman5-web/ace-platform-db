const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { answers } = req.body;
    const totalScore = answers.reduce((acc, a) => acc + (a.selected_option || 0), 0);
    const factor = parseFloat((0.7 + (totalScore / 15) * 0.4).toFixed(2));
    const r = await db.query(
      'INSERT INTO quiz_attempts (user_id, answers, total_score, readiness_factor) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, JSON.stringify(answers), totalScore, factor]
    );
    res.status(201).json({ quiz: r.rows[0] });
  } catch(e) { next(e); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { calculateScore } = require('../services/scoringEngine');
const { findBestMatches } = require('../services/matchingService');
const db = require('../config/database');

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { candidate_name, degree, cgpa, primary_lang, target_track, quiz_score } = req.body;
    const result = calculateScore({ cgpa: parseFloat(cgpa), primaryLang: primary_lang, targetTrack: target_track, quizScore: quiz_score });
    const matchedCompanies = await findBestMatches(result.score, target_track, 3);
    const ins = await db.query(
      `INSERT INTO analyses (user_id, candidate_name, degree, cgpa, primary_lang, target_track, match_score, readiness_tier, salary_band, verified_skills, skill_gaps, matched_companies, quiz_score, quiz_factor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.id, candidate_name, degree, cgpa, primary_lang, target_track, result.score, result.readinessTier, result.salaryBand, JSON.stringify(result.verifiedSkills), JSON.stringify(result.skillGaps), JSON.stringify(matchedCompanies), quiz_score || null, result.quizFactor]
    );
    res.status(201).json({ analysis: ins.rows[0] });
  } catch(e) { next(e); }
});

router.get('/history', authenticate, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    res.json({ analyses: r.rows });
  } catch(e) { next(e); }
});

module.exports = router;

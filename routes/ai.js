const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateQuizQuestions, generateStudyPlan } = require('../services/aiService');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

const profileRules = [
  body('candidate_name').optional().isString().trim(),
  body('degree').optional().isString().trim(),
  body('cgpa').optional().isFloat({ min: 0, max: 10 }),
  body('primary_lang').optional().isString().trim().isIn(['Java', 'Python', 'C++', 'C', 'JavaScript', 'SQL']).withMessage('Unsupported language'),
  body('target_track').optional().isString().trim()
];

router.post('/quiz', profileRules, validate, async (req, res, next) => {
  try {
    const profile = {
      candidate_name: req.body.candidate_name,
      degree: req.body.degree,
      cgpa: req.body.cgpa,
      primary_lang: req.body.primary_lang || 'Java',
      target_track: req.body.target_track
    };
    const questions = await generateQuizQuestions(profile);
    res.status(200).json({ questions });
  } catch (e) { next(e); }
});

router.post('/plan', [...profileRules, body('score').optional().isFloat({ min: 0, max: 100 }), body('weak_topics').optional().isArray(), body('strong_topics').optional().isArray()], validate, async (req, res, next) => {
  try {
    const profile = {
      candidate_name: req.body.candidate_name,
      degree: req.body.degree,
      cgpa: req.body.cgpa,
      primary_lang: req.body.primary_lang || 'Java',
      target_track: req.body.target_track
    };
    const results = {
      score: req.body.score,
      weak_topics: req.body.weak_topics || [],
      strong_topics: req.body.strong_topics || []
    };
    const plan = await generateStudyPlan(profile, results);
    res.status(200).json({ plan });
  } catch (e) { next(e); }
});

module.exports = router;
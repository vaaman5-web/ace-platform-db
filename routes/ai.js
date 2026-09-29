const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateQuizQuestions, generateStudyPlan, callLLM } = require('../services/aiService');

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

const quizHandler = async (req, res, next) => {
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
};

router.post('/quiz', profileRules, validate, quizHandler);
// Internal endpoint used by the FastAPI gateway (which strips the answer key
// and grades server-side). Kept separate from /quiz to avoid proxy loops.
router.post('/llm-quiz', profileRules, validate, quizHandler);

// Generic AI chat endpoint — powers the Career Coach & AI features everywhere.
// POST /api/ai/chat { messages: [{role, content}], system?: string, temperature?: number }
router.post('/chat', [
  body('messages').isArray({ min: 1 }).withMessage('messages array required'),
  body('messages.*.role').isIn(['user', 'assistant', 'system']).withMessage('invalid role'),
  body('messages.*.content').isString().trim().isLength({ min: 1, max: 6000 }).withMessage('invalid content'),
  body('system').optional().isString().trim().isLength({ max: 3000 }),
], validate, async (req, res, next) => {
  try {
    const { messages, system, temperature } = req.body;
    const prompt = [
      system ? `System instructions (follow strictly): ${system}` : '',
      ...messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`),
      'Assistant:'
    ].filter(Boolean).join('\n\n');
    const text = await callLLM(prompt, { temperature: typeof temperature === 'number' ? temperature : 0.5, maxTokens: 1400, jsonMode: false });
    res.status(200).json({ reply: text, model: 'llm' });
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
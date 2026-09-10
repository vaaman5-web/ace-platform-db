const config = require('../config/env');
const logger = require('../utils/logger');

function pickProvider() {
  return config.ai.provider || 'gemini';
}

async function callLLM(prompt, { temperature = 0.6, maxTokens = 6000 } = {}) {
  const provider = pickProvider();

  if (provider === 'openai') {
    if (!config.ai.openaiApiKey) throw new Error('OPENAI_API_KEY not configured');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.ai.openaiApiKey
      },
      body: JSON.stringify({
        model: config.ai.openaiModel,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: 'You are a placement-assessment engine for engineering students. You always respond with valid JSON only, no markdown fences, no commentary.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!res.ok) throw new Error('OpenAI API error: ' + res.status + ' ' + await res.text());
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (!config.ai.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + config.ai.geminiModel + ':generateContent?key=' + config.ai.geminiApiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' }
      })
    }
  );
  if (!res.ok) throw new Error('Gemini API error: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function parseJsonResponse(text) {
  const trimmed = String(text || '').trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('LLM returned non-JSON: ' + trimmed.slice(0, 300));
  }
}

const LANGUAGE_TOPICS = {
  'Java': ['Core Java syntax', 'OOP & Inheritance', 'Collections Framework', 'Exception handling', 'Multithreading', 'Streams & Lambdas'],
  'Python': ['Python syntax', 'Data structures (list/dict/set)', 'Functions & closures', 'Decorators & generators', 'OOP in Python', 'Libraries (NumPy/Pandas)'],
  'C++': ['C++ syntax', 'Pointers & memory', 'STL containers', 'OOP & templates', 'Move semantics', 'Algorithm basics'],
  'C': ['C syntax', 'Pointers & arrays', 'Memory management', 'Structures & unions', 'File I/O', 'Bit manipulation'],
  'JavaScript': ['JS syntax & ES6', 'Functions & closures', 'Objects & prototypes', 'Async/await & Promises', 'Array methods', 'DOM & events'],
  'SQL': ['SELECT & filtering', 'Joins', 'Subqueries & CTEs', 'GROUP BY & aggregates', 'Indexes & performance', 'Normalization']
};

function fallbackQuestionBank(lang) {
  const topics = LANGUAGE_TOPICS[lang] || LANGUAGE_TOPICS['Java'];
  const banks = {
    'Java': [
      { d: 'easy', t: 'Core Java syntax', q: 'What is the output of int x = 5; System.out.println(x++ + ++x);', o: ['11', '12', '13', '10'], a: 1, e: 'x++ evaluates to 5 (x becomes 6), then ++x makes x 7; 5 + 7 = 12.' },
      { d: 'easy', t: 'OOP & Inheritance', q: 'Which keyword prevents a class from being subclassed in Java?', o: ['static', 'final', 'abstract', 'private'], a: 1, e: 'final on a class stops inheritance.' },
      { d: 'medium', t: 'Collections Framework', q: 'Which collection allows duplicate keys?', o: ['HashMap', 'TreeMap', 'LinkedHashMap', 'None of these'], a: 3, e: 'All Map implementations reject duplicate keys; the question is a trick.' },
      { d: 'medium', t: 'Exception handling', q: 'Which exception is thrown when dividing an integer by zero?', o: ['IOException', 'ArithmeticException', 'NullPointerException', 'NumberFormatException'], a: 1, e: 'Integer division by zero throws ArithmeticException at runtime.' },
      { d: 'hard', t: 'Multithreading', q: 'Which keyword guarantees visibility of changes across threads (without full atomicity)?', o: ['synchronized', 'volatile', 'transient', 'static'], a: 1, e: 'volatile ensures visibility of a shared variable across threads.' },
      { d: 'hard', t: 'Streams & Lambdas', q: 'What does stream.map(x -> x * 2).reduce(0, Integer::sum) compute on [1,2,3]?', o: ['6', '12', '10', '3'], a: 1, e: 'Doubles each element and sums: 2 + 4 + 6 = 12.' }
    ],
  };
  const java = banks['Java'];
  const generic = java.map(item => ({ ...item }));
  return (banks[lang] || generic);
}

function buildQuizPrompt(profile) {
  const lang = profile.primary_lang || 'Java';
  const topics = (LANGUAGE_TOPICS[lang] || LANGUAGE_TOPICS['Java']).join(', ');
  const cgpa = parseFloat(profile.cgpa) || 7.0;
  const easy = cgpa >= 7.5 ? 3 : 4;
  const medium = cgpa >= 7.5 ? 4 : 4;
  const hard = 10 - easy - medium;
  const track = profile.target_track || 'general engineering';

  return `Generate a placement mock quiz for an engineering student.

Student profile:
- Name: ${profile.candidate_name || 'candidate'}
- Degree: ${profile.degree || 'B.Tech'}
- CGPA: ${cgpa}
- Primary programming language: ${lang}
- Target placement track: ${track}

Topic scope for ${lang}: ${topics}.

Return ONLY a JSON object with exactly this shape (no markdown):
{
  "profile": { "language": "${lang}", "adapted_skill_level": "..." },
  "questions": [
    {
      "id": 1,
      "difficulty": "easy",
      "topic": "topic name",
      "question": "full question text",
      "options": ["a", "b", "c", "d"],
      "answer": 0,
      "explanation": "short explanation"
    }
  ]
}

Rules:
- Exactly ${easy} EASY, ${medium} MEDIUM and ${hard} HARD questions (10 total).
- EASY = basic syntax/concept. MEDIUM = applied logic. HARD = problem-solving / edge cases.
- answer must be the 0-based index of the correct option.
- Questions must be answerable without running code, and must reflect real interview difficulty for ${track}.
- Include a clear explanation for every question.
`;
}

async function generateQuizQuestions(profile) {
  const lang = profile.primary_lang;
  let questions;
  try {
    const prompt = buildQuizPrompt(profile);
    const raw = await callLLM(prompt, { temperature: 0.6 });
    const parsed = parseJsonResponse(raw);
    questions = Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!questions || questions.length === 0) throw new Error('No questions generated');
  } catch (err) {
    logger.warn('LLM quiz generation failed, using fallback bank', { error: err.message });
    const bank = fallbackQuestionBank(lang);
    questions = shuffle(bank).map((item, i) => ({
      id: i + 1,
      difficulty: item.d,
      topic: item.t,
      question: item.q,
      options: item.o,
      answer: item.a,
      explanation: item.e
    }));
  }
  return questions.slice(0, 10);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPlanPrompt(profile, results) {
  const score = results.score || 0;
  const weak = Array.isArray(results.weak_topics) && results.weak_topics.length
    ? results.weak_topics.join(', ')
    : 'not specified';
  const strong = Array.isArray(results.strong_topics) && results.strong_topics.length
    ? results.strong_topics.join(', ')
    : 'not specified';
  const lang = profile.primary_lang || 'Java';

  return `Create a personalized full study plan and roadmap for an engineering student preparing for placements.

Student profile:
- Name: ${profile.candidate_name || 'candidate'}
- Degree: ${profile.degree || 'B.Tech'}
- CGPA: ${profile.cgpa || 7.0}
- Primary language: ${lang}
- Target track: ${profile.target_track || 'general engineering'}
- Mock quiz score: ${score}% (easy/medium/hard mix in ${lang})
- Weak areas: ${weak}
- Strong areas: ${strong}

Return ONLY JSON (no markdown) with exactly this shape:
{
  "plan_summary": "one paragraph summarizing the approach",
  "level": "Foundation | Accelerator | Mastery",
  "total_weeks": 6,
  "roadmap": [
    {
      "week": 1,
      "focus": "week theme",
      "days": [
        { "day": 1, "task": "specific task for today", "topic": "topic", "resource": "free online resource suggestion", "duration_minutes": 60 }
      ],
      "milestone_project": "hands-on mini project for this week",
      "assessment": "self-test to take at the end of the week"
    }
  ]
}

Rules:
- Tune duration by score: score < 40 → 6 weeks, 40-70 → 4 weeks, > 70 → 3 weeks (set total_weeks accordingly).
- Each week has 7 days with concrete daily tasks, ordered by dependency.
- Each day has one task (specific, actionable), a topic, a free resource, and a duration in minutes.
- Prioritise the weak topics while protecting the strong ones.
- The roadmap must end with a capstone project and a final self-assessment.
`;
}

async function generateStudyPlan(profile, results) {
  try {
    const prompt = buildPlanPrompt(profile, results);
    const raw = await callLLM(prompt, { temperature: 0.5 });
    const parsed = parseJsonResponse(raw);
    if (!Array.isArray(parsed.roadmap) || parsed.roadmap.length === 0) {
      throw new Error('LLM returned an invalid study plan');
    }
    return {
      plan_summary: parsed.plan_summary || 'Personalised study plan generated.',
      level: parsed.level || 'Foundation',
      total_weeks: parsed.total_weeks || parsed.roadmap.length,
      roadmap: parsed.roadmap
    };
  } catch (err) {
    logger.warn('LLM plan generation failed, using fallback plan', { error: err.message });
    return fallbackStudyPlan(profile, results);
  }
}

function fallbackStudyPlan(profile, results) {
  const score = results.score || 0;
  const lang = profile.primary_lang || 'Java';
  const weak = (results.weak_topics || []).slice(0, 2);
  const weeks = score < 40 ? 6 : score <= 70 ? 4 : 3;
  const themes = [
    ['Core ' + lang + ' syntax & OOP', 'Re-learn core syntax, data types, classes and inheritance. Solve 10 pattern problems.'],
    ['Data Structures & Algorithms', 'Arrays, strings, linked lists, stacks, queues, sorting and searching. 2-3 problems per day.'],
    ['Problem Solving Practice', 'Recursion, two-pointers, sliding window. Daily timed practice on LeetCode / GfG.'],
    ['Database & SQL', 'SELECT, WHERE, joins, GROUP BY, subqueries. Complete 20 SQL queries.'],
    ['Build a Mini Project', 'Build one mini project in ' + lang + ' applying your weak topics end-to-end.'],
    ['Mock Tests & Polish', 'Take 2 timed mocks, review explanations, refine weak topics.']
  ];
  if (weak.length) themes[0] = [weak[0] + ' deep-dive', 'Focused practice on ' + weak.join(', ') + ' with daily drills and examples.'];
  const roadmap = [];
  for (let w = 1; w <= weeks; w++) {
    const def = themes[(w - 1) % themes.length];
    const days = [];
    for (let d = 1; d <= 7; d++) {
      days.push({
        day: d,
        task: d % 3 === 0
          ? 'Solve 2-3 practice problems on ' + def[0].split('(')[0].trim()
          : (d % 2 === 0 ? 'Practice: ' + def[1].split('.')[0] + ' (2 problems)' : 'Study: ' + def[1].split('.')[0] + ' — revise notes'),
        topic: def[0].split('(')[0].trim(),
        resource: 'freeCodeCamp / GeeksforGeeks / YouTube',
        duration_minutes: d % 7 === 6 ? 90 : 60
      });
    }
    roadmap.push({
      week: w,
      focus: def[0],
      days,
      milestone_project: def[1],
      assessment: 'End-of-week 10-question self-test on ' + def[0].split('(')[0].trim() + '.'
    });
  }
  return {
    plan_summary: 'A structured, profile-verified plan prioritising ' + (weak.join(', ') || lang + ' fundamentals') + '. Mark each day complete to track your progress.',
    level: score >= 70 ? 'Mastery' : score >= 45 ? 'Accelerator' : 'Foundation',
    total_weeks: weeks,
    roadmap
  };
}

module.exports = { generateQuizQuestions, generateStudyPlan, callLLM };
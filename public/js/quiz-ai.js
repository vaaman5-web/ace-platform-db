/* ==========================================================================
   ACE — Adaptive AI Mock Quiz Engine
   - Calls the LLM backend to generate profile-verified questions
   - Scores by difficulty + topic, flags weak/strong areas
   - Generates a personalised study plan + roadmap
   - Tracks daily progress in localStorage
   ========================================================================== */
(function () {
  const QUIZ_PROGRESS_KEY = 'ace_ai_quiz_progress';
  const QUIZ_RESULT_KEY = 'ace_ai_quiz_last';
  const PAGE_SIZE = 10;
  let currentQuestions = [];
  let currentProfile = null;
  let currentQuizId = null;
  let currentPage = 0;
  let quizAnswers = {};

  /* ---------------- helpers ---------------- */
  function readProgress() {
    try {
      const raw = localStorage.getItem(QUIZ_PROGRESS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveProgress(p) {
    localStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(p));
  }
  function readLastResult() {
    try {
      const raw = localStorage.getItem(QUIZ_RESULT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function persistResult(result) {
    const prev = readProgress() || { completedDays: {}, scores: [], streak: 0, lastActive: null };
    prev.scores = prev.scores || []; prev.scores = prev.scores.concat([result]).slice(-12);
    prev.lastActive = new Date().toISOString();
    saveProgress(prev);
    localStorage.setItem(QUIZ_RESULT_KEY, JSON.stringify(result));
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function grabProfile() {
    return {
      candidate_name: (document.getElementById('studentName') || {}).value || 'Student',
      degree: (document.getElementById('degree') || {}).value || 'B.Tech',
      cgpa: (document.getElementById('cgpa') || {}).value || 7.0,
      primary_lang: (document.getElementById('primaryLang') || {}).value || 'Java',
      target_track: (document.getElementById('targetTrack') || {}).value || 'Software Development'
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function postJson(path, data) {
    const res = await fetch('/api/ai/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || ('Request failed: ' + res.status));
    return payload;
  }

  /* ---------------- modal ---------------- */
  function openModal(html) {
    const title = document.getElementById('featureModalTitle');
    const body = document.getElementById('featureModalBody');
    const modal = document.getElementById('featureModal');
    if (title && body && modal) {
      title.textContent = 'Mock Quiz — Adaptive Skills Test';
      body.innerHTML = html;
      modal.classList.add('open');
    } else {
      showFbToast && showFbToast('Quiz modal unavailable');
    }
  }
  function closeModal() {
    const modal = document.getElementById('featureModal');
    if (modal) modal.classList.remove('open');
  }
  function isQuizModalOpen() {
    const modal = document.getElementById('featureModal');
    return !!modal && modal.classList.contains('open');
  }

  /* ---------------- quiz flow ---------------- */
  function startAiQuiz() {
    startLocalQuiz();
  }

  function startLocalQuiz() {
    currentProfile = grabProfile();
    openModal(
      '<div class="quiz-note" style="text-align:center; padding: 1rem;">' +
      '<div style="font-size: 1.4rem; margin-bottom: 0.5rem;">Generating your adaptive 30-question quiz...</div>' +
      '<div>Personalising questions for <strong>' + escapeHtml(currentProfile.primary_lang) +
      '</strong> and your target track. This takes about a minute and checks the profile details you entered above.</div>' +
      '<div style="margin-top: 1rem;" class="ai-spinner"></div>' +
      '</div>'
    );

    postJson('quiz', currentProfile)
      .then(payload => {
        if (!isQuizModalOpen()) return;
        currentQuestions = payload.questions || [];
        currentQuizId = (currentQuestions[0] && currentQuestions[0].id) ? null : null;
        renderQuiz();
      })
      .catch(err => {
        if (!isQuizModalOpen()) return;
        openModal(
          '<div class="quiz-result">' +
          '<div class="quiz-question" style="color: var(--sb-danger);">Could not generate quiz</div>' +
          '<div class="quiz-note">' + escapeHtml(err.message) +
          '. Start the backend with `npm start` and make sure an AI key is set in .env.</div>' +
          '<div style="display:flex; gap:0.4rem; margin-top:0.6rem;">' +
          '<button type="button" class="btn btn-sm" id="aiQuizRetry">Try Again</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="aiQuizCancel">Close</button>' +
          '</div></div>'
        );
        const retry = document.getElementById('aiQuizRetry');
        const cancel = document.getElementById('aiQuizCancel');
        if (retry) retry.addEventListener('click', startLocalQuiz);
        if (cancel) cancel.addEventListener('click', closeModal);
      });
  }

  function difficultyBadge(d) {
    return d === 'hard'
      ? '<span style="background:#D64545; color:#fff; border-radius:4px; padding:1px 6px; font-size:0.7rem;">HARD</span>'
      : d === 'medium'
        ? '<span style="background:var(--sb-teal); color:#fff; border-radius:4px; padding:1px 6px; font-size:0.7rem;">MEDIUM</span>'
        : '<span style="background:var(--sb-success); color:#fff; border-radius:4px; padding:1px 6px; font-size:0.7rem;">EASY</span>';
  }

  function totalQuizPages() {
    return Math.max(1, Math.ceil(currentQuestions.length / PAGE_SIZE));
  }

  function renderQuiz() {
    if (!currentQuestions.length) {
      openModal('<div class="quiz-note">No questions returned. Please try again.</div>');
      return;
    }
    const lang = currentProfile.primary_lang || 'Java';
    const html =
      '<div class="quiz-note" style="border-bottom:1px solid var(--sb-border); padding-bottom:0.5rem;">' +
      '<b>Candidate:</b> ' + escapeHtml(currentProfile.candidate_name) +
      ' &middot; <b>Language under test:</b> ' + escapeHtml(lang) +
      ' &middot; <b>Track:</b> ' + escapeHtml(currentProfile.target_track || '—') +
      ' &middot; <b>' + currentQuestions.length + ' questions</b>' +
      '</div>' +
      '<div id="aiQuizPager" style="padding:0.3rem 0;"></div>' +
      '<div id="aiQuizList" style="max-height:50vh; overflow-y:auto; padding:0.2rem 0;"></div>' +
      '<div style="display:flex; justify-content:space-between; gap:0.4rem; margin-top:0.6rem;">' +
      '<button type="button" class="btn btn-sm btn-ghost" id="aiQuizRestart">Cancel</button>' +
      '<button type="button" class="btn btn-sm" id="aiQuizSubmit">Evaluate &amp; Build My Study Plan</button>' +
      '</div>';

    openModal(html);
    const list = document.getElementById('aiQuizList');
    const submit = document.getElementById('aiQuizSubmit');
    const restart = document.getElementById('aiQuizRestart');
    if (submit) submit.addEventListener('click', submitQuiz);
    if (restart) restart.addEventListener('click', closeModal);
    if (list) list.addEventListener('change', (e) => {
      if (e.target && e.target.type === 'radio') {
        const m = /^aiq(\d+)$/.exec(e.target.name || '');
        if (m) {
          quizAnswers[parseInt(m[1], 10)] = parseInt(e.target.value, 10);
          renderQuizPage();
        }
      }
    });
    renderQuizPage();
  }

  function renderQuizPage() {
    const pager = document.getElementById('aiQuizPager');
    const list = document.getElementById('aiQuizList');
    if (!list) return;
    const pages = totalQuizPages();
    const start = currentPage * PAGE_SIZE;
    const slice = currentQuestions.slice(start, start + PAGE_SIZE);

    list.innerHTML = slice.map((item, k) => {
      const i = start + k;
      const selected = quizAnswers[i];
      const badge = difficultyBadge(item.difficulty || 'easy');
      return '<div class="quiz-q">' +
        '<div class="quiz-question">Q' + (i + 1) + '. ' + escapeHtml(item.question) + ' ' + badge + '</div>' +
        (item.topic ? '<div class="quiz-note" style="margin:0 0 0.3rem 0; font-size:0.72rem; color:var(--sb-teal);">Topic: ' + escapeHtml(item.topic) + '</div>' : '') +
        (item.options || []).map((opt, j) =>
          '<label class="quiz-opt"><input type="radio" name="aiq' + i + '" value="' + j + '"' + (selected === j ? ' checked' : '') + '> ' + escapeHtml(opt) + '</label>'
        ).join('') +
        '</div>';
    }).join('');

    if (pager) {
      const first = start + 1;
      const last = Math.min(start + PAGE_SIZE, currentQuestions.length);
      const answered = slice.filter((_, k) => quizAnswers[start + k] !== undefined).length;
      const answeredColour = answered === slice.length ? 'var(--sb-success)' : 'var(--sb-warning)';
      pager.innerHTML = '<div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem; padding:0.3rem 0;">' +
        '<button type="button" class="btn btn-sm btn-ghost" id="aiQuizPrev"' + (currentPage === 0 ? ' disabled' : '') + '>&#8249; Prev</button>' +
        '<span style="font-size:0.76rem; text-align:center;">Questions <b>' + first + '&ndash;' + last + '</b> of ' + currentQuestions.length +
        ' &middot; Page ' + (currentPage + 1) + '/' + pages +
        ' &middot; <span style="color:' + answeredColour + '; font-weight:600;">' + answered + '/' + slice.length + ' answered</span></span>' +
        '<button type="button" class="btn btn-sm" id="aiQuizNext"' + (currentPage === pages - 1 ? ' disabled' : '') + '>Next &#8250;</button>' +
        '</div>';
      const prev = document.getElementById('aiQuizPrev');
      const next = document.getElementById('aiQuizNext');
      if (prev) prev.addEventListener('click', () => { if (currentPage > 0) { currentPage--; renderQuizPage(); } });
      if (next) next.addEventListener('click', () => { if (currentPage < pages - 1) { currentPage++; renderQuizPage(); } });
    }
  }

  function submitQuiz() {
    let missing = -1;
    currentQuestions.forEach((_, i) => {
      if (missing < 0 && quizAnswers[i] === undefined) missing = i;
    });
    if (missing >= 0) {
      showFbToast && showFbToast('Please answer every question before evaluating.');
      currentPage = Math.floor(missing / PAGE_SIZE);
      renderQuizPage();
      return;
    }

    const results = currentQuestions.map((item, i) => ({
        question: item.question,
        topic: item.topic || 'general',
        difficulty: item.difficulty || 'easy',
        selected: quizAnswers[i],
        correct: quizAnswers[i] === item.answer,
        explanation: item.explanation
      }));

    const total = results.length;
    const correct = results.filter(r => r.correct).length;
    const score = Math.round((correct / total) * 100);

    const byDiff = {};
    results.forEach(r => {
      const k = r.difficulty;
      byDiff[k] = byDiff[k] || { correct: 0, total: 0 };
      byDiff[k].total++; if (r.correct) byDiff[k].correct++;
    });

    const topicWrong = {};
    results.filter(r => !r.correct).forEach(r => { topicWrong[r.topic] = (topicWrong[r.topic] || 0) + 1; });
    const topicRight = {};
    results.filter(r => r.correct).forEach(r => { topicRight[r.topic] = (topicRight[r.topic] || 0) + 1; });

    const weakTopics = Object.keys(topicWrong).sort((a, b) => topicWrong[b] - topicWrong[a]).slice(0, 4);
    const strongTopics = Object.keys(topicRight).filter(t => !topicWrong[t]).slice(0, 4);

    const result = {
      date: new Date().toISOString(),
      language: currentProfile.primary_lang,
      score, correct, total,
      byDifficulty: byDiff,
      weak_topics: weakTopics,
      strong_topics: strongTopics,
      answers: results
    };
    persistResult(result);
    renderResults(result);
  }

  function difficultyBar(k, v) {
    if (!v || !v.total) return '';
    const pct = Math.round((v.correct / v.total) * 100);
    const color = pct >= 70 ? '#2E9E6B' : pct >= 45 ? '#F2B441' : '#D64545';
    return '<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">' +
      '<span style="min-width:70px; font-size:0.78rem;">' + k.toUpperCase() + '</span>' +
      '<div style="flex:1; background:var(--sb-border); border-radius:4px; height:10px;">' +
      '<div style="width:' + pct + '%; background:' + color + '; height:10px; border-radius:4px; animation:progressFill 0.6s ease;"></div>' +
      '</div>' +
      '<span style="min-width:34px; text-align:right; font-size:0.78rem;">' + pct + '%</span>' +
      '</div>';
  }

  function renderResults(result) {
    const level = result.score >= 70 ? 'Skill Mastery' : result.score >= 45 ? 'Skill Accelerator' : 'Foundation Builder';
    const html =
      '<div class="quiz-result" style="gap:0.5rem;">' +
      '<div class="quiz-question" style="font-size:1rem;">Your Score: <b>' + result.score + '%</b> (' + result.correct + '/' + result.total + ' correct)</div>' +
      '<div class="quiz-question">Banded Level: <b>' + level + '</b></div>' +
      '<div style="background:var(--sb-border); border-radius:6px; height:14px; margin:0.3rem 0;">' +
      '<div style="width:' + result.score + '%; background:' + (result.score >= 70 ? '#2E9E6B' : result.score >= 45 ? '#F2B441' : '#D64545') + '; height:14px; border-radius:6px; animation:progressFill 0.6s ease;"></div>' +
      '</div>' +
      '<div style="margin:0.4rem 0 0.2rem 0; font-weight:600; font-size:0.82rem;">Difficulty Breakdown</div>' +
      difficultyBar('Easy', result.byDifficulty.easy) +
      difficultyBar('Medium', result.byDifficulty.medium) +
      difficultyBar('Hard', result.byDifficulty.hard) +
      '</div>' +
      '<div style="display:flex; gap:0.5rem; margin:0.8rem 0; flex-wrap:wrap;">' +
      '<div style="flex:1; min-width:180px; padding:0.6rem; border:1px solid var(--sb-border); border-radius:6px;">' +
      '<b style="color:var(--sb-danger); font-size:0.8rem;">Weak Areas</b>' +
      '<div>' + (result.weak_topics.length ? result.weak_topics.map(w => '<span class="skill-tag missing">' + escapeHtml(w) + '</span>').join('') : '<span class="skill-tag">None detected</span>') + '</div>' +
      '</div>' +
      '<div style="flex:1; min-width:180px; padding:0.6rem; border:1px solid var(--sb-border); border-radius:6px;">' +
      '<b style="color:var(--sb-success); font-size:0.8rem;">Strong Areas</b>' +
      '<div>' + (result.strong_topics.length ? result.strong_topics.map(s => '<span class="skill-tag">' + escapeHtml(s) + '</span>').join('') : '<span class="skill-tag">—</span>') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="quiz-note">Verifying your profile (CGPA, track, language) and generating your personalised study plan + roadmap...</div>' +
      '<div class="ai-spinner"></div>';

    openModal(html);

    const payload = {
      candidate_name: currentProfile.candidate_name,
      degree: currentProfile.degree,
      cgpa: currentProfile.cgpa,
      primary_lang: currentProfile.primary_lang,
      target_track: currentProfile.target_track,
      score: result.score,
      weak_topics: result.weak_topics,
      strong_topics: result.strong_topics
    };

    postJson('plan', payload)
      .then(pl => renderPlan(pl.plan, result))
      .catch(() => renderPlanFallback(result));
  }

  /* ---------------- study plan + roadmap ---------------- */
  function renderPlanFallback(result) {
    const weak = result.weak_topics.length ? result.weak_topics.join(', ') : result.language + ' core topics';
    const road = {
      plan_summary: 'A structured plan focusing on ' + weak + '. Follow daily tasks and mark them complete to track progress.',
      level: result.score >= 70 ? 'Mastery' : result.score >= 45 ? 'Accelerator' : 'Foundation',
      total_weeks: result.score < 40 ? 6 : result.score <= 70 ? 4 : 3,
      roadmap: buildFallbackRoadmap(result)
    };
    renderPlan(road, result);
  }

  function buildFallbackRoadmap(result) {
    const weeks = result.score < 40 ? 6 : result.score <= 70 ? 4 : 3;
    const lang = currentProfile.primary_lang || 'language';
    const arr = [];
    const themes = [
      ['Syntax & Core concepts (' + lang + ')', 'Re-learn core syntax: variables, data types, operators, control flow, functions. Solve 10 pattern programs.'],
      ['OOP & Data Structures', 'Objects, classes, inheritance, polymorphism. Practice arrays, strings, linked lists, stacks, queues.'],
      ['Problem Solving (DSA)', 'Two-pointers, sliding window, sorting, searching, recursion. 3 problems per day on LeetCode.'],
      ['Database & SQL', 'SELECT, WHERE, Joins, GROUP BY, subqueries. Complete 20 SQL queries.'],
      ['Build a Mini Project', 'Build one full mini project in ' + lang + ' that uses your weak topics in a real workflow.'],
      ['Mock Tests & Polish', 'Take 2 timed mock assessments, review explanations, refine weak topics.']
    ];
    for (let w = 1; w <= weeks; w++) {
      const def = themes[(w - 1) % themes.length];
      const days = [];
      for (let d = 1; d <= 7; d++) {
        days.push({
          day: d,
          task: 'Day ' + d + ': ' + (d % 3 === 0 ? 'Practice problems on ' + def[0].split('(')[0].trim() + ' (2-3 problems)' : 'Study: ' + def[1].split('.')[0] + '. ' + (d % 2 === 0 ? 'Solve 2 practice problems.' : 'Revise previous notes.')),
          topic: def[0].split('(')[0].trim(),
          resource: 'freeCodeCamp / GeeksforGeeks / YouTube',
          duration_minutes: d % 7 === 6 ? 90 : 60
        });
      }
      arr.push({ week: w, focus: def[0], days, milestone_project: def[1], assessment: 'End-of-week 10-question self-test on ' + def[0].split('(')[0].trim() + '.' });
    }
    return arr;
  }

  function renderPlan(plan, result) {
    if (!isQuizModalOpen()) return;
    const progress = readProgress();
    const existingDays = (progress && progress.completedDays) || {};
    const totalDays = plan.roadmap.reduce((s, w) => s + (w.days || []).length, 0);
    const doneDays = plan.roadmap.reduce((s, w) => s + (w.days || []).filter(d => existingDays['w' + w.week + '-d' + d.day]).length, 0);

    const weeksHtml = (plan.roadmap || []).map(w => {
      const weekDone = (w.days || []).filter(d => existingDays['w' + w.week + '-d' + d.day]).length;
      const daysHtml = (w.days || []).map(d => {
        const id = 'w' + w.week + '-d' + d.day;
        const checked = !!existingDays[id];
        return '<label class="plan-day' + (checked ? ' done' : '') + '" data-dayid="' + id + '" style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.35rem 0.2rem; border-bottom:1px dashed var(--sb-border); cursor:pointer;' + (checked ? ' opacity:0.65;' : '') + '">' +
          '<input type="checkbox" ' + (checked ? 'checked' : '') + ' style="margin-top:0.15rem;" />' +
          '<div style="flex:1;">' +
          '<div style="font-size:0.8rem;">' + escapeHtml(d.task) + '</div>' +
          '<div style="font-size:0.7rem; color:#5B6B76;">Topic: ' + escapeHtml(d.topic || '') + (d.resource ? ' &middot; ' + escapeHtml(d.resource) : '') + ' &middot; ~' + (d.duration_minutes || 60) + ' min</div>' +
          '</div>' +
          '<span style="font-size:0.7rem; color:#5B6B76; white-space:nowrap;">Day ' + d.day + '</span>' +
          '</label>';
      }).join('');
      return '<div class="plan-phase" style="margin-bottom:1rem;">' +
        '<div class="plan-phase-title">Week ' + w.week + ' — ' + escapeHtml(w.focus) + ' <span class="week-progress" style="font-weight:600; color:var(--sb-success);">(' + weekDone + '/' + (w.days || []).length + ' done)</span></div>' +
        '<div style="background:var(--sb-border); border-radius:4px; height:8px; margin:0.3rem 0 0.5rem 0;">' +
        '<div class="week-progress-bar" style="width:' + ((w.days || []).length ? Math.round(weekDone / (w.days || []).length * 100) : 0) + '%; background:var(--sb-success); height:8px; border-radius:4px;"></div>' +
        '</div>' +
        daysHtml +
        (w.milestone_project ? '<div style="margin-top:0.5rem; font-size:0.78rem; background:var(--sb-bg-canvas); border:1px solid var(--sb-border); border-radius:6px; padding:0.5rem 0.6rem;"><b>Milestone:</b> ' + escapeHtml(w.milestone_project) + '</div>' : '') +
        (w.assessment ? '<div style="margin-top:0.3rem; font-size:0.75rem; color:var(--sb-teal);"><b>Assessment:</b> ' + escapeHtml(w.assessment) + '</div>' : '') +
        '</div>';
    }).join('');

    const html =
      '<div class="quiz-result" style="margin-bottom:0.8rem;">' +
      '<div class="quiz-question">Score: <b>' + result.score + '%</b> &middot; Level: <b>' + escapeHtml(plan.level || '') + '</b> &middot; Total plan: <b>' + (plan.total_weeks || plan.roadmap.length) + ' weeks / ' + totalDays + ' days</b></div>' +
      '<div class="quiz-note" style="margin:0.3rem 0;">' + escapeHtml(plan.plan_summary || '') + '</div>' +
      '<div style="display:flex; gap:0.6rem; align-items:center; margin-top:0.5rem;">' +
      '<div style="flex:1; background:var(--sb-border); border-radius:6px; height:12px;">' +
      '<div id="planTotalBar" style="width:' + (totalDays ? Math.round(doneDays / totalDays * 100) : 0) + '%; background:var(--sb-success); height:12px; border-radius:6px; animation:progressFill 0.6s ease;"></div>' +
      '</div>' +
      '<span style="font-size:0.8rem; font-weight:600;" data-plan-total>' + doneDays + '/' + totalDays + ' days done</span>' +
      '</div>' +
      '</div>' +
      weeksHtml +
      '<div class="quiz-note" style="margin-top:0.8rem;">Tip: check off each day as you complete it — your progress is saved in this browser.</div>';

    openModal(html);
    initDayCheckboxes();
  }

  function initDayCheckboxes() {
    document.querySelectorAll('.plan-day').forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      const id = label.getAttribute('data-dayid');
      if (!cb || !id) return;
      cb.addEventListener('change', () => {
        const progress = readProgress() || { completedDays: {}, scores: [], streak: 0, lastActive: null };
        progress.completedDays = progress.completedDays || {};
        if (cb.checked) {
          progress.completedDays[id] = todayStr();
        } else {
          delete progress.completedDays[id];
        }
        progress.lastActive = new Date().toISOString();
        saveProgress(progress);
        label.classList.toggle('done', cb.checked);
        label.style.opacity = cb.checked ? '0.65' : '1';
        updateWeekProgress();
      });
    });
  }

  function updateWeekProgress() {
    const progress = readProgress();
    const completed = (progress && progress.completedDays) || {};
    let doneTotal = 0, allTotal = 0;
    document.querySelectorAll('.plan-phase').forEach(phase => {
      const labels = phase.querySelectorAll('.plan-day');
      const ids = Array.from(labels).map(l => l.getAttribute('data-dayid'));
      const done = ids.filter(id => completed[id]).length;
      const weekDoneEl = phase.querySelector('.week-progress');
      const bar = phase.querySelector('.week-progress-bar');
      if (weekDoneEl) weekDoneEl.textContent = '(' + done + '/' + ids.length + ' done)';
      if (bar) bar.style.width = (ids.length ? Math.round(done / ids.length * 100) : 0) + '%';
      doneTotal += done;
      allTotal += ids.length;
    });
    const totalEl = document.querySelector('[data-plan-total]');
    if (totalEl) totalEl.textContent = doneTotal + '/' + allTotal + ' days done';
    const totalBar = document.getElementById('planTotalBar');
    if (totalBar) totalBar.style.width = (allTotal ? Math.round(doneTotal / allTotal * 100) : 0) + '%';
  }

  /* ---------------- progress panel ---------------- */
  function renderProgressPanel(container) {
    if (!container) return;
    try {
      const progress = readProgress();
      const last = readLastResult();
      if (!progress || !progress.completedDays || (progress.scores || []).length === 0) {
        container.innerHTML = '<div class="quiz-note" style="text-align:center; padding:0.6rem;">No quiz attempt yet. Click <strong>&quot;Mock Quiz&quot;</strong> above to take your adaptive skills test.</div>';
        return;
      }
      const totalDays = Object.keys(progress.completedDays).length;
      const lastScore = last ? last.score : (progress.scores[progress.scores.length - 1] || {}).score || '—';
      const attempts = progress.scores || [];
      const lastAttempt = attempts[attempts.length - 1] || {};
      const pct = lastAttempt.total ? Math.round(lastAttempt.correct / lastAttempt.total * 100) : lastScore;

      const hist = attempts.slice(-7).map(s => Math.round(s.score || 0)).join(', ');
      container.innerHTML =
        '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:0.6rem;">' +
        '<div class="data-item"><span class="lbl">Quiz Attempts</span><span class="val" style="color:var(--sb-teal);">' + attempts.length + '</span></div>' +
        '<div class="data-item"><span class="lbl">Last Score</span><span class="val">' + lastScore + '%</span></div>' +
        '<div class="data-item"><span class="lbl">Days Completed</span><span class="val">' + totalDays + '</span></div>' +
        '<div class="data-item"><span class="lbl">Primary Language</span><span class="val">' + escapeHtml(lastBut(attempts).language || (last && last.language) || '—') + '</span></div>' +
        '</div>' +
        (attempts.length > 1 ? '<div class="quiz-note" style="margin-top:0.4rem;">Last 7 scores: <b>' + escapeHtml(hist) + '</b></div>' : '') +
        '<div class="quiz-note" style="margin-top:0.4rem; font-size:0.75rem;">Progress is stored locally in this browser. Taking the AI quiz again re-verifies your profile and regenerates the plan.</div>';
    } catch (e) {
      container.innerHTML = '<div class="quiz-note">No progress yet.</div>';
    }
  }

  function lastBut(arr) {
    return arr[arr.length - 1] || {};
  }

  function init() {
    const btn = document.getElementById('aiQuizBtn');
    if (btn) btn.addEventListener('click', startAiQuiz);
    const panel = document.getElementById('aiProgressPanel');
    if (panel) renderProgressPanel(panel);
    window.renderAiProgressPanel = renderProgressPanel;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
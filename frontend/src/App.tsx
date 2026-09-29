import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, getToken, getToken as _t, setToken, type Company, type Outcome, type Predicted, type User } from './lib/api'
import Features04 from './components/originkit/features-04'

const CHART_COLORS = ['#000000', '#FF3000', '#777777', '#BBBBBB', '#E5E5E5']

/* ============================ design atoms ============================ */

function Panel({ title, num, children, right }: { title: string; num?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="sw-panel anim-up">
      <div className="flex items-center justify-between gap-3 border-b border-swiss-soft px-4 py-2.5">
        <h2 className="sw-title text-[0.95rem]">
          {num && <span className="text-swiss-red">{num} — </span>}
          {title}
        </h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Metric({ val, lbl, top = 'border-swiss-red' }: { val: string; lbl: string; top?: string }) {
  return (
    <div className={`sw-panel border-t-[3px] ${top} p-4 transition-transform hover:-translate-y-0.5 hover:border-swiss-red`}>
      <div className="text-2xl font-black tracking-tight">{val}</div>
      <div className="sw-label mt-1">{lbl}</div>
    </div>
  )
}

function Spinner() {
  return <div className="sw-spinner" />
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-black px-5 py-2.5 text-[0.8rem] font-semibold text-white">
      {msg}
    </div>
  )
}

function Chip({ children, tone = 'black' }: { children: React.ReactNode; tone?: 'black' | 'red' | 'ghost' }) {
  const cls = tone === 'red'
    ? 'border-swiss-red text-swiss-red'
    : tone === 'ghost'
      ? 'border-swiss-soft sw-muted'
      : 'border-black text-black'
  return <span className={`inline-block border px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wider ${cls} dark:border-white dark:text-white`}>{children}</span>
}

function MeterBar({ pct, tone = 'black' }: { pct: number; tone?: 'black' | 'red' | 'mid' }) {
  const bg = tone === 'red' ? 'bg-swiss-red' : tone === 'mid' ? 'bg-swiss-mid' : 'bg-black dark:bg-white'
  return (
    <div className="h-2.5 w-full border border-black bg-swiss-surface dark:border-white dark:bg-dark-surface">
      <div className={`h-full ${bg}`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  )
}

/* ============================ auth gate ============================ */

function AuthGate({ onAuth }: { onAuth: (u: User, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('demo@ace.dev')
  const [password, setPassword] = useState('password123')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      if (mode === 'login') {
        const r = await api.login(email, password)
        onAuth(r.user, r.token)
      } else {
        const r = await api.register({ email, password, full_name: fullName || email.split('@')[0] })
        setToken(r.token); onAuth(r.user, r.token)
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="sw-panel border-l-[6px] border-l-swiss-red p-6 anim-up">
        <h1 className="sw-title mb-1 text-2xl">ACE</h1>
        <p className="sw-muted mb-6 text-sm">Adaptive &amp; Continuous Education Skills — sign in to run the Skill Gap Engine.</p>
        <form onSubmit={submit} className="grid gap-3">
          {mode === 'register' && (
            <label className="grid gap-1"><span className="sw-label">Full Name</span>
              <input className="sw-input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          )}
          <label className="grid gap-1"><span className="sw-label">Email</span>
            <input className="sw-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="grid gap-1"><span className="sw-label">Password</span>
            <input className="sw-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <div className="border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-swiss-red">{err}</div>}
          <button className="sw-btn mt-2 py-2.5" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
          <button type="button" className="sw-btn-ghost py-2 text-xs" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'No account? Register' : 'Have an account? Sign in'}
          </button>
          <p className="sw-muted mt-1 text-center text-[0.65rem] uppercase tracking-widest">Auth via Supabase · REST · FastAPI</p>
        </form>
      </div>
    </div>
  )
}

/* ============================ skill gap engine ============================ */

const TRACKS = ['Tier 1A Product', 'Tier 1B Product', 'Tier 1A Service', 'Consulting']
const LANGS = ['Java', 'Python', 'C++', 'C', 'JavaScript', 'SQL']

function SkillGapEngine({ onResult }: { onResult: (r: Awaited<ReturnType<typeof api.runAnalysis>>) => void }) {
  const [name, setName] = useState('Alex Mercer')
  const [degree, setDegree] = useState('B.Tech CSE/IT')
  const [cgpa, setCgpa] = useState('7.5')
  const [lang, setLang] = useState('Java')
  const [track, setTrack] = useState(TRACKS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.runAnalysis>> | null>(null)

  async function run() {
    setBusy(true); setErr(null)
    try {
      const r = await api.runAnalysis({ candidate_name: name, degree, cgpa: parseFloat(cgpa), primary_lang: lang, target_track: track })
      setRes(r); onResult(r)
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  const p: Predicted | null = res?.predicted ?? null
  const matches: Array<Record<string, unknown>> = res?.matched_companies ?? []

  return (
    <section id="analyzer" className="grid gap-4 lg:grid-cols-2">
      <Panel title="Student Profile Evaluation" num="01">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1"><span className="sw-label">Candidate Name</span>
            <input className="sw-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="grid gap-1"><span className="sw-label">Degree / Branch</span>
            <select className="sw-input" value={degree} onChange={(e) => setDegree(e.target.value)}>
              <option>B.Tech CSE/IT</option><option>B.Tech ECE/EEE</option><option>B.Tech Mechanical/Civil</option>
            </select></label>
          <label className="grid gap-1"><span className="sw-label">Academic Standing (CGPA 0.0-10.0)</span>
            <input className="sw-input" type="number" step="0.1" min="0" max="10" value={cgpa} onChange={(e) => setCgpa(e.target.value)} /></label>
          <label className="grid gap-1"><span className="sw-label">Primary Programming Language</span>
            <select className="sw-input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select></label>
          <label className="grid gap-1 col-span-2"><span className="sw-label">Target Placement Tier</span>
            <select className="sw-input" value={track} onChange={(e) => setTrack(e.target.value)}>
              {TRACKS.map((t) => <option key={t}>{t}</option>)}
            </select></label>
        </div>
        <button className="sw-btn mt-4 w-full py-3" onClick={run} disabled={busy}>
          {busy ? 'TensorFlow Scoring…' : 'Run Placement Readiness Analysis'}
        </button>
        <p className="sw-muted mt-2 text-center text-[0.62rem] uppercase tracking-widest">React + TS → REST → FastAPI → TensorFlow → PostgreSQL</p>
        {err && <div className="mt-3 border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{err}</div>}
      </Panel>

      <Panel title="Evaluation Report" num="03" right={
        res ? <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => window.print()}>Download Text</button> : null
      }>
        {!p ? (
          <div className="sw-muted py-10 text-center text-sm uppercase tracking-widest">Run an analysis to see the report</div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-swiss-soft pb-3">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">{name}</h3>
                <p className="sw-label mt-0.5">Readiness Assessment</p>
              </div>
              <div className={`grid h-20 w-24 place-items-center border-2 ${p.score >= 70 ? 'bg-black text-white' : 'bg-swiss-red text-white'}`}>
                <span className="text-2xl font-black">{p.score}%</span>
                <span className="text-[0.55rem] font-bold uppercase tracking-widest">Match Score</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="sw-surface p-3"><div className="sw-label">Target Track</div><div className="mt-1 font-bold">{track}</div></div>
              <div className="sw-surface p-3"><div className="sw-label">Readiness Tier</div><div className="mt-1 font-bold">{p.readinessTier}</div></div>
              <div className="sw-surface p-3 col-span-2"><div className="sw-label">Target Salary Range</div><div className="mt-1 font-bold">{p.salaryBand}</div></div>
            </div>
            <div className="sw-surface mt-3 p-3">
              <div className="sw-label">Verified Core Skills</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{p.verifiedSkills.map((s) => <Chip key={s}>{s}</Chip>)}</div>
            </div>
            <div className="sw-surface mt-3 p-3">
              <div className="sw-label">Recommended Skill Gaps to Close</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{p.skillGaps.map((s) => <Chip key={s} tone="red">{s}</Chip>)}</div>
            </div>
            <div className="sw-surface mt-3 p-3">
              <div className="sw-label">TensorFlow ML Engine</div>
              <div className="mt-1.5 grid grid-cols-3 gap-3 text-sm">
                <div><span className="sw-muted text-xs">Rule score</span><div className="font-black">{p.ml_engine.rule_score}</div></div>
                <div><span className="sw-muted text-xs">ML score</span><div className="font-black">{p.ml_engine.ml_score ? p.ml_engine.ml_score.toFixed(1) : '—'}</div></div>
                <div><span className="sw-muted text-xs">Blended</span><div className="font-black">{p.ml_engine.tensorflow ? 'YES' : 'FALLBACK'}</div></div>
              </div>
            </div>
            {matches.length > 0 && (
              <div className="mt-3">
                <div className="sw-label mb-1.5">Best-Fit Companies (ML Ranked)</div>
                <div className="grid grid-cols-3 gap-2">
                  {matches.map((c: any, i: number) => (
                    <div key={i} className="sw-surface border-l-4 border-l-swiss-red p-2.5">
                      <div className="text-[0.78rem] font-bold">{c.name}</div>
                      <div className="sw-muted text-[0.62rem] uppercase">{c.type} · {c.ctc}</div>
                      <div className="mt-1 text-[0.7rem] font-black text-swiss-red">FIT {c.fit_score}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </section>
  )
}

/* ============================ mock quiz ============================ */

function MockQuiz({ profile }: { profile: { candidate_name: string; degree: string; cgpa: string; primary_lang: string; target_track: string } }) {
  const [questions, setQuestions] = useState<any[] | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function start() {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await api.aiQuiz(profile)
      setQuestions(r.questions)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  function submit() {
    if (!questions) return
    const correct = questions.filter((q, i) => answers[i] === q.answer).length
    const score = Math.round((correct / questions.length) * 100)
    setResult({ score, correct, total: questions.length })
    api.submitQuiz({ set_id: null, answers: questions.map((_q, i) => ({ question_id: i, selected_option: answers[i] ?? 0 })) }).catch(() => {})
  }

  return (
    <Panel title="AI Adaptive Mock Quiz" num="02" right={
      questions ? <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => { setQuestions(null); setAnswers({}); setResult(null) }}>Reset</button> : null
    }>
      {!questions ? (
        <div>
          <p className="sw-muted mb-3 text-sm">Adaptive skills test generated by the AI service — verifies your profile before scoring.</p>
          <button className="sw-btn-ghost w-full py-2.5" onClick={start} disabled={busy}>{busy ? 'Generating…' : 'Start Mock Quiz'}</button>
          {err && <div className="mt-3 border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{err}</div>}
        </div>
      ) : result ? (
        <div>
          <div className="sw-surface p-4 text-center">
            <div className="text-4xl font-black">{result.score}%</div>
            <div className="sw-label mt-1">{result.correct}/{result.total} correct · Saved to PostgreSQL</div>
            <div className="mt-3"><MeterBar pct={result.score} tone={result.score >= 70 ? 'black' : 'red'} /></div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {questions.map((q, i) => (
            <div key={i} className="sw-surface p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{i + 1}. {q.question}</div>
                <Chip tone={q.difficulty === 'hard' ? 'red' : q.difficulty === 'medium' ? 'black' : 'ghost'}>{q.difficulty}</Chip>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {q.options.map((opt: string, oi: number) => (
                  <label key={oi} className="flex cursor-pointer items-center gap-2 text-[0.78rem]">
                    <input type="radio" name={`q${i}`} checked={answers[i] === oi} onChange={() => setAnswers({ ...answers, [i]: oi })} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="sw-btn py-2.5" onClick={submit} disabled={Object.keys(answers).length < questions.length}>
            Submit Quiz ({Object.keys(answers).length}/{questions.length})
          </button>
        </div>
      )}
    </Panel>
  )
}

/* ============================ placement database ============================ */

function PlacementDatabase() {
  const [data, setData] = useState<Company[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [compare, setCompare] = useState<Company[] | null>(null)
  const [loading, setLoading] = useState(true)
  const LIMIT = 12

  useEffect(() => {
    setLoading(true)
    api.companies(page, LIMIT, q, type).then((r) => { setData(r.companies); setTotal(r.total) }).finally(() => setLoading(false))
  }, [page, q, type])

  const pages = Math.max(1, Math.ceil(total / LIMIT))

  async function doCompare() {
    const r = await api.compare(selected)
    setCompare(r.companies)
  }

  return (
    <Panel title="Interactive Placement & Difficulty Database" num="04"
      right={<span className="sw-label">{total} companies</span>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="sw-input max-w-xs" placeholder="Search companies…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select className="sw-input max-w-40" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}>
          <option value="">All types</option><option>Product</option><option>Service</option>
        </select>
      </div>
      {loading ? <Spinner /> : (
        <div className="overflow-x-auto border-2 border-black dark:border-white">
          <table className="w-full border-collapse text-[0.8rem]">
            <thead>
              <tr className="bg-black text-white dark:bg-black">
                <th className="border-b border-swiss-soft px-2 py-2 text-left uppercase tracking-wider">Sel</th>
                <th className="px-2 py-2 text-left uppercase tracking-wider">Company</th>
                <th className="px-2 py-2 text-left uppercase tracking-wider">Type</th>
                <th className="px-2 py-2 text-left uppercase tracking-wider">CTC Band</th>
                <th className="px-2 py-2 text-left uppercase tracking-wider">Difficulty</th>
                <th className="px-2 py-2 text-left uppercase tracking-wider">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id} className={i % 2 ? 'bg-swiss-surface dark:bg-dark-surface' : ''}>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />
                  </td>
                  <td className="px-2 py-2 font-bold">{c.name}</td>
                  <td className="px-2 py-2">{c.type}</td>
                  <td className="px-2 py-2">{c.ctc_band}</td>
                  <td className="px-2 py-2">
                    <Chip tone={c.difficulty_cat === 'HARD' ? 'red' : c.difficulty_cat === 'MEDIUM' ? 'black' : 'ghost'}>{c.difficulty_cat} {c.difficulty_pct}%</Chip>
                  </td>
                  <td className="sw-muted px-2 py-2 text-[0.72rem]">{c.rounds_desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button className="sw-btn-ghost px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
          <span className="sw-label self-center">{page} / {pages}</span>
          <button className="sw-btn-ghost px-3 py-1.5 text-xs" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="sw-label">{selected.length} selected</span>
          <button className="sw-btn px-3 py-1.5 text-xs" disabled={selected.length < 2} onClick={doCompare}>Compare Selected</button>
        </div>
      </div>
      {compare && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" onClick={() => setCompare(null)}>
          <div className="sw-panel max-h-[85vh] w-full max-w-3xl overflow-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="sw-title text-lg">Company Comparison</h3>
              <button className="sw-btn-ghost px-3 py-1 text-xs" onClick={() => setCompare(null)}>Close ×</button>
            </div>
            <table className="w-full border-collapse text-[0.8rem]">
              <tbody>
                {(['name', 'type', 'ctc_band', 'difficulty_cat', 'difficulty_pct', 'rounds_desc', 'key_skills'] as const).map((k) => (
                  <tr key={k}>
                    <th className="border border-black bg-black px-2 py-2 text-left uppercase tracking-wider text-white">{k.replace(/_/g, ' ')}</th>
                    {compare.map((c) => <td key={c.id} className="border border-swiss-soft px-2 py-2">{c[k]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ============================ market analytics ============================ */

function MarketAnalytics() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.powerbiAnalytics>> | null>(null)
  useEffect(() => { api.powerbiAnalytics().then(setData).catch(() => {}) }, [])

  const typeRows = useMemo(() => {
    if (!data) return []
    const entries = Object.entries(data.companies_by_type).sort((a, b) => b[1] - a[1])
    const max = entries[0]?.[1] || 1
    return entries.map(([t, n]) => ({ t, n, pct: (n / max) * 100 }))
  }, [data])

  const ctcRows = useMemo(() =>
    Object.entries(data?.avg_ctc_by_type ?? {}).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ type: t, ctc: v })),
  [data])
  const diffData = useMemo(() =>
    Object.entries(data?.difficulty_split ?? {}).map(([k, v]) => ({ name: k, value: v })),
  [data])
  const regionData = useMemo(() =>
    Object.entries(data?.region_split ?? {}).map(([k, v]) => ({ name: k, value: v })),
  [data])

  return (
    <Panel title="Market Analytics" num="05" right={<span className="sw-label">{data ? `${data.row_count} companies · live` : 'loading…'}</span>}>
      {!data ? <Spinner /> : (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="bg-black px-3 py-2 text-[0.78rem] font-bold text-white">{data.row_count} companies <span className="opacity-80">· tracked</span></div>
            {Object.entries(data.difficulty_split).map(([k, v]) => (
              <div key={k} className="bg-black px-3 py-2 text-[0.78rem] font-bold text-white">{k} <span className="opacity-80">· {v}</span></div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="sw-surface p-4">
              <h4 className="sw-title mb-3 text-[0.85rem]">Companies by Category</h4>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={typeRows.map((r) => ({ name: r.t, count: r.n }))}>
                  <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} stroke="#555555" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#555555" />
                  <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                  <Bar dataKey="count" fill="#000000" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sw-surface p-4">
              <h4 className="sw-title mb-3 text-[0.85rem]">Average Fresher CTC by Category (LPA)</h4>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={ctcRows}>
                  <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} stroke="#555555" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#555555" />
                  <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                  <Bar dataKey="ctc" fill="#FF3000" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sw-surface p-4">
              <h4 className="sw-title mb-3 text-[0.85rem]">Difficulty Split</h4>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={diffData} dataKey="value" nameKey="name" outerRadius={85} label={({ name, value }) => `${name} ${value}`}>
                    {diffData.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="sw-surface p-4">
              <h4 className="sw-title mb-3 text-[0.85rem]">Global vs India</h4>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={regionData} dataKey="value" nameKey="name" outerRadius={85} label={({ name, value }) => `${name} ${value}`}>
                    {regionData.map((_e, i) => <Cell key={i} fill={i === 1 ? '#FF3000' : '#000000'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ============================ Power BI (gov) ============================ */

function PowerBI({ user }: { user: User | null }) {
  const [cfg, setCfg] = useState<Awaited<ReturnType<typeof api.powerbiConfig>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (user) api.powerbiConfig().then(setCfg).catch((e) => setErr(e.message))
  }, [user])

  const isAdmin = user && ['admin', 'government', 'gov'].includes(String(user.role).toLowerCase())

  return (
    <Panel title="Power BI — Government Analytics & Reporting" num="07"
      right={<span className="sw-label">role-gated</span>}>
      {!user ? (
        <p className="sw-muted text-sm">Sign in to access government dashboards.</p>
      ) : err ? (
        <div className="border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{err}</div>
      ) : !isAdmin ? (
        <div className="sw-surface p-4 text-sm">
          <span className="sw-label">Access restricted</span>
          <p className="mt-1">Power BI government analytics require an <b>admin</b> or <b>government</b> role. Signed in as <b>{user.email}</b> ({user.role}).</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="sw-surface p-4">
            <div className="sw-label">Embed status</div>
            <p className="mt-1 text-sm">{cfg?.configured ? `Connected: ${cfg.base_url}` : 'POWER_BI_BASE_URL not configured — reports listed below are embed-ready.'}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {cfg?.reports.map((r) => (
              <div key={r.id} className="sw-surface border-l-4 border-l-swiss-red p-3">
                <div className="text-[0.8rem] font-bold uppercase">{r.name}</div>
                <div className="sw-label mt-1">{r.role} · {r.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ============================ training outcomes ============================ */

function TrainingOutcomes({ user }: { user: User | null }) {
  const [rows, setRows] = useState<Outcome[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.outcomeStats>> | null>(null)
  const [q, setQ] = useState('')
  const [placedFilter, setPlacedFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState({ program_name: '', trainee_name: '', batch: '', skills: '', placed: false, employer: '', ctc_lpa: '' })

  const load = () => {
    api.outcomes(q, placedFilter).then((r) => setRows(r.outcomes)).catch(() => {})
    api.outcomeStats().then(setStats).catch(() => {})
  }
  useEffect(load, [q, placedFilter])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { setMsg('Sign in to upload outcomes'); return }
    setBusy(true); setMsg(null)
    try {
      await api.addOutcome({
        program_name: form.program_name,
        trainee_name: form.trainee_name,
        batch: form.batch || null,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        placed: form.placed,
        employer: form.employer || null,
        ctc_lpa: form.ctc_lpa ? parseFloat(form.ctc_lpa) : null,
        source: 'manual',
      })
      setForm({ program_name: '', trainee_name: '', batch: '', skills: '', placed: false, employer: '', ctc_lpa: '' })
      setMsg('Outcome saved to PostgreSQL')
      load()
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  const programData = useMemo(() => Object.entries(stats?.by_program ?? {}).map(([name, n]) => ({ name, n })), [stats])

  return (
    <section id="outcomes-form" className="grid gap-4">
      <Panel title="Training Program Outcomes — Upload & Export" num="06">
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={submit} className="sw-surface grid gap-2.5 p-4">
            <span className="sw-label">Upload Training Outcome</span>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="grid gap-1"><span className="sw-label">Program</span>
                <input className="sw-input" required value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })} placeholder="Full-Stack Bootcamp" /></label>
              <label className="grid gap-1"><span className="sw-label">Trainee</span>
                <input className="sw-input" required value={form.trainee_name} onChange={(e) => setForm({ ...form, trainee_name: e.target.value })} placeholder="Jane Doe" /></label>
              <label className="grid gap-1"><span className="sw-label">Batch</span>
                <input className="sw-input" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="2026-A" /></label>
              <label className="grid gap-1"><span className="sw-label">Employer</span>
                <input className="sw-input" value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder="TCS" /></label>
              <label className="grid gap-1"><span className="sw-label">Skills (comma-separated)</span>
                <input className="sw-input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Java, SQL, React" /></label>
              <label className="grid gap-1"><span className="sw-label">CTC (LPA)</span>
                <input className="sw-input" type="number" step="0.1" min="0" value={form.ctc_lpa} onChange={(e) => setForm({ ...form, ctc_lpa: e.target.value })} placeholder="7.5" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={form.placed} onChange={(e) => setForm({ ...form, placed: e.target.checked })} />
              Placed
            </label>
            <button className="sw-btn py-2.5" disabled={busy}>{busy ? 'Saving…' : 'Save Outcome'}</button>
            {msg && <div className="border border-black bg-white px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wide">{msg}</div>}
          </form>
          <div className="grid content-start gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="sw-surface p-3"><div className="sw-label">Records</div><div className="mt-1 text-xl font-black">{stats?.total ?? 0}</div></div>
              <div className="sw-surface p-3"><div className="sw-label">Placement Rate</div><div className="mt-1 text-xl font-black text-swiss-red">{stats?.placement_rate ?? 0}%</div></div>
              <div className="sw-surface p-3"><div className="sw-label">Avg CTC</div><div className="mt-1 text-xl font-black">₹{stats?.avg_ctc ?? 0}L</div></div>
            </div>
            {programData.length > 0 && (
              <div className="sw-surface p-4">
                <h4 className="sw-title mb-2 text-[0.85rem]">Placements by Program</h4>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={programData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} stroke="#555555" />
                    <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                    <Bar dataKey="n" fill="#FF3000" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex gap-2">
              <a className="sw-btn-ghost flex-1 py-2.5 text-center text-xs" href={api.exportUrl('csv')}>Export CSV / Excel ↓</a>
              <a className="sw-btn-ghost flex-1 py-2.5 text-center text-xs" href={api.exportUrl('json')} target="_blank" rel="noreferrer">Export JSON ↓</a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Outcome Records — Filter & Search" num="06b" right={<span className="sw-label">{rows.length} rows</span>}>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="sw-input max-w-xs" placeholder="Search trainee / program / employer…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="sw-input max-w-40" value={placedFilter} onChange={(e) => setPlacedFilter(e.target.value)}>
            <option value="">All outcomes</option><option value="true">Placed only</option><option value="false">Not placed</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <div className="sw-muted py-8 text-center text-sm uppercase tracking-widest">No training outcomes yet — upload the first one</div>
        ) : (
          <div className="overflow-x-auto border-2 border-black dark:border-white">
            <table className="w-full border-collapse text-[0.8rem]">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Trainee</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Program</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Batch</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Skills</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Placed</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">Employer</th>
                  <th className="px-2 py-2 text-left uppercase tracking-wider">CTC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className={rows.indexOf(o) % 2 ? 'bg-swiss-surface dark:bg-dark-surface' : ''}>
                    <td className="px-2 py-2 font-bold">{o.trainee_name}</td>
                    <td className="px-2 py-2">{o.program_name}</td>
                    <td className="px-2 py-2">{o.batch || '—'}</td>
                    <td className="sw-muted px-2 py-2 text-[0.72rem]">{Array.isArray(o.skills) ? o.skills.join(', ') : String(o.skills || '—')}</td>
                    <td className="px-2 py-2">{o.placed ? <Chip tone="red">Yes</Chip> : <Chip tone="ghost">No</Chip>}</td>
                    <td className="px-2 py-2">{o.employer || '—'}</td>
                    <td className="px-2 py-2 font-bold">{o.ctc_lpa ? `₹${o.ctc_lpa}L` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  )
}

/* ============================ predictive analytics ============================ */

function SkillDemandForecast() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.forecast>> | null>(null)
  useEffect(() => { api.forecast().then(setData).catch(() => {}) }, [])
  return (
    <Panel title="Predictive Analytics — Skill Demand Forecast" num="09" right={<span className="sw-label">{data?.model ?? 'loading…'}</span>}>
      {!data ? <Spinner /> : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.skills} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
            <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" />
            <XAxis dataKey="skill" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" stroke="#555555" />
            <YAxis tick={{ fontSize: 10 }} stroke="#555555" domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="current" name="Current demand index" stroke="#000000" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="forecast" name="Forecast (AI model)" stroke="#FF3000" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  )
}

/* ============================ role dashboards ============================ */

function RoleDashboard({ user }: { user: User | null }) {
  const role = user ? String(user.role).toLowerCase() : 'guest'
  const effective = role === 'admin' || role === 'government' || role === 'gov' ? 'government' : role === 'employer' ? 'employer' : 'student'
  const stats = useMemo(() => api.outcomeStats().catch(() => null), [])
  const [s, setS] = useState<Awaited<ReturnType<typeof api.outcomeStats>> | null>(null)
  useEffect(() => { stats.then(setS) }, [stats])

  const cards: Record<string, Array<{ lbl: string; val: string }>> = {
    student: [
      { lbl: 'Your Sessions', val: 'Persistent' },
      { lbl: 'Skill Gap Engine', val: 'Unlocked' },
      { lbl: 'Mock Quizzes', val: 'Unlimited' },
      { lbl: 'Placement DB', val: '80 companies' },
    ],
    employer: [
      { lbl: 'Outcome Uploads', val: 'Enabled' },
      { lbl: 'Trainee Pool', val: `${s?.total ?? 0} records` },
      { lbl: 'Hires From ACE', val: `${s?.placed ?? 0}` },
      { lbl: 'Avg Hired CTC', val: `₹${s?.avg_ctc ?? 0}L` },
    ],
    government: [
      { lbl: 'Placement Rate', val: `${s?.placement_rate ?? 0}%` },
      { lbl: 'Outcome Records', val: `${s?.total ?? 0}` },
      { lbl: 'Power BI Reports', val: '3 dashboards' },
      { lbl: 'Data Export', val: 'CSV / JSON' },
    ],
    guest: [
      { lbl: 'Access', val: 'Sign in required' },
      { lbl: 'Skill Gap Engine', val: 'Members only' },
      { lbl: 'Placement DB', val: 'Public preview' },
      { lbl: 'Market Analytics', val: 'Public' },
    ],
  }

  return (
    <Panel title={`Role Dashboard — ${effective}`} num="00">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards[effective].map((c, i) => (
          <div key={c.lbl} className={`sw-surface border-l-4 p-3.5 ${i === 0 ? 'border-l-swiss-red' : 'border-l-black'}`}>
            <div className="sw-label">{c.lbl}</div>
            <div className="mt-1 text-lg font-black uppercase">{c.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ============================ architecture ============================ */

function Architecture() {
  const flow = ['Browser / User', 'React + TypeScript + Tailwind CSS', 'REST API calls', 'Python + FastAPI', 'PostgreSQL Database', 'TensorFlow ML logic', 'Skill scoring, recommendations, job matching']
  const side = [
    { t: 'Supabase Auth', d: 'Login + session handling + role permissions' },
    { t: 'Power BI', d: 'Government analytics and reporting dashboards' },
  ]
  return (
    <Panel title="System Architecture" num="08">
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="grid gap-1.5">
          {flow.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`flex-1 border-2 px-3 py-2 text-[0.8rem] font-bold uppercase tracking-wide ${i === 0 ? 'border-black bg-white' : i === flow.length - 1 ? 'border-swiss-red bg-swiss-red text-white' : 'border-black bg-black text-white dark:border-white'}`}>{s}</div>
              {i < flow.length - 1 && <span className="sw-muted font-black">↓</span>}
            </div>
          ))}
        </div>
        <div className="grid content-start gap-1.5">
          {side.map((s) => (
            <div key={s.t} className="sw-surface border-l-4 border-l-swiss-red p-3">
              <div className="text-[0.8rem] font-black uppercase">{s.t}</div>
              <div className="sw-muted mt-0.5 text-[0.7rem]">{s.d}</div>
            </div>
          ))}
          <div className="sw-surface p-3">
            <div className="sw-label">Live status</div>
            <ul className="mt-1 space-y-0.5 text-[0.72rem]">
              <li>FastAPI :8001 — <b className="text-swiss-red">RUNNING</b></li>
              <li>TensorFlow — <b className="text-swiss-red">ACTIVE</b></li>
              <li>PostgreSQL — <b className="text-swiss-red">CONNECTED</b></li>
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ============================ outcomes ============================ */

function OutcomesLink() {
  return (
    <div className="sw-panel flex flex-wrap items-center justify-between gap-4 border-l-[6px] border-l-swiss-red p-4 anim-up">
      <div>
        <h3 className="sw-title text-base">Employment Outcome Tracker</h3>
        <p className="sw-muted mt-1 max-w-2xl text-[0.78rem]">See who got placed via ACE — company, salary package (CTC), role, joining location, batch and offer verification — plus the cohort dashboard with employment funnel, skill-gap analytics and success stories.</p>
      </div>
      <a className="sw-btn-red px-5 py-3 text-sm" href="/outcomes.html">Employment Outcome →</a>
    </div>
  )
}

/* ============================ app ============================ */

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [booted, setBooted] = useState(false)
  const [dark, setDark] = useState(localStorage.getItem('ace_theme') === 'dark')
  const [toast] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<typeof api.runAnalysis>> | null>(null)
  const [backToPortal, setBackToPortal] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ace_theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (getToken()) {
      api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setBooted(true))
    } else {
      setBooted(true)
    }
  }, [])

  const profile = { candidate_name: 'Alex Mercer', degree: 'B.Tech CSE/IT', cgpa: '7.5', primary_lang: 'Java', target_track: 'Tier 1A Product' }

  if (!booted) return <div className="grid min-h-screen place-items-center"><Spinner /></div>

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b-[3px] border-b-swiss-red bg-black text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <span className="inline-block h-3.5 w-3.5 bg-swiss-red" /> ACE
            <span className="hidden text-[0.6rem] font-semibold uppercase tracking-[0.14em] opacity-75 md:inline">Adaptive &amp; Continuous Education Skills</span>
          </h1>
          <nav className="flex items-center gap-4 text-[0.72rem] font-bold uppercase tracking-[0.1em]">
            <button className="hover:text-swiss-red uppercase" onClick={() => { setBackToPortal(true); setTimeout(() => { window.location.href = '/app/' }, 0) }}>← Portal</button>
            <a className="hover:text-swiss-red" href="#analyzer">Skill Gap Engine</a>
            <a className="hover:text-swiss-red" href="#outcomes-form">Training Outcomes</a>
            <a className="hover:text-swiss-red" href="#database">Placement DB</a>
            <a className="hover:text-swiss-red" href="#analytics">Analytics</a>
            <a className="hover:text-swiss-red" href="#powerbi">Gov Analytics</a>
            <a className="bg-swiss-red px-3 py-1.5 hover:bg-white hover:text-black" href="/outcomes.html">Employment Outcome →</a>
            {user ? (
              <button className="border border-white px-3 py-1.5 uppercase hover:bg-swiss-red hover:border-swiss-red" onClick={() => { api.logout(); setUser(null) }}>
                {user.full_name || user.email} · Sign out
              </button>
            ) : null}
            <button className="border border-white px-3 py-1.5 uppercase hover:bg-swiss-red hover:border-swiss-red" onClick={() => setDark(!dark)}>{dark ? 'Light Mode' : 'Dark Mode'}</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5">
        <section className="sw-panel border-l-[6px] border-l-swiss-red p-4 anim-up">
          <h2 className="text-[1.35rem] font-black uppercase tracking-tight">ACE — Comprehensive Company Recruitment Guide (2026 Updated)</h2>
          <p className="sw-muted mt-1 text-[0.85rem]">Integrated data mapping platform matching 1000+ national &amp; international companies (tech service majors, product giants, GCCs, finance, consulting, PSUs and startups) with live difficulty benchmarks, fresher CTC bands, joining criteria, and selection dynamics.</p>
        </section>

        <RoleDashboard user={user} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric val="1000+ Listed" lbl="Total Verified Companies" />
          <Metric val="₹3.5 - ₹65 LPA" lbl="Fresher CTC Spectrum" top="border-black" />
          <Metric val="40% - 70%" lbl="Service Success Rate" top="border-swiss-mid" />
          <Metric val="1% - 20%" lbl="Product Success Rate" top="border-swiss-light" />
        </div>

        <OutcomesLink />

        {backToPortal ? (
          <section className="sw-panel border-l-[6px] border-l-swiss-red p-6 text-center anim-up">
            <h2 className="text-xl font-black uppercase">Redirecting to your portal…</h2>
            <p className="sw-muted mt-2 text-sm">If nothing happens, <button className="underline" onClick={() => { window.location.href = '/app/' }}>click here</button>.</p>
          </section>
        ) : !user ? (
          <AuthGate onAuth={(u) => setUser(u)} />
        ) : (
          <>
            <SkillGapEngine onResult={setLastResult} />
            <MockQuiz profile={profile} />
          </>
        )}

        <TrainingOutcomes user={user} />
        <div id="database"><PlacementDatabase /></div>
        <div id="analytics"><MarketAnalytics /></div>
        <SkillDemandForecast />
        <div id="powerbi"><PowerBI user={user} /></div>
        <Architecture />

        <Features04 />

        <footer className="mt-2 border-t-[3px] border-t-swiss-red bg-black px-5 py-4 text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-[0.7rem]">
            <div className="font-extrabold">ACE <span className="font-medium opacity-80">— React · TypeScript · Tailwind · FastAPI · TensorFlow · PostgreSQL · Supabase Auth · Power BI</span></div>
            <div className="opacity-80">{lastResult?.predicted ? `Last analysis: ${String(lastResult.predicted.score)}% match` : 'Swiss International Edition v3.0'}</div>
          </div>
        </footer>
      </main>
      <Toast msg={toast} />
    </div>
  )
}

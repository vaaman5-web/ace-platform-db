import { useEffect, useRef, useState } from 'react'
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type CatalogCourse, type LanguageMeta, type LanguageDetail, type TrackMeta, type TrackDetail, type CompanyRoadmap } from './lib/api'

/* Swiss design atoms (mirror of App.tsx primitives, kept local for the portal layer) */
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

function Spinner() {
  return <div className="sw-spinner" />
}

function KPI({ val, sub }: { val: string; sub: string }) {
  return (
    <div className="sw-panel border-t-[3px] border-t-swiss-red p-4 transition-transform duration-300 hover:-translate-y-1">
      <div className="text-2xl font-black tracking-tight">{val}</div>
      <div className="sw-label mt-1">{sub}</div>
    </div>
  )
}

function ActivityFeed({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const [items, setItems] = useState<Array<{ icon: string; title: string; detail: string; when: string; tab: string }> | null>(null)
  useEffect(() => { api.portalActivity().then((r) => setItems(r.items)).catch(() => setItems([])) }, [tab])
  if (!items || items.length === 0) return null
  return (
    <Panel title="Recent Activity" num="✦">
      <div className="grid gap-2">
        {items.slice(0, 8).map((it, i) => (
          <button key={i} className="sw-surface flex flex-wrap items-center justify-between gap-2 p-2.5 text-left transition-colors hover:border-swiss-red" onClick={() => onTab(it.tab)}>
            <span className="flex items-center gap-2.5"><span className="text-base">{it.icon}</span>
              <span><span className="block text-[0.78rem] font-black uppercase">{it.title}</span>
                <span className="sw-muted block text-[0.68rem]">{it.detail}</span></span>
            </span>
            <span className="sw-label">{it.when}</span>
            <span className="sw-btn-ghost px-2 py-1 text-[0.62rem]">{it.tab} →</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function AINarrativePanel({ portal, title }: { portal: 'government' | 'employer' | 'institution'; title: string }) {
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function load() {
    setBusy(true); setErr(null)
    try { const r = await api.aiNarrative(portal); setText(r.narrative) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [portal])
  return (
    <Panel title={title} num="AI">
      {busy && <div className="sw-spinner" />}
      {err && <div className="border border-black px-3 py-2 text-[0.7rem] font-bold uppercase text-swiss-red">{err} <button className="underline" onClick={load}>retry</button></div>}
      {text && (
        <div className="border-l-4 border-l-swiss-red bg-swiss-surface p-3 text-[0.8rem] leading-relaxed dark:bg-dark-surface">
          🤖 {text}
          <button className="sw-btn-ghost mt-2 block px-2 py-1 text-[0.62rem]" disabled={busy} onClick={load}>↻ Regenerate</button>
        </div>
      )}
    </Panel>
  )
}

/* ============================ AI career coach (chat) ============================ */

function AICoach() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hi! I am ACE Coach 🤖 — your AI placement mentor. Ask me anything: study plans, interview prep, which company to target first, or how to fix a weak topic.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, open])

  const quick = ['Build me a 4-week study plan', 'Which company should I target first?', 'How do I fix my weak topics?', 'How does ACE calculate my match %?']

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next = [...msgs, { role: 'user' as const, content }]
    setMsgs(next); setInput(''); setBusy(true); setErr(null)
    try {
      const r = await api.aiCoach('coach', next.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-8))
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply }])
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center border-2 border-black bg-swiss-red text-lg text-white shadow-[4px_4px_0_rgba(0,0,0,0.9)] transition-transform hover:-translate-y-1 lg:bottom-6 dark:border-white"
        title="AI Career Coach" onClick={() => setOpen((o) => !o)}>
        {open ? '✕' : '🤖'}
      </button>
      {open && (
        <div className="anim-pop fixed bottom-36 right-4 z-50 flex h-[430px] w-[min(92vw,360px)] flex-col border-2 border-black bg-white shadow-[6px_6px_0_rgba(0,0,0,0.9)] lg:bottom-22 dark:border-white dark:bg-dark-card">
          <div className="flex items-center justify-between border-b-2 border-black px-3 py-2 dark:border-white">
            <span className="text-[0.72rem] font-black uppercase tracking-widest">🤖 ACE Coach — AI Mentor</span>
            <button className="text-xs font-black" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] border p-2 text-[0.76rem] leading-snug ${m.role === 'user' ? 'ml-auto border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-swiss-soft bg-swiss-surface dark:bg-dark-surface'}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="sw-spinner" style={{ margin: '0.4rem auto' }} />}
            {err && <div className="border border-black px-2 py-1 text-[0.65rem] font-bold uppercase text-swiss-red">{err}</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-swiss-soft p-2">
            <div className="mb-1.5 flex flex-wrap gap-1">
              {quick.map((q) => (
                <button key={q} className="sw-btn-ghost px-2 py-0.5 text-[0.6rem]" disabled={busy} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input className="min-w-0 flex-1 border-2 border-black bg-white px-2 py-1.5 text-[0.78rem] font-medium outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface"
                placeholder="Ask your AI coach…" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(input) }} />
              <button className="sw-btn px-3 py-1.5 text-[0.7rem]" disabled={busy || !input.trim()} onClick={() => send(input)}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [msg, onDone])
  return (
    <div className="anim-toast fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 border-2 border-black bg-white px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-wider shadow-[4px_4px_0_#FF3000] dark:border-white dark:bg-dark-card">
      {msg}
    </div>
  )
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const node = msg ? <Toast msg={msg} onDone={() => setMsg(null)} /> : null
  return { toast: node, say: setMsg }
}

function GoalModal({ initial, onClose, onSave }: { initial: { role: string; wage: string; college: string }; onClose: () => void; onSave: (g: { role: string; wage: string; college: string }) => Promise<void> }) {
  const [role, setRole] = useState(initial.role)
  const [wage, setWage] = useState(initial.wage)
  const [college, setCollege] = useState(initial.college)
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 anim-fade" onClick={onClose}>
      <div className="sw-panel w-full max-w-md bg-white p-5 anim-pop dark:bg-dark-card" onClick={(e) => e.stopPropagation()}>
        <div className="sw-label">🎯 Target Career Destination</div>
        <h3 className="mt-1 text-lg font-black uppercase">Edit Your Goal</h3>
        <div className="mt-3 grid gap-2.5">
          <label className="sw-label">TARGET ROLE
            <input className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Full Stack Web Developer" />
          </label>
          <label className="sw-label">WAGE TARGET
            <input className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={wage} onChange={(e) => setWage(e.target.value)} placeholder="₹6.5 LPA" />
          </label>
          <label className="sw-label">COLLEGE
            <input className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="Government College of Engineering, Pune (COEP)" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="sw-btn-ghost px-4 py-2 text-xs" onClick={onClose}>Cancel</button>
          <button className="sw-btn px-4 py-2 text-xs" disabled={busy || !role.trim()} onClick={async () => { setBusy(true); try { await onSave({ role: role.trim(), wage: wage.trim(), college: college.trim() }) } finally { setBusy(false) } }}>{busy ? 'Saving…' : 'Save Goal'}</button>
        </div>
      </div>
    </div>
  )
}

export type PortalKey = 'learner' | 'institution' | 'employer' | 'government'

const PORTALS: Array<{ key: PortalKey; icon: string; label: string; sub: string }> = [
  { key: 'learner', icon: '🎓', label: 'Learner Portal', sub: 'Skill Assessment & Jobs' },
  { key: 'institution', icon: '🏛️', label: 'Institution Portal', sub: 'Batches & Attendance' },
  { key: 'employer', icon: '💼', label: 'Employer Portal', sub: 'Hiring & Verified Talent' },
  { key: 'government', icon: '🛡️', label: 'Government Analytics', sub: 'State District Data' },
]

const STAGES = [
  ['01', 'Profile', 'Define your education & target career destination'],
  ['02', 'Assess', 'Take 10 standardized progressive questions per skill'],
  ['03', 'Find Gap', 'See exact capability deficits versus target job requirements'],
  ['04', 'Get Recommended', 'Receive targeted training courses that solve your gaps'],
  ['05', 'Train & Attend', 'Participate in verified batch modules and hands-on sessions'],
  ['06', 'Track Outcome', 'Report employment, wage progression & training relevance'],
  ['07', 'Retain & Advance', 'Monitor longitudinal career retention at 2, 6, and 12 months'],
  ['08', 'Evidence Loop', 'Provide verified evidence for continuous program improvement'],
]

const PATHWAYS = [
  { cat: 'SOFTWARE & FULL STACK', title: 'Software Engineering', body: 'Modern full-stack architectures, REST APIs, state management, asynchronous execution, and data structures.', tag: 'Web Architectures & DSA', band: 'Tailored 10-Question Capability Matrix' },
  { cat: 'DATA & ANALYTICS', title: 'Data Analytics & AI', body: 'Relational query tuning, 3NF normalization, window functions, pandas transformations, and predictive pipelines.', tag: 'SQL, Schema Design & Analytics', band: 'Data-Driven Capability Classification' },
  { cat: 'CLOUD & INFRA', title: 'Cloud & DevOps', body: 'Docker containers, CI/CD automated deployment pipelines, reverse proxies, and resilient cloud architectures.', tag: 'Docker, CI/CD & Systems', band: 'Cloud Scale Infrastructure Evaluation' },
  { cat: 'TECHNICAL TRADES', title: 'Core Engineering', body: 'Industrial motor control, Star-Delta wiring, LOTO safety standards, and commercial power diagnostics.', tag: 'Active Only For Electrical Roles', band: 'Strict Safety & Circuit Diagnostic Band' },
]

/* ============================ landing ============================ */

export function Landing({ onEnter, onWorkspace }: { onEnter: (p: PortalKey) => void; onWorkspace: () => void }) {
  return (
    <div>
      <section className="sw-panel border-l-[6px] border-l-swiss-red p-6 anim-up">
        <p className="sw-label">Government of Maharashtra • Department of Skills & Innovation • MSSDS</p>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Bridging Talent with Opportunity Across Maharashtra</h1>
        <p className="sw-muted mt-2 max-w-3xl text-sm">A unified intelligence platform connecting learners, educational institutions, private employers, and the Maharashtra State Skill Development Society (MSSDS).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="sw-btn px-5 py-2.5" onClick={() => onEnter('learner')}>Get Started Now</button>
          <button className="sw-btn-ghost px-5 py-2.5" onClick={() => document.getElementById('portals')?.scrollIntoView({ behavior: 'smooth' })}>Explore Portals</button>
        </div>
      </section>

      <section id="portals" className="mt-4">
        <div className="sw-label mb-2">EXPLORE PORTALS:</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map((p) => (
            <button key={p.key} className="sw-panel p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-swiss-red" onClick={() => onEnter(p.key)}>
              <div className="text-2xl">{p.icon}</div>
              <div className="mt-2 font-black uppercase">{p.label}</div>
              <div className="sw-muted mt-0.5 text-[0.72rem] uppercase tracking-wider">{p.sub}</div>
            </button>
          ))}
        </div>
      </section>

      <Panel title="Role-Tailored Evaluation & Learning Engine" num="01">
        <p className="sw-muted mb-4 text-sm">No generic tests. When you choose your career destination, the platform delivers customized domain assessments, intelligent gap diagnostics, and targeted micro-curricula.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {PATHWAYS.map((p) => (
            <div key={p.title} className="sw-surface p-4">
              <div className="sw-label">{p.cat}</div>
              <h3 className="mt-1 text-lg font-black uppercase">{p.title}</h3>
              <p className="sw-muted mt-1 text-[0.82rem]">{p.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-swiss-soft pt-2">
                <span className="text-[0.72rem] font-bold">{p.tag}<span className="sw-muted block font-medium">{p.band}</span></span>
                <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={onWorkspace}>Explore Pathway</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Continuous Longitudinal Flow — The Complete Evidence Loop" num="02">
        <p className="sw-muted mb-4 text-sm">From initial assessment to retention and policy decision support.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(([n, t, d]) => (
            <div key={n} className="sw-surface border-l-4 border-l-swiss-red p-3.5">
              <div className="text-xl font-black text-swiss-red">{n}</div>
              <h3 className="mt-1 text-sm font-black uppercase tracking-wide">{t}</h3>
              <p className="sw-muted mt-1 text-[0.72rem]">{d}</p>
              <div className="sw-label mt-2">Pipeline Stage</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ============================ auth modal ============================ */

export function AuthModal({ initial, onClose, onAuthed }: { initial: PortalKey | null; onClose: () => void; onAuthed: (portal: PortalKey) => void }) {
  const [portal, setPortal] = useState<PortalKey>(initial ?? 'learner')
  const [mode, setMode] = useState<'demo' | 'signin' | 'register'>('demo')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function finish(token: string, p: PortalKey) {
    localStorage.setItem('ace_token', token)
    onAuthed(p)
  }

  async function demo(p: PortalKey) {
    setBusy(p); setErr(null)
    try {
      const r = await api.demoLogin(p)
      await finish(r.token, p)
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(null) }
  }

  async function submitCredentials() {
    setBusy('form'); setErr(null)
    try {
      if (mode === 'signin') {
        const r = await api.login(email.trim(), password)
        const me = await api.portalMe().catch(() => null)
        await finish(r.token, ((me?.portal as PortalKey) || 'learner'))
      } else {
        const r = await api.register({ email: email.trim(), password, full_name: fullName.trim() || email.split('@')[0], role: 'student' })
        await finish(r.token, 'learner')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally { setBusy(null) }
  }

  const portalHint: Record<PortalKey, string> = {
    learner: 'Assess → train → apply to verified openings',
    institution: 'Batches, attendance evidence & verification',
    employer: 'Verified talent pool & hiring pipeline',
    government: 'District analytics & policy export',
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/60 p-4 anim-fade" onClick={onClose}>
      <div className="sw-panel w-full max-w-lg bg-white p-5 anim-pop dark:bg-dark-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="sw-label">Skill-to-Employment Intelligence</div>
            <h2 className="text-xl font-black uppercase tracking-tight">
              {mode === 'register' ? 'Create Account' : mode === 'signin' ? 'Welcome Back' : 'Portal Access'}
            </h2>
            <p className="sw-muted mt-0.5 text-[0.72rem]">{portalHint[portal]}</p>
          </div>
          <button className="sw-btn-ghost px-3 py-1 text-xs" onClick={onClose}>Close ×</button>
        </div>

        <div className="sw-label mt-4 mb-2">SELECT YOUR ACCESS PORTAL:</div>
        <div className="grid grid-cols-2 gap-2">
          {PORTALS.map((p) => (
            <button key={p.key} onClick={() => setPortal(p.key)}
              className={`sw-surface p-2.5 text-left text-sm font-bold uppercase transition-colors ${portal === p.key ? 'border-swiss-red text-swiss-red' : 'hover:border-swiss-red'}`}>
              {p.icon} {p.label}<span className="sw-muted block text-[0.62rem] font-medium">{p.sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {(['demo', 'signin', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(null) }}
              className={`flex-1 border-2 px-2 py-1.5 text-[0.65rem] font-bold uppercase tracking-widest ${mode === m ? 'border-swiss-red bg-swiss-red text-white' : 'border-black hover:border-swiss-red dark:border-white'}`}>
              {m === 'demo' ? '1-Click Demo' : m === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {mode === 'demo' && (
          <div className="sw-surface mt-3 p-3">
            <div className="sw-label mb-2">INSTANT DEMO ACCESS — BYPASS CREDENTIALS</div>
            <div className="grid gap-2">
              {PORTALS.map((p) => (
                <button key={p.key} className="sw-btn-ghost py-2 text-xs transition-transform hover:-translate-y-0.5" disabled={busy === p.key} onClick={() => demo(p.key)}>
                  {busy === p.key ? 'Signing in…' : `${p.icon} ${p.label.split(' ')[0]} Demo`}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode !== 'demo' && (
          <div className="sw-surface mt-3 grid gap-2.5 p-3">
            {mode === 'register' && (
              <label className="sw-label">FULL NAME
                <input className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </label>
            )}
            <label className="sw-label">EMAIL
              <input type="email" className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="sw-label">PASSWORD
              <input type="password" className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => { if (e.key === 'Enter' && email && password) submitCredentials() }} />
            </label>
            <button className="sw-btn py-2.5 text-xs" disabled={busy === 'form' || !email.trim() || password.length < 6} onClick={submitCredentials}>
              {busy === 'form' ? 'Please wait…' : mode === 'signin' ? 'Sign In to Portal →' : 'Create Account →'}
            </button>
            {mode === 'signin' && <p className="sw-muted text-center text-[0.62rem] uppercase tracking-widest">Demo learner: rohan.sharma@skillfarming.org · Demo@1234</p>}
          </div>
        )}

        {err && <div className="mt-3 border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{err}</div>}
        <p className="sw-muted mt-3 text-center text-[0.65rem] uppercase tracking-widest">Supabase Auth · REST · FastAPI · PostgreSQL</p>
      </div>
    </div>
  )
}

/* ============================ shared shell ============================ */

const TAB_ICONS: Record<string, string> = {
  Dashboard: '◧', 'Job Marketplace': '🎯', 'Start Assessment': '🧠', 'Analytics & Gaps': '▮▮', 'Course Catalog': '📚', 'Career Outcomes': '📈',
  'Applicant Pipeline': '🎯', 'Talent Pool Discovery': '◈', 'Manage Job Postings': '🗂',
  'Program Overview': '🛡', 'District Drilldown': '🗺', 'Cohort Trends': '📈', 'Policy Insights': '⚖',
  'Batches & Attendance': '📋', 'Outcome Feed': '🔔', 'Verification': '✓',
}

function PortalShell({ portal, user, onSignOut, onSwitchPortal, tabs, active, onTab, children }: {
  portal: PortalKey; user: { full_name: string } | null; onSignOut: () => void; onSwitchPortal?: (p: PortalKey) => void
  tabs: string[]; active: string; onTab: (t: string) => void; children: React.ReactNode
}) {
  const meta = PORTALS.find((p) => p.key === portal)!
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[228px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r-[3px] border-r-swiss-red bg-black text-white lg:flex">
        <div className="border-b border-white/15 px-5 py-4 text-lg font-black uppercase tracking-tight">
          <span className="mr-2 inline-block h-3.5 w-3.5 bg-swiss-red" /> ACE
        </div>
        <div className="border-b border-white/15 px-5 py-3">
          <div className="text-[0.6rem] uppercase tracking-[0.16em] opacity-60">Signed in · {meta.label}</div>
          <div className="mt-0.5 text-sm font-black uppercase">{user?.full_name ?? meta.label}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {tabs.map((t) => (
            <button key={t} onClick={() => onTab(t)}
              className={`mb-1 flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.72rem] font-extrabold uppercase tracking-widest transition-colors ${active === t ? 'bg-swiss-red text-white' : 'opacity-75 hover:bg-white/10 hover:opacity-100'}`}>
              <span className="w-5 shrink-0 text-center">{TAB_ICONS[t] ?? '•'}</span>{t}
            </button>
          ))}
        </nav>
        {onSwitchPortal && (
          <div className="border-t border-white/15 px-3 py-3">
            <div className="px-3 pb-1.5 text-[0.6rem] uppercase tracking-[0.16em] opacity-60">Switch Portal</div>
            <div className="grid grid-cols-4 gap-1">
              {PORTALS.map((p) => (
                <button key={p.key} title={p.label} onClick={() => onSwitchPortal(p.key)}
                  className={`border py-1.5 text-sm transition-colors ${portal === p.key ? 'border-swiss-red bg-swiss-red' : 'border-white/25 hover:border-swiss-red hover:bg-white/10'}`}>
                  {p.icon}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="px-3 pb-4">
          <button className="w-full border border-white px-3 py-2 text-[0.7rem] font-bold uppercase tracking-widest hover:border-swiss-red hover:bg-swiss-red" onClick={onSignOut}>Sign Out</button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* mobile top header */}
        <header className="sticky top-0 z-40 border-b-[3px] border-b-swiss-red bg-black text-white lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
            <div className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <span className="inline-block h-3.5 w-3.5 bg-swiss-red" /> ACE
              <span className="sw-label hidden md:inline" style={{ color: 'rgba(255,255,255,0.7)' }}>{meta.icon} {meta.label}</span>
            </div>
            <div className="flex items-center gap-3 text-[0.7rem] font-bold uppercase tracking-widest">
              <span className="opacity-80">{user?.full_name ?? meta.label}</span>
              <button className="border border-white px-3 py-1.5 hover:border-swiss-red hover:bg-swiss-red" onClick={onSignOut}>Sign Out</button>
            </div>
          </div>
        </header>
        <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5">{children}</main>
      </div>
      <AICoach />

      {/* mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-black bg-white dark:bg-dark-card lg:hidden">
        <div className="mx-auto flex overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} onClick={() => onTab(t)}
              className={`flex-1 whitespace-nowrap border-t-[3px] px-3 py-2.5 text-[0.68rem] font-extrabold uppercase tracking-widest ${active === t ? 'border-t-swiss-red text-swiss-red' : 'border-t-transparent'}`}>
              {t}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

/* ============================ learner portal ============================ */

export function LearnerPortal({ user, onSignOut, onSwitchPortal }: { user: { full_name: string } | null; onSignOut: () => void; onSwitchPortal?: (p: PortalKey) => void }) {
  const [tab, setTab] = useState('Dashboard')
  const [d, setD] = useState<any>(null)
  const [gap, setGap] = useState<any>(null)
  const [catalog, setCatalog] = useState<CatalogCourse[] | null>(null)
  const [outcomes, setOutcomes] = useState<any>(null)
  const [apps, setApps] = useState<any[]>([])
  const [applied, setApplied] = useState<Record<string, boolean>>({})
  const [goalOpen, setGoalOpen] = useState(false)
  const { toast, say } = useToast()
  const refresh = () => { api.learnerDashboard().then(setD).catch(() => {}); api.learnerApplications().then((r) => { setApps(r.applications); setApplied(Object.fromEntries(r.applications.map((a: any) => [a.company_name, true]))) }).catch(() => {}) }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (tab === 'Analytics & Gaps') api.learnerGapMatrix().then(setGap).catch(() => {})
    if (tab === 'Course Catalog' && !catalog) api.learnerCatalog().then((r) => setCatalog(r.catalog)).catch(() => {})
    if (tab === 'Career Outcomes' && !outcomes) api.learnerOutcomes().then(setOutcomes).catch(() => {})
  }, [tab, catalog, outcomes])

  async function apply(j: any) {
    try {
      const r = await api.learnerApply({ company: j.name, role: 'Software Engineer', ctc_band: j.ctc, match: Math.round(j.match) })
      setApplied((s) => ({ ...s, [j.name]: true }))
      say(r.message)
    } catch (e: any) {
      if (e.status === 409) { setApplied((s) => ({ ...s, [j.name]: true })); say(`Already applied to ${j.name}`) }
      else say(e.message)
    }
  }

  async function enroll(title: string, provider: string, weeks: number, hours: number, mode: string) {
    try {
      const r = await api.learnerEnroll({ course_title: title, provider, weeks, hours, mode })
      setGap((g: any) => g && { ...g, recommendations: g.recommendations.map((x: any) => (x.title === title ? { ...x, enrolled: true } : x)) })
      setCatalog((c) => c && c.map((x) => (x.title === title ? { ...x, enrolled: true } : x)))
      refresh()
      say(r.message)
    } catch (e: any) {
      if (e.status === 409) { say(`Already enrolled in ${title}`); setCatalog((c) => c && c.map((x) => (x.title === title ? { ...x, enrolled: true } : x))) }
      else say(e.message)
    }
  }

  return (
    <PortalShell portal="learner" user={user} onSignOut={onSignOut} onSwitchPortal={onSwitchPortal}
      tabs={['Dashboard', 'Job Marketplace', 'Start Assessment', 'Analytics & Gaps', 'Roadmaps', 'Course Catalog', 'Career Outcomes']}
      active={tab} onTab={setTab}>
      {!d ? <Spinner /> : tab === 'Dashboard' && (
        <>
          {(() => {
            const j = d.journey || { assessed: false, enrolled: false, applied: false }
            const steps = [
              { key: 'assessed', label: 'Take your skill assessment', tab: 'Start Assessment', done: j.assessed, meta: j.assessments ? `${j.assessments} completed${j.last_score != null ? ` · last ${j.last_score} pts` : ''}` : '10-question capability matrix' },
              { key: 'enrolled', label: 'Enroll in a gap-solving course', tab: 'Course Catalog', done: j.enrolled, meta: j.enrollments ? `${j.enrollments} active enrollment${j.enrollments > 1 ? 's' : ''}` : 'from your gap analysis' },
              { key: 'applied', label: 'Apply to a matched job', tab: 'Job Marketplace', done: j.applied, meta: j.applications ? `${j.applications} application${j.applications > 1 ? 's' : ''} in pipeline` : 'TF-matched companies waiting' },
            ]
            const next = steps.find((s) => !s.done)
            return (
              <Panel title="Your Path to Placement — Next Best Action" num="00" right={<span className="sw-label">{steps.filter((s) => s.done).length}/3 complete</span>}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {steps.map((s, i) => (
                    <button key={s.key} onClick={() => setTab(s.tab)}
                      className={`sw-surface p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-swiss-red ${next === s ? 'border-swiss-red' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="sw-label">Step {i + 1}</span>
                        <span className={`text-base font-black ${s.done ? 'text-black dark:text-white' : 'text-swiss-soft'}`}>{s.done ? '✓' : '○'}</span>
                      </div>
                      <div className={`mt-1 text-[0.8rem] font-black uppercase ${next === s ? 'text-swiss-red' : ''}`}>{s.label}</div>
                      <div className="sw-muted mt-0.5 text-[0.68rem]">{s.meta}</div>
                    </button>
                  ))}
                </div>
                <div className="sw-label mt-3">→ Up next: {next ? `${next.label} — ${next.meta}` : 'All steps complete. Keep retaking assessments to raise your readiness factor.'}</div>
              </Panel>
            )
          })()}
          <Panel title={`Welcome back, ${d.name}`} right={<span className="sw-label">{d.progress_pct}% Overall Progress</span>}>
            <div className="grid gap-3 sm:grid-cols-3">
              <KPI val={`${d.progress_pct}%`} sub="Overall Progress" />
              <KPI val={`${d.attendance_pct}%`} sub={`Attendance · ${d.attendance_note}`} />
              <KPI val={`${d.profile_complete}%`} sub="Profile Complete (Verified)" />
            </div>
            <div className="sw-surface mt-3 flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <div className="sw-label">Rank (Masked)</div>
                <div className="text-sm font-black uppercase">{d.rank_masked.status} — {d.rank_masked.challenges_done}/{d.rank_masked.challenges_total} recovery challenges · {d.rank_masked.days_left} days left</div>
              </div>
              <button className="sw-btn-red px-4 py-2 text-xs" onClick={() => { setTab('Start Assessment'); say('Rank recovery: complete the skill assessment to rebuild your standing') }}>Get Back on Track →</button>
            </div>
            <div className="sw-surface mt-3 p-3">
              <div className="sw-label">🎯 Target Career Destination</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-black uppercase">{d.target.role}</div>
                  <div className="sw-muted text-xs">Study: {d.target.college} · Wage Target: <b>{d.target.wage}</b></div>
                </div>
                <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => setGoalOpen(true)}>Edit Goal</button>
              </div>
            </div>
          </Panel>

          <Panel title="Direct Hiring Pipeline — Recommended Career Opportunities" num="A" right={<span className="sw-label">{d.jobs.length} openings</span>}>
            <div className="grid gap-2">
              {d.jobs.map((j: any, i: number) => (
                <div key={i} className="sw-surface flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="sw-label">{j.type} · {j.ctc}</div>
                    <div className="text-sm font-black uppercase">{j.name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-swiss-red">{Math.round(j.match)}%</span>
                    {applied[j.name] ? (
                      <span className="border border-black px-3 py-1.5 text-[0.7rem] font-bold uppercase dark:border-white">Applied ✓</span>
                    ) : (
                      <button className="sw-btn px-3 py-1.5 text-[0.7rem]" onClick={() => apply(j)}>View & Apply</button>
                    )}
                  </div>
                  {j.why && (
                    <div className="mt-2 w-full border-t border-swiss-soft pt-2">
                      <div className="sw-label">WHY THIS MATCH — {j.why.band?.toUpperCase()} BAND · assessed score {j.why.assessed_score}</div>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {([['Readiness', j.why.readiness], ['Track fit', j.why.track_fit], ['Salary band', j.why.salary_band]] as const).map(([label, v]) => (
                          <div key={label}>
                            <div className="flex justify-between text-[0.62rem] font-bold uppercase tracking-wider"><span>{label}</span><span>{v}%</span></div>
                            <div className="h-1.5 border border-black bg-white dark:border-white dark:bg-dark-surface"><div className="h-full bg-swiss-red" style={{ width: `${v}%` }} /></div>
                          </div>
                        ))}
                      </div>
                      <button className="sw-btn-ghost mt-2 px-2 py-1 text-[0.62rem]" onClick={() => { setTab('Roadmaps'); setTimeout(() => { const inp = document.querySelector('input[placeholder*="placement DB"]') as HTMLInputElement | null; if (inp) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!; setter.call(inp, j.name); inp.dispatchEvent(new Event('input', { bubbles: true })); } }, 300) }}>🏢 {j.name} Playbook →</button>
                      <JobFitAI name={j.name} why={j.why} ctc={j.ctc} difficulty={j.difficulty} skills={j.skills} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Enrolled Courses & Active Progress" num="B">
              <div className="grid gap-2">
                {d.courses.map((c: any) => (
                  <div key={c.enr} className="sw-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="sw-label">{c.level} · {c.enr}</span>
                      <span className="text-[0.7rem] font-black">Score {c.score}/100</span>
                    </div>
                    <div className="mt-1 text-sm font-black uppercase">{c.title}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 border border-black bg-white dark:border-white dark:bg-dark-surface"><div className="h-full bg-swiss-red" style={{ width: `${c.progress}%` }} /></div>
                      <span className="text-[0.7rem] font-bold">{c.progress}%</span>
                      <button className="sw-btn-ghost px-2 py-1 text-[0.65rem]" onClick={() => say(`Resuming ${c.course_title} — next module: ${c.progress_pct < 50 ? 'core practice sets' : 'capstone project'}`)}>Resume</button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Skills & Gaps" num="C">
              <div className="sw-label mb-1">Strengths</div>
              <div className="grid gap-1.5">
                {d.strengths.map((s: any) => (
                  <div key={s.skill} className="grid grid-cols-[1fr_44px] items-center gap-2 text-[0.78rem]">
                    <span>{s.skill} <span className="sw-muted">({s.domain})</span></span><b className="text-right">{s.pct}%</b>
                  </div>
                ))}
              </div>
              <div className="sw-label mt-3 mb-1">Skill Gaps & Weaknesses</div>
              <div className="grid gap-1.5">
                {d.gaps.map((s: any) => (
                  <div key={s.skill} className="grid grid-cols-[1fr_44px] items-center gap-2 text-[0.78rem]">
                    <span>{s.skill} <span className="sw-muted">({s.domain})</span></span><b className="text-right text-swiss-red">{s.pct}%</b>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="Upcoming Tests" num="D" right={<span className="sw-label">{d.tests.length} scheduled</span>}>
            <div className="grid gap-2 md:grid-cols-3">
              {d.tests.map((t: any) => (
                <div key={t.title} className="sw-surface p-3">
                  <div className="text-[0.8rem] font-black uppercase">{t.title}</div>
                  <div className="sw-muted mt-1 text-[0.7rem]">{t.date} • {t.minutes} Minutes</div>
                </div>
              ))}
            </div>
          </Panel>
          <ActivityFeed tab={tab} onTab={setTab} />
        </>
      )}

      {tab === 'Analytics & Gaps' && (
        !gap ? <Spinner /> : (
          <>
            <Panel title="Skill Gap & Career Readiness Matrix" right={<span className="sw-label">Target Role: {gap.target_role}</span>}>
              <div className="grid gap-3 sm:grid-cols-3">
                <KPI val={gap.target_role} sub="Target Role" />
                <KPI val={gap.market_demand} sub="Market Demand" />
                <KPI val={gap.wage_band} sub="Target Wage Band" />
              </div>
              <div className="mt-3 grid gap-2">
                {gap.domains.map((dom: any) => (
                  <div key={dom.domain} className="sw-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase">{dom.domain}</span>
                      <span className={`text-sm font-black ${dom.current >= dom.required ? 'text-black dark:text-white' : 'text-swiss-red'}`}>
                        {dom.current}/10 (Req: {dom.required})
                      </span>
                    </div>
                    <div className="sw-muted mt-0.5 text-[0.72rem]">{dom.topics}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="h-2 border border-black bg-white dark:border-white dark:bg-dark-surface"><div className="h-full bg-black dark:bg-white" style={{ width: `${dom.current * 10}%` }} /></div>
                      <div className="h-2 border border-swiss-red bg-white dark:bg-dark-surface"><div className="h-full bg-swiss-red" style={{ width: `${dom.required * 10}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Personalized Training Recommendations" num="E">
              <div className="grid gap-2">
                {gap.recommendations.map((r: any) => (
                  <div key={r.rank} className="sw-surface border-l-4 border-l-swiss-red p-3">
                    <div className="sw-label">Priority #{r.rank} Recommendation — {r.weeks} Weeks ({r.hours} Hours)</div>
                    <div className="mt-1 text-sm font-black uppercase">{r.title}</div>
                    <div className="sw-muted mt-0.5 text-[0.72rem]">{r.provider} • Mode: {r.mode} • {r.modules} Modules</div>
                    {r.enrolled || applied[`enrolled:${r.title}`] ? (
                      <span className="sw-btn mt-2 inline-block px-3 py-1.5 text-[0.7rem]">Enrolled ✓</span>
                    ) : (
                      <button className="sw-btn mt-2 px-3 py-1.5 text-[0.7rem]" onClick={() => enroll(r.title, r.provider, r.weeks, r.hours, r.mode)}>Enroll in Course</button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )
      )}

      {tab === 'Job Marketplace' && d && (
        <Panel title="Job Marketplace" right={<span className="sw-label">{d.jobs.length} verified openings</span>}>
          <div className="grid gap-2 md:grid-cols-2">
            {d.jobs.map((j: any, i: number) => (
              <div key={i} className="sw-surface p-3 transition-transform duration-300 hover:-translate-y-0.5 hover:border-swiss-red">
                <div className="sw-label">{j.type} · {j.difficulty}</div>
                <div className="mt-1 text-sm font-black uppercase">{j.name}</div>
                <div className="sw-muted text-[0.72rem]">{j.ctc} · {j.rounds}</div>
                <div className="sw-muted text-[0.7rem]">Skills: {j.skills}</div>
                <div className="mt-2 flex items-center justify-between">
                  <b className="text-swiss-red">{Math.round(j.match)}% Match</b>
                  {applied[j.name] ? (
                    <span className="border border-black px-3 py-1.5 text-[0.7rem] font-bold uppercase dark:border-white">Applied ✓</span>
                  ) : (
                    <button className="sw-btn px-3 py-1.5 text-[0.7rem]" onClick={() => apply(j)}>Apply Now</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {apps.length > 0 && (
            <div className="mt-4">
              <div className="sw-label mb-2">YOUR APPLICATIONS — LIVE STATUS:</div>
              <div className="grid gap-2">
                {apps.map((a: any) => (
                  <div key={a.id} className="sw-surface flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="text-sm font-black uppercase">{a.company_name} <span className="sw-muted font-medium">· {a.role}</span></span>
                    <span className="flex items-center gap-2">
                      {a.interview_at && <span className="border-2 border-black px-2 py-1 text-[0.65rem] font-bold uppercase dark:border-white">📅 Interview {new Date(a.interview_at).toLocaleDateString()} {new Date(a.interview_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      <span className="border border-swiss-red px-2 py-1 text-[0.65rem] font-bold uppercase text-swiss-red">{a.stage} · {a.applied_on}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}
      {tab === 'Roadmaps' && <RoadmapsBrowser />}
      {tab === 'Start Assessment' && <AssessmentRunner onScored={() => api.learnerDashboard().then(setD).catch(() => {})} />}
      {tab === 'Course Catalog' && (
        !catalog ? <Spinner /> : (
          <Panel title="Course Catalog — MSSDS Verified Training Partners" right={<span className="sw-label">{catalog.length} programs</span>}>
            <div className="grid gap-3 md:grid-cols-2">
              {catalog.map((c) => (
                <div key={c.id} className="sw-surface p-4 transition-transform duration-300 hover:-translate-y-0.5 hover:border-swiss-red">
                  <div className="sw-label">{c.cat} · {c.weeks} Weeks · {c.hours} Hrs · {c.mode}</div>
                  <h3 className="mt-1 text-base font-black uppercase">{c.title}</h3>
                  <p className="sw-muted mt-1 text-[0.78rem]">{c.provider} — {c.modules.join(' → ')}</p>
                  <div className="sw-label mt-2">Skills mapped: {c.skills}</div>
                  <div className="mt-3">
                    {c.enrolled ? (
                      <span className="border border-black px-3 py-1.5 text-[0.7rem] font-bold uppercase dark:border-white">Enrolled ✓</span>
                    ) : (
                      <button className="sw-btn px-3 py-1.5 text-[0.7rem]" onClick={() => enroll(c.title, c.provider, c.weeks, c.hours, c.mode)}>Enroll Now</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )
      )}
      {tab === 'Career Outcomes' && (
        !outcomes ? <Spinner /> : (
          <>
            <Panel title="Career Outcomes — Longitudinal Evidence Loop" num="06">
              <div className="grid gap-3 sm:grid-cols-4">
                <KPI val={String(outcomes.stats.total)} sub="Outcome Records" />
                <KPI val={String(outcomes.stats.placed)} sub="Placed" />
                <KPI val={`${outcomes.stats.placement_rate}%`} sub="Placement Rate" />
                <KPI val={`₹${outcomes.stats.avg_ctc} LPA`} sub="Avg CTC (Verified)" />
              </div>
              <div className="mt-3 grid gap-2">
                {outcomes.path.map((p: any) => (
                  <div key={p.stage} className="sw-surface flex items-center justify-between gap-3 p-3">
                    <div>
                      <div className="text-sm font-black uppercase">{p.stage}</div>
                      <div className="sw-muted text-[0.72rem]">{p.detail}</div>
                    </div>
                    <span className={`text-lg font-black ${p.done ? 'text-black dark:text-white' : 'text-swiss-soft'}`}>{p.done ? '✓' : '○'}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="TF Skill-Demand Forecast — Where the Market Is Heading" num="07">
              <div className="grid gap-2 md:grid-cols-2">
                {outcomes.skills.map((s: any) => (
                  <div key={s.skill} className="sw-surface p-3">
                    <div className="flex items-center justify-between text-[0.78rem] font-bold"><span>{s.skill}</span><span className="text-swiss-red">+{(s.forecast - s.current).toFixed(1)}%</span></div>
                    <div className="mt-2 h-2 border border-black bg-white dark:border-white dark:bg-dark-surface"><div className="h-full bg-swiss-red transition-all duration-700" style={{ width: `${s.current}%` }} /></div>
                    <div className="sw-label mt-1">Demand index {s.current} → forecast {s.forecast}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="sw-label">Exports: <a className="underline" href={api.exportUrl('csv')}>CSV / Excel ↓</a> · <a className="underline" href={api.exportUrl('json')} target="_blank" rel="noreferrer">JSON ↓</a></div>
                <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => { window.location.href = '/app/?workspace' }}>Open Full ACE Workspace →</button>
              </div>
            </Panel>
          </>
        )
      )}
      {goalOpen && d && (
        <GoalModal initial={{ role: d.target.role, wage: d.target.wage, college: d.target.college }} onClose={() => setGoalOpen(false)}
          onSave={async (g) => { const r = await api.learnerGoal(g); setGoalOpen(false); refresh(); say(r.message) }} />
      )}
      {toast}
    </PortalShell>
  )
}

/* ============================ roadmaps (languages · tracks · companies) ============================ */

function StageList({ stages }: { stages: Array<{ stage: string; weeks: number; topics: string[]; project: string; checkpoint: string }> }) {
  const total = stages.reduce((a, s) => a + s.weeks, 0)
  return (
    <div>
      <div className="sw-label mb-2">{stages.length} STAGES · ~{total} WEEKS TOTAL:</div>
      <div className="grid gap-2">
        {stages.map((s, i) => (
          <div key={s.stage} className="sw-surface border-l-4 border-l-swiss-red p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.82rem] font-black uppercase">{i + 1}. {s.stage}</span>
              <span className="border border-black px-2 py-0.5 text-[0.62rem] font-bold uppercase dark:border-white">{s.weeks} weeks</span>
            </div>
            <ul className="mt-1.5 grid gap-0.5">
              {s.topics.map((t) => <li key={t} className="sw-muted text-[0.74rem]">▸ {t}</li>)}
            </ul>
            <div className="mt-1.5 text-[0.7rem]"><b>Build:</b> {s.project} <span className="sw-muted">· <b>Checkpoint:</b> {s.checkpoint}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoadmapsBrowser() {
  const [langs, setLangs] = useState<LanguageMeta[] | null>(null)
  const [tracks, setTracks] = useState<TrackMeta[] | null>(null)
  const [lang, setLang] = useState<LanguageDetail | null>(null)
  const [track, setTrack] = useState<TrackDetail | null>(null)
  const [company, setCompany] = useState<CompanyRoadmap | null>(null)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyErr, setCompanyErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'languages' | 'tracks' | 'company'>('languages')

  useEffect(() => {
    api.languages().then((r) => setLangs(r.languages)).catch(() => setLangs([]))
    api.skillTracks().then((r) => setTracks(r.tracks)).catch(() => setTracks([]))
  }, [])

  async function openLang(slug: string) {
    setTrack(null); setCompany(null); setLang(await api.languageDetail(slug))
  }
  async function openTrack(slug: string) {
    setLang(null); setCompany(null); setTrack(await api.trackDetail(slug))
  }
  async function openCompany() {
    if (!companyQuery.trim()) return
    setLang(null); setTrack(null); setCompanyErr(null)
    try { setCompany(await api.companyRoadmap(companyQuery.trim())) } catch (e: any) { setCompany(null); setCompanyErr(e.message) }
  }
  async function openCompanyName(name: string) {
    setCompanyQuery(name); setLang(null); setTrack(null); setCompanyErr(null)
    try { setCompany(await api.companyRoadmap(name)) } catch (e: any) { setCompany(null); setCompanyErr(e.message) }
  }

  return (
    <>
      <Panel title="Career Roadmaps — Languages · Skill Tracks · Company Playbooks" num="R">
        <div className="flex flex-wrap gap-2">
          {(['languages', 'tracks', 'company'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`border-2 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-widest ${mode === m ? 'border-swiss-red bg-swiss-red text-white' : 'border-black hover:border-swiss-red dark:border-white'}`}>
              {m === 'languages' ? `🐍 Languages (${langs?.length ?? '…'})` : m === 'tracks' ? `🧩 Skill Tracks (${tracks?.length ?? '…'})` : '🏢 Company Playbooks'}
            </button>
          ))
          }
        </div>
        {mode === 'languages' && (
          !langs ? <Spinner /> : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {langs.map((l) => (
                <button key={l.slug} className="sw-surface p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-swiss-red" onClick={() => openLang(l.slug)}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{l.icon}</span>
                    <span className="text-[0.65rem] font-black text-swiss-red">{l.demand_index}</span>
                  </div>
                  <div className="mt-1 text-sm font-black uppercase">{l.name}</div>
                  <div className="sw-muted text-[0.66rem] uppercase tracking-wider">{l.family}</div>
                  <div className="sw-muted mt-1 text-[0.7rem]">{l.avg_ctc_band}</div>
                </button>
              ))}
            </div>
          )
        )}
        {mode === 'tracks' && (
          !tracks ? <Spinner /> : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {tracks.map((t) => (
                <button key={t.slug} className="sw-surface p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-swiss-red" onClick={() => openTrack(t.slug)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black uppercase">{t.icon} {t.name}</span>
                    <span className="text-[0.65rem] font-black text-swiss-red">{t.demand_index}</span>
                  </div>
                  <div className="sw-muted mt-1 text-[0.72rem]">{t.blurb}</div>
                </button>
              ))}
            </div>
          )
        )}
        {mode === 'company' && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <input className="min-w-0 flex-1 border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface"
                placeholder="Company from the placement DB — try Google, TCS, Goldman Sachs…"
                value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') openCompany() }} />
              <button className="sw-btn px-4 py-2 text-xs" onClick={openCompany}>Generate Roadmap</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Google', 'Microsoft', 'Amazon', 'TCS', 'Goldman Sachs', 'Adobe', 'Atlassian'].map((n) => (
                <button key={n} className="sw-btn-ghost px-2 py-1 text-[0.65rem]" onClick={() => openCompanyName(n)}>{n}</button>
              ))}
            </div>
            {companyErr && <div className="mt-2 border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{companyErr}</div>}
          </div>
        )}
      </Panel>

      {lang && (
        <Panel title={`${lang.icon} ${lang.name} — Complete Mastery Roadmap`} right={<button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => setLang(null)}>Close ✕</button>}>
          <div className="grid gap-3 sm:grid-cols-4">
            <KPI val={String(lang.demand_index)} sub="Demand Index /100" />
            <KPI val={lang.avg_ctc_band} sub="CTC Band (Fresher → Senior)" />
            <KPI val={String(lang.roadmap.reduce((a, s) => a + s.weeks, 0)) + ' wks'} sub="Zero → Interview-Ready" />
            <KPI val={lang.roles[0]} sub="Top Role It Unlocks" />
          </div>
          <p className="sw-muted mt-3 text-[0.8rem]">{lang.blurb}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="sw-surface p-3">
              <div className="sw-label mb-1">WHERE IT'S USED</div>
              <div className="grid gap-0.5">{lang.use_cases.map((u) => <div key={u} className="text-[0.76rem]">▸ {u}</div>)}</div>
              <div className="sw-label mt-3 mb-1">CORE SKILLS CHECKLIST</div>
              <div className="grid gap-0.5">{lang.core_skills.map((u) => <div key={u} className="text-[0.76rem]">✓ {u}</div>)}</div>
            </div>
            <div className="sw-surface p-3">
              <div className="sw-label mb-1">ROLES IT UNLOCKS</div>
              <div className="flex flex-wrap gap-1.5">{lang.roles.map((r) => <span key={r} className="border border-black px-2 py-1 text-[0.68rem] font-bold dark:border-white">{r}</span>)}</div>
            </div>
          </div>
          <div className="mt-3"><StageList stages={lang.roadmap} /></div>
        </Panel>
      )}

      {track && (
        <Panel title={`${track.icon} ${track.name} — Track Roadmap`} right={<button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => setTrack(null)}>Close ✕</button>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI val={String(track.demand_index)} sub="Demand Index /100" />
            <KPI val={String(track.roadmap.reduce((a, s) => a + s.weeks, 0)) + ' wks'} sub="Zero → Interview-Ready" />
            <KPI val={track.unlocks[0]} sub="Key Unlock" />
          </div>
          <p className="sw-muted mt-3 text-[0.8rem]">{track.blurb}</p>
          <div className="sw-label mt-3 mb-1">UNLOCKS:</div>
          <div className="flex flex-wrap gap-1.5">{track.unlocks.map((u) => <span key={u} className="border border-black px-2 py-1 text-[0.68rem] font-bold dark:border-white">{u}</span>)}</div>
          <div className="mt-3"><StageList stages={track.roadmap} /></div>
        </Panel>
      )}

      {company && (
        <Panel title={`🏢 ${company.company} — Company Playbook`} right={<button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => setCompany(null)}>Close ✕</button>}>
          <div className="grid gap-3 sm:grid-cols-4">
            <KPI val={company.difficulty_cat} sub={`Difficulty ${company.difficulty_pct}/100`} />
            <KPI val={company.ctc_band} sub="Fresher CTC Band" />
            <KPI val={`${company.total_weeks} wks`} sub="Prep Timeline" />
            <KPI val={company.type} sub="Company Type" />
          </div>
          <div className="sw-label mt-3">PROCESS: {company.rounds_desc} · KEY SKILLS: {company.key_skills.join(', ')}</div>
          <div className="mt-3"><StageList stages={company.roadmap} /></div>
        </Panel>
      )}
    </>
  )
}

/* ============================ learner assessment (real TensorFlow flow) ============================ */

const QUIZ_LANGS = ['Java', 'Python', 'C++', 'C', 'JavaScript', 'TypeScript', 'SQL', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'R', 'Scala', 'Dart', 'Bash', 'C#']

function TopicRow({ t, lang }: { t: { topic: string; correct: number; total: number; pct: number }; lang: string }) {
  const [ai, setAi] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function explain() {
    setBusy(true); setErr(null)
    try {
      const r = await api.aiCoach('explain', [{ role: 'user', content: `I scored ${t.correct}/${t.total} on "${t.topic}" questions in a ${lang} placement assessment. Explain this topic simply and how to master it.` }], `language=${lang}; topic=${t.topic}; score=${t.pct}%`)
      setAi(r.reply)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="sw-surface p-3">
      <div className="flex items-center justify-between text-[0.8rem] font-bold">
        <span>{t.topic}</span>
        <span className="flex items-center gap-2">
          <span className={t.pct >= 80 ? '' : t.pct >= 60 ? 'text-swiss-mid' : 'text-swiss-red'}>{t.correct}/{t.total} · {t.pct}%</span>
          <button className="sw-btn-ghost px-2 py-0.5 text-[0.6rem]" disabled={busy} onClick={explain}>{busy ? 'AI…' : '🤖 AI Explain'}</button>
        </span>
      </div>
      <div className="mt-2 h-2 border border-black bg-white dark:border-white dark:bg-dark-surface">
        <div className={`h-full transition-all duration-700 ${t.pct >= 60 ? 'bg-black dark:bg-white' : 'bg-swiss-red'}`} style={{ width: `${t.pct}%` }} />
      </div>
      <div className="sw-label mt-1">{t.pct >= 80 ? 'Strong — maintain' : t.pct >= 60 ? 'Borderline — practice more' : 'Weak — priority fix via Roadmaps'}</div>
      {ai && <div className="mt-2 border-l-4 border-l-swiss-red bg-swiss-surface p-2.5 text-[0.76rem] leading-snug dark:bg-dark-surface">🤖 {ai}</div>}
      {err && <div className="mt-1 text-[0.65rem] font-bold uppercase text-swiss-red">{err}</div>}
    </div>
  )
}

function AIStudyPlan({ score, weak, strong, lang }: { score: number; weak: string[]; strong: string[]; lang: string }) {
  const [plan, setPlan] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function generate() {
    setBusy(true); setErr(null)
    try {
      const r = await api.aiPlan({
        candidate_name: 'Rohan Sharma', degree: 'B.Tech CSE/IT', cgpa: 7.5,
        primary_lang: lang, target_track: 'Tier 1A Service',
        score, weak_topics: weak.length ? weak : ['general revision'], strong_topics: strong,
      })
      setPlan(r.plan)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div>
      <button className="sw-btn mt-3 px-4 py-2 text-xs" disabled={busy} onClick={generate}>{busy ? '🤖 AI is building your day-by-day plan…' : '🤖 Generate AI Study Plan (fixes weak topics day-by-day)'}</button>
      {err && <div className="mt-2 text-[0.68rem] font-bold uppercase text-swiss-red">{err}</div>}
      {plan && (
        <div className="mt-3">
          <div className="sw-label">{plan.level} TRACK · {plan.total_weeks} WEEKS</div>
          <p className="mt-1 border-l-4 border-l-swiss-red bg-swiss-surface p-2.5 text-[0.78rem] leading-snug dark:bg-dark-surface">🤖 {plan.plan_summary}</p>
          <div className="mt-2 grid gap-2">
            {(plan.roadmap as any[]).map((w) => (
              <div key={w.week} className="sw-surface p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.8rem] font-black uppercase">Week {w.week}: {w.focus}</span>
                  <span className="border border-black px-2 py-0.5 text-[0.6rem] font-bold uppercase dark:border-white">{(w.days || []).length} days</span>
                </div>
                <ul className="mt-1 grid gap-0.5">
                  {(w.days || []).slice(0, 7).map((d: any, i: number) => (
                    <li key={i} className="sw-muted text-[0.72rem]">Day {d.day}: {d.task} <span className="opacity-70">({d.duration_minutes} min · {d.resource})</span></li>
                  ))}
                </ul>
                <div className="mt-1 text-[0.7rem]"><b>Build:</b> {w.milestone_project} · <b>Self-test:</b> {w.assessment}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function JobFitAI({ name, why, ctc, difficulty, skills }: { name: string; why: any; ctc: string; difficulty: string; skills: string }) {
  const [ai, setAi] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function fit() {
    setBusy(true); setErr(null)
    try {
      const r = await api.aiCoach('jobfit', [{ role: 'user', content: `Candidate assessed score ${why?.assessed_score ?? '?'}%. Company ${name}: difficulty ${difficulty}, CTC ${ctc}, key skills: ${skills}. Match band: ${why?.band ?? 'n/a'} (${why?.readiness ?? '?'}% readiness).` }], `company=${name}; score=${why?.assessed_score}; difficulty=${difficulty}`)
      setAi(r.reply)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <>
      <button className="sw-btn-ghost mt-2 px-2 py-1 text-[0.62rem]" disabled={busy} onClick={fit}>{busy ? 'AI analyzing…' : `🤖 AI Fit: ${name}`}</button>
      {ai && <div className="mt-2 w-full border-l-4 border-l-swiss-red bg-swiss-surface p-2.5 text-left text-[0.74rem] leading-snug dark:bg-dark-surface">🤖 {ai}</div>}
      {err && <div className="mt-1 text-[0.65rem] font-bold uppercase text-swiss-red">{err}</div>}
    </>
  )
}

function AssessmentRunner({ onScored }: { onScored?: (r: { score: number; correct: number; total: number }) => void }) {
  const [questions, setQuestions] = useState<any[] | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ score: number; correct: number; total: number; topics?: Array<{ topic: string; correct: number; total: number; pct: number }>; byDifficulty?: Record<string, { correct: number; total: number }> } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [lang, setLang] = useState('Java')
  const setId = useRef<string | null>(null)

  async function start() {
    setBusy(true); setErr(null); setResult(null); setAnswers({}); setCurrent(0)
    try {
      const r = await api.aiQuiz({
        candidate_name: 'Rohan Sharma',
        degree: 'B.Tech CSE/IT',
        cgpa: 7.5,
        primary_lang: lang,
        target_track: 'Tier 1B Product',
      })
      setQuestions(r.questions)
      setId.current = (r as any).set_id ?? null
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  async function submit() {
    if (!questions || submitting) return
    setSubmitting(true)
    try {
      const r = await api.submitQuiz({ set_id: setId.current, answers: questions.map((q, i) => ({ question_id: Number(q.id ?? i), selected_option: answers[i] ?? -1 })) })
      const res = (r as any).result ?? {}
      const out = { score: Math.round(res.score_pct ?? 0), correct: res.correct ?? 0, total: res.total ?? questions.length, topics: res.topics, byDifficulty: res.by_difficulty }
      setResult(out)
      onScored?.({ score: out.score, correct: out.correct, total: out.total })
    } catch (e: any) {
      setErr(e.message); setQuestions(null)
    } finally { setSubmitting(false) }
  }

  if (!questions && !busy && !result && !err) {
    return (
      <Panel title="Skill Assessment — 10-Question Capability Matrix" num="02">
        <p className="sw-muted mb-4 text-sm">Standardized progressive assessment generated by the AI service. Your answers are scored, saved to PostgreSQL, and feed the Skill Gap matrix on the Analytics tab.</p>
        <div className="sw-label mb-1">ASSESSMENT LANGUAGE ({QUIZ_LANGS.length} AVAILABLE):</div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {QUIZ_LANGS.map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`border-2 px-2.5 py-1.5 text-[0.7rem] font-bold ${lang === l ? 'border-swiss-red bg-swiss-red text-white' : 'border-black hover:border-swiss-red dark:border-white'}`}>
              {l}
            </button>
          ))
          }
        </div>
        <button className="sw-btn w-full py-3" onClick={start} disabled={busy}>{busy ? `Generating ${lang} assessment…` : `Start ${lang} Assessment`}</button>
      </Panel>
    )
  }

  return (
    <Panel title="Skill Assessment in Progress" num="02" right={
      questions ? <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => { setQuestions(null); setAnswers({}); setResult(null); setErr(null); setCurrent(0) }}>Abandon</button> : null
    }>
      {busy && <Spinner />}
      {err && <div className="border border-black bg-swiss-surface px-3 py-2 text-xs font-bold uppercase text-swiss-red">{err}</div>}
      {result ? (
        <div>
          <div className="sw-surface p-6 text-center">
            <div className="text-5xl font-black">{result.score}%</div>
            <div className="sw-label mt-2">{result.correct}/{result.total} correct · server-graded · readiness factor updated · saved to PostgreSQL</div>
            <div className="mx-auto mt-4 max-w-sm"><div className="h-2.5 border border-black bg-white dark:border-white dark:bg-dark-surface"><div className={`h-full ${result.score >= 70 ? 'bg-black dark:bg-white' : 'bg-swiss-red'}`} style={{ width: `${result.score}%` }} /></div></div>
            <div className="mt-5 flex justify-center gap-2">
              <button className="sw-btn px-5 py-2.5 text-xs" onClick={start}>Retake Assessment</button>
              <button className="sw-btn-ghost px-5 py-2.5 text-xs" onClick={() => { setQuestions(null); setResult(null) }}>Back</button>
            </div>
          </div>
          {result.byDifficulty && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.entries(result.byDifficulty).map(([d, v]) => (
                <KPI key={d} val={`${v.correct}/${v.total}`} sub={`${d.charAt(0).toUpperCase() + d.slice(1)} Questions`} />
              ))}
            </div>
          )}
          {result.topics && result.topics.length > 0 && (
            <Panel title="Topic-Wise Performance — What to Fix Next" num="✓">
              <div className="grid gap-2">
                {result.topics.map((t) => (
                  <TopicRow key={t.topic} t={t} lang={lang} />
                ))}
              </div>
              {result.topics && (
                <AIStudyPlan score={result.score} weak={result.topics.filter((t) => t.pct < 60).map((t) => t.topic)} strong={result.topics.filter((t) => t.pct >= 80).map((t) => t.topic)} lang={lang} />
              )}
              {result.topics.some((t) => t.pct < 60) && (
                <button className="sw-btn-ghost mt-3 px-4 py-2 text-xs" onClick={() => { const ev = new CustomEvent('ace:navigate', { detail: 'Roadmaps' }); window.dispatchEvent(ev) }}>Fix weak topics in Roadmaps →</button>
              )}
              <div className="sw-label mt-3">Exports: <a className="underline" href={api.exportUrl('json')} target="_blank" rel="noreferrer">Download full result data ↓</a></div>
            </Panel>
          )}
        </div>
      ) : questions ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="sw-label">Question {current + 1} of {questions.length}</span>
            <span className="sw-label">{Object.keys(answers).length} answered</span>
          </div>
          <div className="mb-4 flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-1.5 flex-1 ${i === current ? 'bg-swiss-red' : answers[i] !== undefined ? 'bg-black dark:bg-white' : 'bg-swiss-soft dark:bg-dark-border'}`} />
            ))}
          </div>
          {(() => {
            const q = questions[current]
            return (
              <div className="sw-surface p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="text-sm font-bold">{current + 1}. {q.question}</div>
                  <span className={`shrink-0 border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${q.difficulty === 'hard' ? 'border-swiss-red text-swiss-red' : 'border-black text-black dark:border-white dark:text-white'}`}>{q.difficulty}</span>
                </div>
                <div className="grid gap-2">
                  {q.options.map((opt: string, oi: number) => (
                    <label key={oi} className={`flex cursor-pointer items-center gap-2.5 border-2 p-2.5 text-[0.82rem] ${answers[current] === oi ? 'border-swiss-red' : 'border-black dark:border-white'}`}>
                      <input type="radio" name={`q${current}`} checked={answers[current] === oi} onChange={() => setAnswers({ ...answers, [current]: oi })} />
                      {opt}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-between">
                  <button className="sw-btn-ghost px-4 py-2 text-xs" disabled={current === 0} onClick={() => setCurrent(current - 1)}>‹ Prev</button>
                  {current < questions.length - 1 ? (
                    <button className="sw-btn px-4 py-2 text-xs" onClick={() => setCurrent(current + 1)}>Next ›</button>
                  ) : (
                    <button className="sw-btn px-4 py-2 text-xs" disabled={Object.keys(answers).length < questions.length || submitting} onClick={submit}>
                      {submitting ? 'Grading…' : `Submit Assessment (${Object.keys(answers).length}/${questions.length})`}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      ) : null}
    </Panel>
  )
}

/* ============================ employer portal ============================ */

export function EmployerPortal({ user, onSignOut, onSwitchPortal }: { user: { full_name: string } | null; onSignOut: () => void; onSwitchPortal?: (p: PortalKey) => void }) {
  const [tab, setTab] = useState('Applicant Pipeline')
  const [d, setD] = useState<any>(null)
  const [postings, setPostings] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [loc, setLoc] = useState('Pune (Hybrid)')
  const { toast, say } = useToast()
  const refresh = () => api.employerDashboard().then(setD).catch(() => {})
  useEffect(() => { refresh() }, [])
  useEffect(() => { if (tab === 'Manage Job Postings') api.employerPostings().then((r) => setPostings(r.postings)).catch(() => {}) }, [tab, postings.length])

  async function advance(p: any, stage: string) {
    try { const r = await api.employerSetStage(p.id, stage); say(r.message); refresh() } catch (e: any) { say(e.message) }
  }
  async function schedule(p: any) {
    const when = new Date(Date.now() + 3 * 86400000).toISOString()
    try { const r = await api.employerScheduleInterview(p.id, when); say(r.message); refresh() } catch (e: any) { say(e.message) }
  }
  async function post() {
    if (!title.trim()) return
    try { const r = await api.employerCreatePosting({ title: title.trim(), location: loc, job_type: 'Private Tech & Core' }); setTitle(''); setShowForm(false); say(r.message); refresh() } catch (e: any) { say(e.message) }
  }
  return (
    <PortalShell portal="employer" user={user} onSignOut={onSignOut} onSwitchPortal={onSwitchPortal}
      tabs={['Applicant Pipeline', 'Talent Pool Discovery', 'Manage Job Postings']} active={tab} onTab={setTab}>
      {toast}
      {!d ? <Spinner /> : (
        <>
          <Panel title={`Enterprise Recruitment — ${d.recruiter}`} right={<span className="sw-label">Verified Employer</span>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <KPI val={String(d.kpi.active_openings)} sub="Active Openings" />
              <KPI val={String(d.kpi.applicants)} sub="Total Applicants" />
              <KPI val={String(d.kpi.interviews)} sub="Interviews Active" />
              <KPI val={String(d.kpi.offers)} sub="Selected / Offers" />
            </div>
          </Panel>
          {tab === 'Applicant Pipeline' && (
            <>
              <Panel title="Applicant Pipeline" num="A">
                <div className="mb-3 flex flex-wrap gap-2">
                  {d.stages.map((s: string) => (
                    <span key={s} className="border border-black px-2 py-1 text-[0.68rem] font-bold uppercase dark:border-white">
                      {s} <b className="text-swiss-red">{d.pipeline.filter((p: any) => p.stage === s).length}</b>
                    </span>
                  ))}
                </div>
                <div className="grid gap-2">
                  {d.pipeline.length === 0 && <div className="sw-muted py-6 text-center text-sm uppercase tracking-widest">No applications yet — candidates apply from the Learner portal.</div>}
                  {d.pipeline.map((p: any) => (
                    <div key={p.id} className="sw-surface flex flex-wrap items-center justify-between gap-3 p-3">
                      <div>
                        <div className="text-sm font-black uppercase">{p.candidate} <span className="sw-muted font-medium">→ {p.role}{p.company_name ? ` · ${p.company_name}` : ''}</span></div>
                        <div className="sw-label mt-0.5">Stage: {p.stage} · Applied {p.applied_on}{p.interview_at ? ` · Interview ${new Date(p.interview_at).toLocaleDateString()}` : ''}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.exam_score && <b className="text-swiss-red">Exam {p.exam_score}/100</b>}
                        <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => say(`${p.candidate}: verified exam record + TF readiness factor visible in candidate profile`)}>Profile Chat</button>
                        <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" disabled={p.stage === 'Selected'} onClick={() => advance(p, d.stages[Math.min(d.stages.indexOf(p.stage) + 1, d.stages.length - 1)])}>Advance →</button>
                        <button className="sw-btn px-3 py-1.5 text-[0.7rem]" disabled={p.stage === 'Selected' || p.stage === 'Interview'} onClick={() => schedule(p)}>Schedule Interview</button>
                      </div>
                      {p.interview_at && <div className="sw-label w-full">📅 Interview: {new Date(p.interview_at).toLocaleString()}</div>}
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {tab === 'Talent Pool Discovery' && (
            <Panel title="Talent Pool Discovery — Verified Learners" num="B">
              <div className="grid gap-2 md:grid-cols-2">
                {d.talent_pool.map((t: any) => (
                  <div key={t.name} className="sw-surface p-3 transition-transform duration-300 hover:-translate-y-0.5 hover:border-swiss-red">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase">{t.name}</span>
                      <b className="text-swiss-red">{t.match}%</b>
                    </div>
                    <div className="sw-muted mt-1 text-[0.72rem]">{t.skills.join(', ')} · {t.status}</div>
                    <button className="sw-btn-ghost mt-2 px-3 py-1.5 text-[0.7rem]" onClick={() => say(`${t.name} shortlisted — invitation sent to candidate`)}>Shortlist</button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {tab === 'Manage Job Postings' && (
            <Panel title={`Manage Job Postings (${postings.length || d.postings.length})`} num="C"
              right={<button className="sw-btn px-3 py-1.5 text-[0.7rem]" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New Posting'}</button>}>
              {showForm && (
                <div className="sw-surface mb-3 grid gap-2 p-3 md:grid-cols-[2fr_1fr_auto]">
                  <input className="border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" placeholder="Job title — e.g. Backend Engineer (Java)" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <input className="border-2 border-black bg-white px-3 py-2 text-sm font-bold outline-none focus:border-swiss-red dark:border-white dark:bg-dark-surface" placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
                  <button className="sw-btn px-4 py-2 text-xs" onClick={post}>Post Job</button>
                </div>
              )}
              <div className="grid gap-2">
                {(postings.length ? postings : d.postings).map((p: any) => (
                  <div key={p.id ?? p.title} className="sw-surface flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <div className="text-sm font-black uppercase">{p.title}</div>
                      <div className="sw-label mt-0.5">{p.job_type ?? p.type} · {p.location} · posted {p.posted_on ?? 'recently'}</div>
                    </div>
                    <span className="text-[0.72rem] font-bold">{p.applicants} applicants</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <ActivityFeed tab={tab} onTab={setTab} />
          {tab === 'Applicant Pipeline' && <AINarrativePanel portal="employer" title="AI Pipeline Summary — Recruiter Briefing" />}
        </>
      )}
    </PortalShell>
  )
}

/* ============================ government portal ============================ */

export function GovernmentPortal({ user, onSignOut, onSwitchPortal }: { user: { full_name: string } | null; onSignOut: () => void; onSwitchPortal?: (p: PortalKey) => void }) {
  const [tab, setTab] = useState('Program Overview')
  const [d, setD] = useState<any>(null)
  const [drill, setDrill] = useState<string | null>(null)
  useEffect(() => { api.governmentAnalytics().then(setD).catch(() => {}) }, [])
  return (
    <PortalShell portal="government" user={user} onSignOut={onSignOut} onSwitchPortal={onSwitchPortal}
      tabs={['Program Overview', 'District Drilldown', 'Cohort Trends', 'Policy Insights']} active={drill ? 'District Drilldown' : tab}
      onTab={(t) => { setDrill(null); setTab(t) }}>
      {!d ? <Spinner /> : (
        <>
          <Panel title="Maharashtra Skilling Intelligence — Strictly Statistical & Policy Analytics" right={<a className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" href={api.governmentExportUrl()}>Export District CSV ↓</a>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <KPI val={String(d.kpi.enrolled)} sub="Total Enrolled" />
              <KPI val={`${d.kpi.completion_pct}%`} sub="Certified Completion" />
              <KPI val={`${d.kpi.conversion_pct}%`} sub="Employed Conversion" />
              <KPI val={d.kpi.retention_6m} sub="6-Month Retention" />
            </div>
          </Panel>
          <Panel title="Maharashtra District-wise Skill & Employment Performance" right={<span className="sw-label">{d.kpi.active_districts} districts</span>}>
            <div className="overflow-x-auto border-2 border-black dark:border-white">
              <table className="w-full border-collapse text-[0.78rem]">
                <thead>
                  <tr className="bg-black text-white">
                    {['District', 'Enrolled', 'Completed', 'Completion %', 'Employed', 'Conversion %', '6M Retention', 'Avg Wage', 'Action'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.districts.map((r: any, i: number) => (
                    <tr key={r.district} className={i % 2 ? 'bg-swiss-surface dark:bg-dark-surface' : ''}>
                      <td className="px-2 py-2 font-bold">{r.district}</td>
                      <td className="px-2 py-2">{r.enrolled.toLocaleString()}</td>
                      <td className="px-2 py-2">{r.completed.toLocaleString()}</td>
                      <td className="px-2 py-2">{r.completion_pct}%</td>
                      <td className="px-2 py-2">{r.employed.toLocaleString()}</td>
                      <td className="px-2 py-2">{r.conversion_pct}%</td>
                      <td className="px-2 py-2">{r.retention_6m}</td>
                      <td className="px-2 py-2">{r.avg_wage}</td>
                      <td className="px-2 py-2"><button className="sw-btn-ghost px-2 py-1 text-[0.65rem]" onClick={() => { setDrill(r.district); document.querySelector('main')?.scrollIntoView({ behavior: 'smooth' }) }}>Deep Dive →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title={drill ? `District Deep Dive — ${drill} (Enrollment vs Employment)` : 'Cohort Trends & Longitudinal Retention'} num="B"
            right={drill ? <button className="sw-btn-ghost px-3 py-1.5 text-[0.7rem]" onClick={() => setDrill(null)}>Clear ✕</button> : undefined}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.districts} margin={{ bottom: 60 }}>
                <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" />
                <XAxis dataKey="district" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" stroke="#555555" />
                <YAxis tick={{ fontSize: 10 }} stroke="#555555" />
                <Tooltip contentStyle={{ borderRadius: 0, border: '2px solid #000' }} />
                <RBar dataKey="employed" name="Employed" fill="#FF3000" />
                <RBar dataKey="completed" name="Completed" fill="#000000" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <AINarrativePanel portal="government" title="AI Policy Narrative — MSSDS Decision Brief" />
          <Panel title="Evidence-Based Policy Insights" num="C">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="sw-surface border-l-4 border-l-swiss-red p-3"><div className="sw-label">Insight 01</div><p className="mt-1 text-[0.78rem]">Pune & Mumbai City lead conversion (85%+) — scale employer partnerships there first.</p></div>
              <div className="sw-surface border-l-4 border-l-swiss-red p-3"><div className="sw-label">Insight 02</div><p className="mt-1 text-[0.78rem]">Retention dips below 75% in Amravati & Nanded — schedule earlier follow-ups.</p></div>
              <div className="sw-surface border-l-4 border-l-swiss-red p-3"><div className="sw-label">Insight 03</div><p className="mt-1 text-[0.78rem]">Wage bands cluster ₹3–8 LPA; promote premium-skilling tracks in high-conversion districts.</p></div>
            </div>
          </Panel>
        </>
      )}
    </PortalShell>
  )
}

/* ============================ institution portal ============================ */

export function InstitutionPortal({ user, onSignOut, onSwitchPortal }: { user: { full_name: string } | null; onSignOut: () => void; onSwitchPortal?: (p: PortalKey) => void }) {
  const [tab, setTab] = useState('Batches & Attendance')
  const [d, setD] = useState<any>(null)
  const { toast, say } = useToast()
  const refresh = () => api.institutionDashboard().then(setD).catch(() => {})
  useEffect(() => { refresh() }, [])

  async function verify(b: any) {
    try { const r = await api.institutionVerifyBatch(b.id, !b.verified); say(r.message); refresh() } catch (e: any) { say(e.message) }
  }

  return (
    <PortalShell portal="institution" user={user} onSignOut={onSignOut} onSwitchPortal={onSwitchPortal}
      tabs={['Batches & Attendance', 'Outcome Feed', 'Verification']} active={tab} onTab={setTab}>
      {toast}
      {!d ? <Spinner /> : (
        <>
          <Panel title={`Institution — ${d.institution}`} right={<span className="sw-label">Verified Training Partner</span>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <KPI val={String(d.kpi.batches)} sub="Active Batches" />
              <KPI val={String(d.kpi.trainees)} sub="Trainees" />
              <KPI val={`${d.kpi.avg_attendance}%`} sub="Avg Attendance" />
              <KPI val={`${d.kpi.verified}/${d.kpi.batches}`} sub="Verified Batches" />
            </div>
          </Panel>
          {(tab === 'Batches & Attendance' || tab === 'Verification') && (
            <Panel title={tab === 'Verification' ? 'Batch Verification — MSSDS Evidence Submission' : 'Batches & Attendance Logs'} num="A"
              right={<span className="sw-label">{d.kpi.verified}/{d.kpi.batches} verified</span>}>
              <div className="overflow-x-auto border-2 border-black dark:border-white">
                <table className="w-full border-collapse text-[0.8rem]">
                  <thead><tr className="bg-black text-white">{['Batch', 'Course', 'Trainees', 'Attendance', 'Verified', 'Action'].map((h) => <th key={h} className="px-2 py-2 text-left uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody>
                    {d.batches.map((b: any, i: number) => (
                      <tr key={b.id} className={i % 2 ? 'bg-swiss-surface dark:bg-dark-surface' : ''}>
                        <td className="px-2 py-2 font-bold">{b.code}</td>
                        <td className="px-2 py-2">{b.course}</td>
                        <td className="px-2 py-2">{b.trainees}</td>
                        <td className="px-2 py-2">{b.present_pct}%</td>
                        <td className="px-2 py-2">{b.verified ? '✓' : '—'}</td>
                        <td className="px-2 py-2">
                          <button className={`px-2 py-1 text-[0.65rem] font-bold uppercase ${b.verified ? 'sw-btn-ghost' : 'sw-btn'}`} onClick={() => verify(b)}>
                            {b.verified ? 'Revoke' : 'Verify Batch'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tab === 'Verification' && <p className="sw-muted mt-3 text-[0.72rem]">Verification submits the batch's attendance evidence to MSSDS for the longitudinal outcomes loop (stages 05–08).</p>}
            </Panel>
          )}
          {tab === 'Outcome Feed' && (
            <>
              <AINarrativePanel portal="institution" title="AI Training-Quality Advisor" />
              <Panel title="Trainee Outcome Feed — Live Enrollments & Placements" num="B">
                <div className="grid gap-2">
                  {d.outcome_feed.map((o: any, i: number) => (
                    <div key={i} className="sw-surface flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="text-sm font-black uppercase">{o.trainee}</span>
                      <span className="sw-label">{o.status}{o.employer ? ` · ${o.employer}` : ''}{o.ctc ? ` · ${o.ctc}` : ''}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </PortalShell>
  )
}

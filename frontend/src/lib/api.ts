const FASTAPI = import.meta.env.VITE_FASTAPI_URL ?? ''

export interface User {
  id: string
  email: string
  full_name?: string
  role: string
}

const TOKEN_KEY = 'ace_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${FASTAPI}/api${path}`, { ...opts, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.detail || data.error || `Request failed (${res.status})`), { status: res.status, data })
  return data as T
}

// ---------------------------------------------------------------- types
export interface Predicted {
  score: number
  readinessTier: string
  salaryBand: string
  verifiedSkills: string[]
  skillGaps: string[]
  quizFactor: number | null
  ml_engine: { tensorflow: boolean; rule_score: number; ml_score: number | null; blended: boolean }
}

export interface Company {
  id: number
  name: string
  type: string
  ctc_band: string
  difficulty_pct: number
  difficulty_cat: string
  rounds_desc: string
  key_skills: string
  display_rank: number
}

// ---------------------------------------------------------------- api
export interface Outcome {
  id: number
  program_name: string
  trainee_name: string
  batch: string | null
  skills: string[] | string
  placed: boolean
  employer: string | null
  ctc_lpa: string | number | null
  completed_on: string | null
  source: string
}

export interface RoadmapStage {
  stage: string
  weeks: number
  topics: string[]
  project: string
  checkpoint: string
}
export interface LanguageMeta { slug: string; name: string; icon: string; family: string; demand_index: number; avg_ctc_band: string; blurb: string }
export interface LanguageDetail extends LanguageMeta {
  use_cases: string[]; roles: string[]; core_skills: string[]; roadmap: RoadmapStage[]
}
export interface TrackMeta { slug: string; name: string; icon: string; demand_index: number; blurb: string }
export interface TrackDetail extends TrackMeta { unlocks: string[]; roadmap: RoadmapStage[] }
export interface CompanyRoadmap {
  company: string; type: string; difficulty_cat: string; difficulty_pct: number; ctc_band: string
  rounds_desc: string; key_skills: string[]; total_weeks: number; roadmap: RoadmapStage[]
}

export interface CatalogCourse {
  id: number
  title: string
  provider: string
  cat: string
  weeks: number
  hours: number
  mode: string
  modules: string[]
  skills: string
  enrolled?: boolean
}

export const api = {
  register: (body: Record<string, unknown>) =>
    request<{ user: User; token: string; supabase: boolean }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: async (email: string, password: string) => {
    const r = await request<{ user: User; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setToken(r.token)
    return r
  },

  me: () => request<{ user: User }>('/auth/me'),
  logout: () => setToken(null),

  runAnalysis: (body: { candidate_name: string; degree: string; cgpa: number; primary_lang: string; target_track: string; quiz_score?: number | null }) =>
    request<{ analysis: Record<string, unknown> | null; predicted: Predicted; matched_companies: Array<Record<string, unknown>>; ml: Predicted['ml_engine'] }>('/analysis', { method: 'POST', body: JSON.stringify(body) }),

  history: () => request<{ analyses: Array<Record<string, unknown>> }>('/analysis/history'),

  companies: (page = 1, limit = 12, q = '', type = '') =>
    request<{ companies: Company[]; total: number; page: number; limit: number }>(`/companies?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`),

  compare: (ids: number[]) =>
    request<{ companies: Company[] }>('/companies/compare', { method: 'POST', body: JSON.stringify({ ids }) }),

  aiCoach: (kind: 'coach' | 'explain' | 'jobfit', messages: Array<{ role: 'user' | 'assistant'; content: string }>, context?: string) =>
    request<{ reply: string; kind: string }>('/ai/coach', { method: 'POST', body: JSON.stringify({ kind, messages, context }) }),

  aiNarrative: (portal: 'government' | 'employer' | 'institution') =>
    request<{ narrative: string }>(portal === 'government' ? '/portal/government/ai-insights' : `/portal/${portal}/ai-summary`),

  aiQuiz: (profile: Record<string, unknown>) =>
    request<{ questions: any[]; set_id?: string; language?: string }>('/ai/quiz', { method: 'POST', body: JSON.stringify(profile) }),

  aiPlan: (body: Record<string, unknown>) =>
    request<{ plan: any }>('/ai/plan', { method: 'POST', body: JSON.stringify(body) }),

  submitQuiz: (body: { set_id: string | null; answers: Array<{ question_id: number; selected_option: number }> }) =>
    request<{ quiz: Record<string, unknown>; result: { score_pct: number; correct: number; total: number; readiness_factor: number; by_difficulty: Record<string, { correct: number; total: number }>; topics: Array<{ topic: string; correct: number; total: number; pct: number }>; weak_topics: string[]; strong_topics: string[] } }>('/quiz', { method: 'POST', body: JSON.stringify(body) }),

  powerbiConfig: () => request<{ provider: string; configured: boolean; base_url: string | null; reports: Array<{ id: string; name: string; role: string }> }>('/powerbi/config'),

  powerbiAnalytics: () => request<{ generated_at: string; row_count: number; companies_by_type: Record<string, number>; avg_ctc_by_type: Record<string, number>; difficulty_split: Record<string, number>; region_split: Record<string, number> }>('/analytics/summary'),

  // Training outcomes (Employer / Government uploads)
  addOutcome: (body: Record<string, unknown>) =>
    request<{ outcome: Record<string, unknown> }>('/outcomes', { method: 'POST', body: JSON.stringify(body) }),
  outcomes: (q = '', placed = '') =>
    request<{ outcomes: Outcome[]; total: number }>(`/outcomes?q=${encodeURIComponent(q)}&placed=${placed}`),
  outcomeStats: () =>
    request<{ total: number; placed: number; placement_rate: number; avg_ctc: number; by_program: Record<string, number>; by_employer: Record<string, number> }>('/outcomes/stats'),

  // Predictive analytics
  forecast: () =>
    request<{ generated_at: string; model: string; skills: Array<{ skill: string; current: number; forecast: number }> }>('/forecast/skill-demand'),

  exportUrl: (fmt = 'csv') => `${FASTAPI}/api/outcomes/export?fmt=${fmt}`,

  // ---- Skill-Farming portal layer ----
  demoLogin: (portal: 'learner' | 'institution' | 'employer' | 'government') =>
    request<{ user: User & { portal: string; portal_meta: Record<string, unknown> }; token: string; demo_password: string }>(`/portal/demo-login`, { method: 'POST', body: JSON.stringify({ portal }) }),
  portalMe: () => request<{ id: string; email: string; full_name: string; role: string; portal: string; portal_meta: Record<string, unknown> }>('/portal/me'),
  portalActivity: () => request<{ items: Array<{ icon: string; title: string; detail: string; when: string; tab: string }> }>('/portal/activity'),
  demoLoginTokenOnly: (portal: 'learner' | 'institution' | 'employer' | 'government') =>
    request<{ user: User & { portal: string }; token: string }>('/portal/demo-login', { method: 'POST', body: JSON.stringify({ portal }) }),
  learnerDashboard: () => request<any>('/portal/learner/dashboard'),
  learnerGapMatrix: (role = 'Backend Developer') => request<any>(`/portal/learner/gap-matrix?role=${encodeURIComponent(role)}`),
  learnerCatalog: () => request<{ catalog: CatalogCourse[]; enrolled_count: number }>('/portal/learner/catalog'),
  learnerOutcomes: () => request<any>('/portal/learner/outcomes'),
  learnerApply: (body: { company: string; role: string; ctc_band: string; match: number }) =>
    request<{ application: any; message: string }>('/portal/learner/apply', { method: 'POST', body: JSON.stringify(body) }),
  learnerApplications: () => request<{ applications: any[] }>('/portal/learner/applications'),
  learnerEnroll: (body: { course_title: string; provider: string; weeks?: number; hours?: number; mode: string }) =>
    request<{ enrollment: any; message: string }>('/portal/learner/enroll', { method: 'POST', body: JSON.stringify(body) }),
  learnerGoal: (body: { role: string; wage: string; college: string }) =>
    request<{ goal: any; message: string }>('/portal/learner/goal', { method: 'POST', body: JSON.stringify(body) }),
  // ---- Roadmaps: languages, skill tracks, company prep plans ----
  languages: () => request<{ count: number; languages: LanguageMeta[] }>('/roadmaps/languages'),
  languageDetail: (slug: string) => request<LanguageDetail>(`/roadmaps/languages/${slug}`),
  skillTracks: () => request<{ count: number; tracks: TrackMeta[] }>('/roadmaps/tracks'),
  trackDetail: (slug: string) => request<TrackDetail>(`/roadmaps/tracks/${slug}`),
  companyRoadmap: (name: string) => request<CompanyRoadmap>(`/roadmaps/company/${encodeURIComponent(name)}`),

  employerDashboard: () => request<any>('/portal/employer/dashboard'),
  employerSetStage: (id: number, stage: string) =>
    request<{ application: any; message: string }>(`/portal/employer/applications/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) }),
  employerScheduleInterview: (id: number, when: string) =>
    request<{ application: any; message: string }>(`/portal/employer/applications/${id}/interview`, { method: 'POST', body: JSON.stringify({ when }) }),
  employerCreatePosting: (body: { title: string; location: string; job_type: string }) =>
    request<{ posting: any; message: string }>('/portal/employer/postings', { method: 'POST', body: JSON.stringify(body) }),
  employerPostings: () => request<{ postings: any[] }>('/portal/employer/postings'),
  governmentAnalytics: () => request<any>('/portal/government/analytics'),
  governmentExportUrl: () => `${FASTAPI}/api/portal/government/export`,
  institutionDashboard: () => request<any>('/portal/institution/dashboard'),
  institutionVerifyBatch: (id: number, verified: boolean) =>
    request<{ batch: any; message: string }>(`/portal/institution/batches/${id}/verify`, { method: 'POST', body: JSON.stringify({ verified }) }),

  health: () => fetch(`${FASTAPI}/api/health`).then((r) => r.json()),
}

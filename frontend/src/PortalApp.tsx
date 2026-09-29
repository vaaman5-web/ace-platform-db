import { lazy, Suspense, useEffect, useState } from 'react'
import { api, getToken } from './lib/api'
import { AuthModal, EmployerPortal, GovernmentPortal, InstitutionPortal, Landing, LearnerPortal, type PortalKey } from './portals'

// Full ACE workspace (old site) — token hand-off is shared via localStorage.
const FullWorkspace = lazy(() => import('./App'))

export default function PortalApp() {
  const [authOpen, setAuthOpen] = useState<PortalKey | null>(null)
  const [portal, setPortal] = useState<PortalKey | null>(null)
  const [user, setUser] = useState<{ full_name: string } | null>(null)
  const [booted, setBooted] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [workspace, setWorkspace] = useState(() => new URLSearchParams(window.location.search).has('workspace'))

  useEffect(() => {
    if (!getToken()) { setBooted(true); return }
    api.portalMe()
      .then((me) => { setUser(me); setPortal((me.portal as PortalKey) || 'learner') })
      .catch(() => { localStorage.removeItem('ace_token') })
      .finally(() => setBooted(true))
  }, [])

  if (!booted) {
    return <div className="grid min-h-screen place-items-center"><div className="sw-spinner" /></div>
  }

  async function switchPortal(p: PortalKey) {
    setSwitching(true)
    try {
      const r = await api.demoLoginTokenOnly(p)
      localStorage.setItem('ace_token', r.token)
      const me = await api.portalMe().catch(() => null)
      setUser(me ? { full_name: me.full_name } : { full_name: r.user.full_name ?? r.user.email })
      setPortal(p)
    } finally {
      setSwitching(false)
    }
  }

  if (switching) {
    return <div className="grid min-h-screen place-items-center"><div className="text-center"><div className="sw-spinner" /><div className="sw-label mt-3">Switching portal…</div></div></div>
  }

  if (workspace) {
    return (
      <Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="sw-spinner" /></div>}>
        <FullWorkspace />
      </Suspense>
    )
  }

  const signOut = () => { api.logout(); setPortal(null); setUser(null) }
  if (portal === 'learner') return <LearnerPortal user={user} onSignOut={signOut} onSwitchPortal={switchPortal} />
  if (portal === 'employer') return <EmployerPortal user={user} onSignOut={signOut} onSwitchPortal={switchPortal} />
  if (portal === 'government') return <GovernmentPortal user={user} onSignOut={signOut} onSwitchPortal={switchPortal} />
  if (portal === 'institution') return <InstitutionPortal user={user} onSignOut={signOut} onSwitchPortal={switchPortal} />

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b-[3px] border-b-swiss-red bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2.5">
          <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <span className="inline-block h-3.5 w-3.5 bg-swiss-red" /> ACE
            <span className="hidden text-[0.6rem] font-semibold uppercase tracking-[0.14em] opacity-75 md:inline">Skill-to-Employment Intelligence · Maharashtra · MSSDS</span>
          </h1>
          <div className="flex gap-2">
            <button className="border border-white px-4 py-1.5 text-[0.72rem] font-bold uppercase tracking-widest hover:border-swiss-red hover:bg-swiss-red" onClick={() => setAuthOpen('learner')}>Log In</button>
            <button className="bg-swiss-red px-4 py-1.5 text-[0.72rem] font-bold uppercase tracking-widest hover:bg-white hover:text-black" onClick={() => setAuthOpen('learner')}>Register</button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-4 px-5 py-5">
        <Landing onEnter={(p) => setAuthOpen(p)} onWorkspace={() => setWorkspace(true)} />
      </main>
      <footer className="border-t-[3px] border-t-swiss-red bg-black px-5 py-4 text-white">
        <div className="mx-auto max-w-7xl text-[0.7rem]">
          <b>ACE • Skill-to-Employment Intelligence Platform</b>
          <p className="opacity-80">Designed for Smart India Hackathon (SIH26135). Connecting learner capabilities, assessments, personalized training, and longitudinal outcomes.</p>
        </div>
      </footer>
      {authOpen && (
        <AuthModal initial={authOpen} onClose={() => setAuthOpen(null)}
          onAuthed={(p) => { setPortal(p); setAuthOpen(null); api.portalMe().then(setUser).catch(() => {}) }} />
      )}
    </div>
  )
}

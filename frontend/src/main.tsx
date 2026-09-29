import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PortalApp from './PortalApp.tsx'

// Portal experience (Skill-Farming style landing + role portals).
// The full ACE workspace remains at /app/ inside PortalApp via "Open Full ACE Workspace".
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
)

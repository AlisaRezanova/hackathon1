import { createBrowserRouter } from 'react-router-dom'
import { AnalyticsPage } from './features/analytics/ui'
import { InterviewsPage } from './features/interviews/ui'
import { Home } from './pages/Home'
import { AppShell } from './shared/ui/Layout'

/**
 * FROZEN seam — both feature routes are already wired in. Add new pages
 * inside a feature's own `ui.tsx`, not here. See hackathon-vibecoding-guide.md
 * ("Швы").
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'interviews', element: <InterviewsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
    ],
  },
])

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AnalyticsPage } from './features/analytics/ui'
import { InterviewsPage } from './features/interviews/ui'
import { Home } from './pages/Home'
import { AppShell, EmployeeShell } from './shared/ui/Layout'

/**
 * FROZEN seam — both feature routes are already wired in. Add new pages
 * inside a feature's own `ui.tsx`, not here. See hackathon-vibecoding-guide.md
 * ("Швы").
 *
 * Two entry points, two layouts, no backend/auth check involved — this is a
 * routing-only split so a link handed to one employee never shows them the
 * sidebar or nav into company-wide screens:
 * - `/app/*` — HR's full app (`AppShell`, sidebar with Обзор/Exit-интервью/
 *   Аналитика).
 * - `/interview/:token` — the link sent to a single employee (`EmployeeShell`,
 *   no sidebar): just their own interview chat. `:token` is not verified
 *   against the backend — see `features/interviews/ui.tsx`'s `employeeMode`.
 */
export const router = createBrowserRouter([
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'interviews', element: <InterviewsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
    ],
  },
  {
    path: '/interview/:token',
    element: <EmployeeShell />,
    children: [{ index: true, element: <InterviewsPage employeeMode /> }],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
])

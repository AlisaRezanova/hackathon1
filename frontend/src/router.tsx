import { createBrowserRouter } from 'react-router-dom'
import { RankingPage } from './features/ranking/ui'
import { TurnoverPage } from './features/turnover/ui'
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
      { path: 'ranking', element: <RankingPage /> },
      { path: 'turnover', element: <TurnoverPage /> },
    ],
  },
])

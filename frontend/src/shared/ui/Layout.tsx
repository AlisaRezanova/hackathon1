import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { checkApiHealth } from '../http'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [apiOnline, setApiOnline] = useState(true)

  useEffect(() => {
    let cancelled = false
    checkApiHealth().then((online) => {
      if (!cancelled) setApiOnline(online)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="ui-shell">
      <Sidebar apiOnline={apiOnline} />
      <div className="ui-main">
        <Outlet />
      </div>
    </div>
  )
}

/**
 * Bare layout for a link sent to a single employee (`/interview/:token`) —
 * no sidebar, no nav into the HR app's Обзор/Аналитика. See router.tsx.
 */
export function EmployeeShell() {
  return (
    <div className="ui-shell ui-shell--solo">
      <div className="ui-main">
        <Outlet />
      </div>
    </div>
  )
}

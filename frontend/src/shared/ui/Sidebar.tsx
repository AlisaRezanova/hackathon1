import { NavLink } from 'react-router-dom'

const links = [
  { to: '/app', label: 'Обзор', end: true },
  { to: '/app/interviews', label: 'Exit-интервью' },
  { to: '/app/analytics', label: 'Аналитика по компании' },
]

export function Sidebar({ apiOnline }: { apiOnline: boolean }) {
  return (
    <nav className="ui-sidebar" aria-label="Основная навигация">
      <div className="ui-sidebar__brand">
        <span className="ui-sidebar__mark">L</span>
        <div>
          <div className="ui-sidebar__title">Ledger</div>
          <div className="ui-sidebar__subtitle">HR-прототип</div>
        </div>
      </div>
      <div className="ui-sidebar__nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `ui-sidebar__link${isActive ? ' ui-sidebar__link--active' : ''}`
            }
          >
            <span className="ui-sidebar__dot" aria-hidden="true" />
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="ui-sidebar__footer">
        <span className={`ui-sidebar__status${apiOnline ? '' : ' ui-sidebar__status--down'}`} />
        {apiOnline ? 'API подключено' : 'Офлайн — показаны демоданные'}
      </div>
    </nav>
  )
}

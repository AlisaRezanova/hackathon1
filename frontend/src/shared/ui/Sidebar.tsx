import { NavLink } from 'react-router-dom'
import { Icon } from './Icons'

const links = [
  { to: '/app', label: 'Главная', end: true, icon: 'home' as const },
  { to: '/app/interviews', label: 'Интервью', icon: 'conversation' as const },
  { to: '/app/analytics', label: 'Сигналы', icon: 'analytics' as const },
]

export function Sidebar({ apiOnline }: { apiOnline: boolean }) {
  return (
    <nav className="ui-sidebar" aria-label="Основная навигация">
      <div className="ui-sidebar__brand">
        <span className="ui-sidebar__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M4 17c3.2 0 3.2-7 6.4-7s3.2 13 6.4 13S20 7 23.2 7 26.4 17 28 17" />
          </svg>
        </span>
        <div>
          <div className="ui-sidebar__title">Exit Intelligence</div>
          <div className="ui-sidebar__subtitle">Слышать причины ухода</div>
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
            <Icon name={link.icon} className="ui-sidebar__icon" />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="ui-sidebar__footer">
        <span className={`ui-sidebar__status${apiOnline ? '' : ' ui-sidebar__status--down'}`} />
        <div>
          <strong>{apiOnline ? 'Система на связи' : 'Автономный режим'}</strong>
          <span>{apiOnline ? 'AI-анализ доступен' : 'Используются демоданные'}</span>
        </div>
      </div>
    </nav>
  )
}

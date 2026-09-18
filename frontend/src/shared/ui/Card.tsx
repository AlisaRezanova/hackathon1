import type { ReactNode } from 'react'

export function Card({
  title,
  actions,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ui-card">
      {(title || actions) && (
        <div className="ui-card__header">
          {title && <h3>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ui-stat-grid">{children}</div>
}

export function StatCard({
  label,
  value,
  delta,
  down,
  onClick,
}: {
  label: string
  value: string
  delta?: string
  down?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="ui-stat-card__label">{label}</div>
      <div className="ui-stat-card__value">{value}</div>
      {delta && (
        <div className={`ui-stat-card__delta${down ? ' ui-stat-card__delta--down' : ''}`}>
          {delta}
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="ui-stat-card ui-stat-card--clickable" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="ui-stat-card">{content}</div>
}

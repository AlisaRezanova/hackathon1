import type { ReactNode } from 'react'

export function Header({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="ui-header">
      <div>
        {eyebrow && <p className="ui-header__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="ui-header__description">{description}</p>}
      </div>
      {actions && <div className="ui-header__actions">{actions}</div>}
    </header>
  )
}

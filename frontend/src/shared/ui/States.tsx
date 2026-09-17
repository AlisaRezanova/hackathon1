import type { ReactNode } from 'react'

export function LoadingState({ label = 'Загрузка данных…' }: { label?: string }) {
  return (
    <div className="ui-state" role="status">
      <div className="ui-spinner" />
      <p className="ui-state__body">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="ui-state">
      <div className="ui-state__title">{title}</div>
      {body && <p className="ui-state__body">{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Не удалось загрузить данные',
  body,
  action,
}: {
  title?: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="ui-state">
      <div className="ui-state__title">{title}</div>
      {body && <p className="ui-state__body">{body}</p>}
      {action}
    </div>
  )
}

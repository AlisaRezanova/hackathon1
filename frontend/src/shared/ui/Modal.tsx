import { useEffect, type ReactNode } from 'react'

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function Modal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEscapeToClose(onClose)
  return (
    <div className="ui-overlay" onClick={onClose} role="presentation">
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-panel__header">
          <h2>{title}</h2>
          <button className="ui-panel__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {children}
        {footer && <div className="ui-panel__footer">{footer}</div>}
      </div>
    </div>
  )
}

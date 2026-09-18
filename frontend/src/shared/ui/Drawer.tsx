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

/** Prevents the page behind the drawer from scrolling — only the drawer's
 * own content scrolls while it's open. */
function useBodyScrollLock() {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])
}

export function Drawer({
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
  useBodyScrollLock()
  return (
    <div className="ui-overlay" onClick={onClose} role="presentation">
      <div
        className="ui-drawer"
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

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from './toastContext'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      const id = nextId.current++
      setItems((prev) => [...prev, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-region" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`ui-toast${item.tone !== 'default' ? ` ui-toast--${item.tone}` : ''}`}
          >
            <span>{item.message}</span>
            <button
              className="ui-toast__close"
              onClick={() => dismiss(item.id)}
              aria-label="Скрыть"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

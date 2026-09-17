import { useEffect, useState } from 'react'
import { Header } from '../../shared/ui/Header'
import { EmptyState, LoadingState } from '../../shared/ui/States'
import { fetchTurnoverPlaceholder } from './api'

/**
 * Stub screen for the `turnover` feature seam — wired into router.tsx and
 * backend/app/main.py already. The feature owner replaces this file's
 * contents (and api.ts/types.ts/mocks.ts) with the real UI.
 */
export function TurnoverPage() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [usedMock, setUsedMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchTurnoverPlaceholder().then(({ usedMock }) => {
      if (cancelled) return
      setUsedMock(usedMock)
      setStatus('ready')
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Header eyebrow="Фича: turnover" title="Анализ причин текучести" />
      <div className="ui-content">
        {status === 'loading' ? (
          <LoadingState label="Проверка соединения с API…" />
        ) : (
          <EmptyState
            title="Экран ещё не реализован"
            body={
              usedMock
                ? 'Backend недоступен — показан локальный мок. Заглушка API отвечает по /api/turnover/ping.'
                : 'Backend отвечает на /api/turnover/ping. Замените содержимое features/turnover/ui.tsx на реальный экран.'
            }
          />
        )}
      </div>
    </>
  )
}

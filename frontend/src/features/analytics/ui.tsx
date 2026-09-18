import { useEffect, useState } from 'react'
import { Header } from '../../shared/ui/Header'
import { EmptyState, LoadingState } from '../../shared/ui/States'
import { fetchAnalyticsPlaceholder } from './api'

/**
 * Stub screen for the `analytics` feature seam — wired into router.tsx and
 * backend/app/main.py already. Alisa (feature owner) replaces this file's
 * contents (and api.ts/types.ts/mocks.ts) with the real company-wide
 * dashboard. See HACKATHON.md for the scenario.
 */
export function AnalyticsPage() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [usedMock, setUsedMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAnalyticsPlaceholder().then(({ usedMock }) => {
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
      <Header eyebrow="Фича: analytics" title="Аналитика по компании" />
      <div className="ui-content">
        {status === 'loading' ? (
          <LoadingState label="Проверка соединения с API…" />
        ) : (
          <EmptyState
            title="Экран ещё не реализован"
            body={
              usedMock
                ? 'Backend недоступен — показан локальный мок. Заглушка API отвечает по /api/analytics/ping.'
                : 'Backend отвечает на /api/analytics/ping. Замените содержимое features/analytics/ui.tsx на реальный экран.'
            }
          />
        )}
      </div>
    </>
  )
}

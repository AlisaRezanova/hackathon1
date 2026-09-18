import { useEffect, useState } from 'react'
import { Header } from '../../shared/ui/Header'
import { EmptyState, LoadingState } from '../../shared/ui/States'
import { fetchInterviewsPlaceholder } from './api'

/**
 * Stub screen for the `interviews` feature seam — wired into router.tsx and
 * backend/app/main.py already. Kostya (feature owner) replaces this file's
 * contents (and api.ts/types.ts/mocks.ts) with the real transcript ->
 * "problem passport" screen. See HACKATHON.md for the scenario.
 */
export function InterviewsPage() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [usedMock, setUsedMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchInterviewsPlaceholder().then(({ usedMock }) => {
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
      <Header eyebrow="Фича: interviews" title="Exit-интервью → паспорт проблемы" />
      <div className="ui-content">
        {status === 'loading' ? (
          <LoadingState label="Проверка соединения с API…" />
        ) : (
          <EmptyState
            title="Экран ещё не реализован"
            body={
              usedMock
                ? 'Backend недоступен — показан локальный мок. Заглушка API отвечает по /api/interviews/ping.'
                : 'Backend отвечает на /api/interviews/ping. Замените содержимое features/interviews/ui.tsx на реальный экран.'
            }
          />
        )}
      </div>
    </>
  )
}

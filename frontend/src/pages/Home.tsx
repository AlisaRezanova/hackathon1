import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAnalyticsSummary, fetchInterviews } from '../features/analytics/api'
import type { AnalyticsSummary, InterviewListItem } from '../features/analytics/types'
import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Card } from '../shared/ui/Card'
import { Icon } from '../shared/ui/Icons'
import { EmptyState, ErrorState, LoadingState } from '../shared/ui/States'
import { type Column, DataTable } from '../shared/ui/Table'

type LoadState = 'loading' | 'ready' | 'error'

const RISK_LABEL: Record<InterviewListItem['risk_zone'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const RISK_TONE: Record<InterviewListItem['risk_zone'], 'neutral' | 'amber' | 'danger'> = {
  low: 'neutral',
  medium: 'amber',
  high: 'danger',
}

const columns: Column<InterviewListItem>[] = [
  { key: 'employee_alias', header: 'Сотрудник', render: (row) => row.employee_alias },
  { key: 'position', header: 'Должность', render: (row) => row.position },
  { key: 'department', header: 'Отдел', render: (row) => row.department },
  { key: 'primary_category', header: 'Причина ухода', render: (row) => row.primary_category },
  {
    key: 'risk_zone',
    header: 'Риск',
    render: (row) => <Badge tone={RISK_TONE[row.risk_zone]}>{RISK_LABEL[row.risk_zone]}</Badge>,
  },
  { key: 'interview_date', header: 'Дата', render: (row) => row.interview_date },
]

export function Home() {
  const [state, setState] = useState<LoadState>('loading')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [interviews, setInterviews] = useState<InterviewListItem[]>([])
  const [usedMock, setUsedMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAnalyticsSummary(), fetchInterviews()])
      .then(([summaryResult, interviewsResult]) => {
        if (cancelled) return
        setSummary(summaryResult.data)
        setInterviews(interviewsResult.data)
        setUsedMock(summaryResult.usedMock || interviewsResult.usedMock)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const topReason = summary?.category_breakdown[0]
  const riskDepartment = summary?.department_risk[0]
  const recentInterviews = [...interviews]
    .sort((a, b) => (a.interview_date < b.interview_date ? 1 : -1))
    .slice(0, 5)

  return (
    <main className="home">
      <header className="home-header">
        <div>
          <p className="home-header__label">Внутренняя HR-система</p>
          <h1>Обзор exit-интервью</h1>
          <p className="home-header__description">Причины ухода и зоны риска по отделам.</p>
        </div>
        <div className="home-header__actions">
          <Badge tone={usedMock ? 'amber' : 'default'}>
            {usedMock ? 'Демоданные' : 'API подключено'}
          </Badge>
          <Link to="/app/interviews">
            <Button>Новое интервью</Button>
          </Link>
        </div>
      </header>

      {state === 'loading' && <LoadingState label="Загружаем сводку…" />}
      {state === 'error' && <ErrorState body="Не удалось загрузить данные обзора." />}

      {state === 'ready' && summary && (
        <>
          <section className="home-metrics" aria-label="Сводка">
            <div className="home-metric">
              <span>Всего интервью</span>
              <strong>{summary.total_interviews}</strong>
            </div>
            <div className="home-metric">
              <span>Основная причина</span>
              <strong>{topReason ? `${topReason.percent}%` : '—'}</strong>
              <small>{topReason?.category ?? 'Нет данных'}</small>
            </div>
            <div className="home-metric home-metric--risk">
              <span>Высокий риск</span>
              <strong>{riskDepartment ? `${riskDepartment.high_percent}%` : '—'}</strong>
              <small>{riskDepartment?.department ?? 'Нет данных'}</small>
            </div>
            <div className="home-metric">
              <span>Категорий причин</span>
              <strong>{summary.category_breakdown.length}</strong>
            </div>
          </section>

          <div className="home-grid">
            <section className="home-panel">
              <div className="home-panel__header">
                <div>
                  <h2>Основные причины ухода</h2>
                  <p>Доля от всех проведённых интервью</p>
                </div>
                <Link to="/app/analytics">Вся аналитика</Link>
              </div>
              <div className="home-reasons">
                {summary.category_breakdown.slice(0, 4).map((reason) => (
                  <div className="home-reason" key={reason.category}>
                    <div>
                      <span>{reason.category}</span>
                      <strong>{reason.percent}%</strong>
                    </div>
                    <div className="home-reason__track">
                      <span style={{ width: `${reason.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="home-panel home-attention">
              <div className="home-panel__header">
                <div>
                  <h2>Зона внимания</h2>
                  <p>Отдел с наибольшей долей высокого риска</p>
                </div>
              </div>
              <div className="home-attention__value">
                <strong>{riskDepartment?.department ?? '—'}</strong>
                <span>
                  {riskDepartment
                    ? `${riskDepartment.high} из ${riskDepartment.total} интервью с высоким риском`
                    : 'Нет данных'}
                </span>
              </div>
              <Link to="/app/analytics" className="home-attention__link">
                Открыть разбор <Icon name="arrow" />
              </Link>
            </aside>
          </div>

          <Card
            title="Последние exit-интервью"
            actions={
              <Link to="/app/analytics">
                <Button variant="ghost">Все интервью →</Button>
              </Link>
            }
          >
            {recentInterviews.length === 0 ? (
              <EmptyState
                title="Пока нет интервью"
                body="После первого exit-интервью данные появятся здесь."
              />
            ) : (
              <DataTable columns={columns} rows={recentInterviews} />
            )}
          </Card>

          <section className="home-actions" aria-label="Быстрые действия">
            <Link to="/app/interviews" className="home-action">
              <Icon name="conversation" />
              <span>
                <strong>Провести интервью</strong>
                <small>Начать новый разговор</small>
              </span>
              <Icon name="arrow" />
            </Link>
            <Link to="/app/analytics" className="home-action">
              <Icon name="analytics" />
              <span>
                <strong>Открыть аналитику</strong>
                <small>Причины, отделы и цитаты</small>
              </span>
              <Icon name="arrow" />
            </Link>
          </section>
        </>
      )}
    </main>
  )
}

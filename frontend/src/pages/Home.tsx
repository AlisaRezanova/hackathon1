import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAnalyticsSummary, fetchInterviews } from '../features/analytics/api'
import type { AnalyticsSummary, InterviewListItem } from '../features/analytics/types'
import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Card, StatCard, StatGrid } from '../shared/ui/Card'
import { Header } from '../shared/ui/Header'
import { type Column, DataTable } from '../shared/ui/Table'
import { EmptyState, ErrorState, LoadingState } from '../shared/ui/States'
import { useToast } from '../shared/ui/toastContext'

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

type LoadState = 'loading' | 'ready' | 'error'

/**
 * Landing screen: an aggregated view over the two real features (exit
 * interviews + analytics), not a synthetic demo — see fetchAnalyticsSummary
 * and fetchInterviews for the backing data.
 */
export function Home() {
  const toast = useToast()
  const [state, setState] = useState<LoadState>('loading')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [interviews, setInterviews] = useState<InterviewListItem[]>([])

  useEffect(() => {
    Promise.all([fetchAnalyticsSummary(), fetchInterviews()])
      .then(([summaryRes, interviewsRes]) => {
        setSummary(summaryRes.data)
        setInterviews(interviewsRes.data)
        setState('ready')
        if (summaryRes.usedMock || interviewsRes.usedMock) {
          toast.show('Backend недоступен — показаны демоданные', 'default')
        }
      })
      .catch(() => setState('error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const topCategory = summary?.category_breakdown
    ? [...summary.category_breakdown].sort((a, b) => b.count - a.count)[0]
    : undefined
  const riskiestDept = summary?.department_risk
    ? [...summary.department_risk].sort((a, b) => b.high_percent - a.high_percent)[0]
    : undefined
  const deptsAtRisk = summary?.department_risk.filter((d) => d.high_percent > 0).length ?? 0
  const recentInterviews = [...interviews]
    .sort((a, b) => (a.interview_date < b.interview_date ? 1 : -1))
    .slice(0, 5)

  return (
    <>
      <Header
        eyebrow="Ledger · HR-прототип"
        title="Обзор"
        actions={
          <>
            <Link to="/interviews">
              <Button variant="secondary">Начать exit-интервью</Button>
            </Link>
            <Link to="/analytics">
              <Button>Открыть аналитику</Button>
            </Link>
          </>
        }
      />
      <div className="ui-content">
        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState body="Не удалось загрузить данные обзора." />}
        {state === 'ready' && summary && (
          <>
            <StatGrid>
              <StatCard label="Всего exit-интервью" value={String(summary.total_interviews)} />
              <StatCard
                label="Частая причина ухода"
                value={topCategory ? topCategory.category : '—'}
                delta={topCategory ? `${topCategory.percent}% интервью` : undefined}
              />
              <StatCard
                label="Самый рискованный отдел"
                value={riskiestDept ? riskiestDept.department : '—'}
                delta={riskiestDept ? `${riskiestDept.high_percent}% высокий риск` : undefined}
              />
              <StatCard label="Отделов в зоне риска" value={String(deptsAtRisk)} />
            </StatGrid>

            <div style={{ height: 20 }} />

            <Card
              title="Последние exit-интервью"
              actions={
                <Link to="/analytics">
                  <Button variant="ghost">Все интервью →</Button>
                </Link>
              }
            >
              {recentInterviews.length === 0 ? (
                <EmptyState
                  title="Пока нет интервью"
                  body="Проведите первое exit-интервью, чтобы увидеть данные здесь."
                />
              ) : (
                <DataTable columns={columns} rows={recentInterviews} />
              )}
            </Card>
          </>
        )}
      </div>
    </>
  )
}

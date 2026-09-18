import { useEffect, useState } from 'react'
import { Badge } from '../../shared/ui/Badge'
import { Card, StatCard, StatGrid } from '../../shared/ui/Card'
import { Drawer } from '../../shared/ui/Drawer'
import { Header } from '../../shared/ui/Header'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/States'
import { type Column, DataTable } from '../../shared/ui/Table'
import './analytics.css'
import { fetchAnalyticsSummary, fetchCategoryDrilldown } from './api'
import type { AnalyticsSummary, CategoryDrilldown, DepartmentRisk } from './types'

type LoadState = 'loading' | 'ready' | 'error'

function riskTone(highPercent: number): 'danger' | 'amber' | 'neutral' {
  if (highPercent >= 40) return 'danger'
  if (highPercent > 0) return 'amber'
  return 'neutral'
}

const departmentColumns: Column<DepartmentRisk & { id: string }>[] = [
  { key: 'department', header: 'Отдел', render: (row) => row.department },
  { key: 'total', header: 'Интервью', render: (row) => row.total },
  {
    key: 'low',
    header: 'Низкий риск',
    render: (row) => row.low,
  },
  {
    key: 'medium',
    header: 'Средний риск',
    render: (row) => row.medium,
  },
  {
    key: 'high',
    header: 'Высокий риск',
    render: (row) => row.high,
  },
  {
    key: 'high_percent',
    header: '% высокого риска',
    render: (row) => <Badge tone={riskTone(row.high_percent)}>{row.high_percent}%</Badge>,
  },
]

/**
 * Company-wide exit-interview dashboard: % share by top-line reason,
 * risk-zone breakdown by department, and a click-through drill-down per
 * category (subtypes + supporting quotes + a short cluster summary).
 * Reads only `ExitInterview`/`ExitAnalysis` via GET /api/analytics/*.
 */
export function AnalyticsPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [usedMock, setUsedMock] = useState(false)

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<CategoryDrilldown | null>(null)
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAnalyticsSummary()
      .then(({ data, usedMock }) => {
        if (cancelled) return
        setSummary(data)
        setUsedMock(usedMock)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openCategory(category: string) {
    setActiveCategory(category)
    setDrilldown(null)
    setDrilldownLoading(true)
    fetchCategoryDrilldown(category).then(({ data }) => {
      setDrilldown(data)
      setDrilldownLoading(false)
    })
  }

  const topCategory = summary?.category_breakdown[0]
  const riskiestDept = summary?.department_risk[0]
  const departmentRows = (summary?.department_risk ?? []).map((row) => ({
    ...row,
    id: row.department,
  }))

  return (
    <>
      <Header
        eyebrow="Фича: analytics"
        title="Аналитика по компании"
        actions={
          usedMock ? (
            <Badge tone="amber">Офлайн — демоданные</Badge>
          ) : (
            <Badge tone="default">API подключено</Badge>
          )
        }
      />
      <div className="ui-content">
        {state === 'loading' && <LoadingState label="Считаем аналитику по интервью…" />}

        {state === 'error' && (
          <ErrorState body="Не удалось загрузить аналитику. Проверьте `make back-up`." />
        )}

        {state === 'ready' && summary && (
          <>
            <StatGrid>
              <StatCard label="Всего интервью" value={String(summary.total_interviews)} />
              <StatCard
                label="Главная причина ухода"
                value={topCategory ? `${topCategory.percent}%` : '—'}
                delta={topCategory?.category}
              />
              <StatCard
                label="Отдел в зоне риска"
                value={riskiestDept ? `${riskiestDept.high_percent}%` : '—'}
                delta={riskiestDept?.department}
                down={Boolean(riskiestDept && riskiestDept.high_percent > 0)}
              />
              <StatCard
                label="Категорий причин"
                value={String(summary.category_breakdown.length)}
              />
            </StatGrid>

            <div style={{ height: 20 }} />

            <Card title="Причины ухода — доля среди всех интервью">
              {summary.category_breakdown.length === 0 ? (
                <EmptyState title="Пока нет данных" />
              ) : (
                <div className="analytics-bars">
                  {summary.category_breakdown.map((row) => (
                    <button
                      key={row.category}
                      type="button"
                      className="analytics-bar-row"
                      onClick={() => openCategory(row.category)}
                    >
                      <div className="analytics-bar-head">
                        <span className="analytics-bar-name">{row.category}</span>
                        <span className="analytics-bar-meta">
                          {row.percent}% · {row.count} интервью
                        </span>
                      </div>
                      <div className="analytics-bar-track">
                        <div
                          className="analytics-bar-fill"
                          style={{ width: `${Math.max(row.percent, 3)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <div style={{ height: 20 }} />

            <Card title="Риск ухода по отделам">
              {departmentRows.length === 0 ? (
                <EmptyState title="Пока нет данных" />
              ) : (
                <DataTable columns={departmentColumns} rows={departmentRows} />
              )}
            </Card>
          </>
        )}
      </div>

      {activeCategory && (
        <Drawer title={activeCategory} onClose={() => setActiveCategory(null)}>
          {drilldownLoading || !drilldown ? (
            <LoadingState label="Загружаем разбор категории…" />
          ) : (
            <>
              <p className="analytics-drawer-summary">{drilldown.summary}</p>

              <h3 className="analytics-section-title">Подтипы</h3>
              {drilldown.subtypes.length === 0 ? (
                <p className="analytics-empty-cell">Нет данных по подтипам.</p>
              ) : (
                <div className="analytics-subtypes">
                  {drilldown.subtypes.map((s) => (
                    <div className="analytics-subtype-row" key={s.subtype}>
                      <span>{s.subtype}</span>
                      <span className="analytics-subtype-count">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="analytics-section-title">Цитаты из интервью</h3>
              {drilldown.quotes.length === 0 ? (
                <p className="analytics-empty-cell">Нет цитат по этой категории.</p>
              ) : (
                <div className="analytics-quotes">
                  {drilldown.quotes.map((q, i) => (
                    <blockquote className="analytics-quote" key={i}>
                      <span className="analytics-quote-text">«{q.quote}»</span>
                      <span className="analytics-quote-source">
                        {q.position} · {q.department}
                      </span>
                    </blockquote>
                  ))}
                </div>
              )}
            </>
          )}
        </Drawer>
      )}
    </>
  )
}

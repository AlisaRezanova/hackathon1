import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../shared/ui/Badge'
import { Button } from '../../shared/ui/Button'
import { Card, StatCard, StatGrid } from '../../shared/ui/Card'
import { Drawer } from '../../shared/ui/Drawer'
import { Header } from '../../shared/ui/Header'
import { Modal } from '../../shared/ui/Modal'
import { EmptyState, ErrorState, LoadingState } from '../../shared/ui/States'
import { type Column, DataTable } from '../../shared/ui/Table'
import './analytics.css'
import {
  fetchAnalyticsSummary,
  fetchCategoryAdvice,
  fetchCategoryDrilldown,
  fetchDepartmentDrilldown,
  fetchInterviews,
} from './api'
import type {
  AnalyticsSummary,
  CategoryAdvice,
  CategoryDrilldown,
  DepartmentDrilldown,
  DepartmentRisk,
  InterviewListItem,
} from './types'

type LoadState = 'loading' | 'ready' | 'error'

function riskTone(highPercent: number): 'danger' | 'amber' | 'neutral' {
  if (highPercent >= 40) return 'danger'
  if (highPercent > 0) return 'amber'
  return 'neutral'
}

const RISK_ZONE_LABEL: Record<InterviewListItem['risk_zone'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const RISK_ZONE_TONE: Record<InterviewListItem['risk_zone'], 'danger' | 'amber' | 'neutral'> = {
  low: 'neutral',
  medium: 'amber',
  high: 'danger',
}

/**
 * Hover/focus tooltip. Positioned via `position: fixed` from the icon's own
 * bounding rect (not CSS `absolute` inside the ancestor) — the risk table
 * wraps in `.ui-table-wrap { overflow-x: auto }`, which also clips
 * absolutely-positioned children vertically, hiding the bubble.
 */
function InfoTip({ text }: { text: string }) {
  const iconRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function show() {
    const rect = iconRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.top, left: rect.left + rect.width / 2 })
    setOpen(true)
  }

  return (
    <span
      ref={iconRef}
      className="analytics-info-tip"
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      ⓘ
      {open && (
        <span
          className="analytics-info-tip__bubble"
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

const RISK_HEADER_HINTS: Record<'low' | 'medium' | 'high', string> = {
  low:
    'Низкий риск: сотрудник не выражал явного намерения уйти по вине компании — уход ' +
    'скорее ситуативный (переезд, личные причины и т.п.).',
  medium:
    'Средний риск: есть конкретные жалобы на процессы, рост или условия, но нет ' +
    'признаков, что решение уйти было безальтернативным.',
  high:
    'Высокий риск: сотрудник прямо указывает на системную проблему компании как причину ' +
    'ухода — таких сотрудников было бы реально удержать, если решить проблему.',
}

function departmentColumns(
  onOpenDepartment: (department: string) => void,
): Column<DepartmentRisk & { id: string }>[] {
  return [
    {
      key: 'department',
      header: 'Отдел',
      render: (row) => (
        <button
          type="button"
          className="analytics-link-btn"
          onClick={() => onOpenDepartment(row.department)}
        >
          {row.department}
        </button>
      ),
    },
    { key: 'total', header: 'Интервью', render: (row) => row.total },
    {
      key: 'low',
      header: (
        <span className="analytics-th-with-tip">
          Низкий риск
          <InfoTip text={RISK_HEADER_HINTS.low} />
        </span>
      ),
      render: (row) => row.low,
    },
    {
      key: 'medium',
      header: (
        <span className="analytics-th-with-tip">
          Средний риск
          <InfoTip text={RISK_HEADER_HINTS.medium} />
        </span>
      ),
      render: (row) => row.medium,
    },
    {
      key: 'high',
      header: (
        <span className="analytics-th-with-tip">
          Высокий риск
          <InfoTip text={RISK_HEADER_HINTS.high} />
        </span>
      ),
      render: (row) => row.high,
    },
    {
      key: 'high_percent',
      header: '% высокого риска',
      render: (row) => <Badge tone={riskTone(row.high_percent)}>{row.high_percent}%</Badge>,
    },
  ]
}

const interviewColumns: Column<InterviewListItem & { id: number }>[] = [
  { key: 'interview_date', header: 'Дата', render: (row) => row.interview_date },
  { key: 'employee_alias', header: 'Сотрудник', render: (row) => row.employee_alias },
  { key: 'position', header: 'Должность', render: (row) => row.position },
  { key: 'department', header: 'Отдел', render: (row) => row.department },
  { key: 'primary_category', header: 'Причина', render: (row) => row.primary_category },
  {
    key: 'risk_zone',
    header: 'Риск',
    render: (row) => (
      <Badge tone={RISK_ZONE_TONE[row.risk_zone]}>{RISK_ZONE_LABEL[row.risk_zone]}</Badge>
    ),
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

  const [advice, setAdvice] = useState<CategoryAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceOpen, setAdviceOpen] = useState(false)

  const [activeDepartment, setActiveDepartment] = useState<string | null>(null)
  const [departmentDrilldown, setDepartmentDrilldown] = useState<DepartmentDrilldown | null>(null)
  const [departmentLoading, setDepartmentLoading] = useState(false)

  const [interviewsOpen, setInterviewsOpen] = useState(false)
  const [interviews, setInterviews] = useState<InterviewListItem[] | null>(null)
  const [interviewsLoading, setInterviewsLoading] = useState(false)

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
    setAdvice(null)
    setAdviceOpen(false)
    fetchCategoryDrilldown(category).then(({ data }) => {
      setDrilldown(data)
      setDrilldownLoading(false)
    })
  }

  function getAdvice() {
    if (!activeCategory) return
    if (advice) {
      setAdviceOpen((v) => !v)
      return
    }
    setAdviceLoading(true)
    setAdviceOpen(true)
    fetchCategoryAdvice(activeCategory).then(({ data }) => {
      setAdvice(data)
      setAdviceLoading(false)
    })
  }

  function openDepartment(department: string) {
    setActiveDepartment(department)
    setDepartmentDrilldown(null)
    setDepartmentLoading(true)
    fetchDepartmentDrilldown(department).then(({ data }) => {
      setDepartmentDrilldown(data)
      setDepartmentLoading(false)
    })
  }

  function openInterviews() {
    setInterviewsOpen(true)
    if (interviews === null) {
      setInterviewsLoading(true)
      fetchInterviews().then(({ data }) => {
        setInterviews(data)
        setInterviewsLoading(false)
      })
    }
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
        eyebrow="Пульс организации"
        title="Сигналы ухода"
        description="Повторяющиеся причины, зоны риска и живые цитаты — в одной картине без потери контекста."
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
          <div className="analytics-dashboard">
            <StatGrid>
              <StatCard
                label="Всего интервью"
                value={String(summary.total_interviews)}
                onClick={openInterviews}
              />
              <StatCard
                label="Главная причина ухода"
                value={topCategory ? `${topCategory.percent}%` : '—'}
                delta={topCategory?.category}
                onClick={topCategory ? () => openCategory(topCategory.category) : undefined}
              />
              <StatCard
                label="Отдел в зоне риска"
                value={riskiestDept ? `${riskiestDept.high_percent}%` : '—'}
                delta={riskiestDept?.department}
                down={Boolean(riskiestDept && riskiestDept.high_percent > 0)}
                onClick={riskiestDept ? () => openDepartment(riskiestDept.department) : undefined}
              />
              <StatCard
                label="Категорий причин"
                value={String(summary.category_breakdown.length)}
              />
            </StatGrid>

            <Card title="Что чаще всего приводит к уходу">
              {summary.category_breakdown.length === 0 ? (
                <EmptyState title="Пока нет данных" />
              ) : (
                <div className="analytics-bars">
                  {summary.category_breakdown.map((row, index) => (
                    <button
                      key={row.category}
                      type="button"
                      className="analytics-bar-row"
                      onClick={() => openCategory(row.category)}
                    >
                      <span className="analytics-bar-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="analytics-bar-main">
                        <div className="analytics-bar-head">
                          <span className="analytics-bar-name">{row.category}</span>
                          <span className="analytics-bar-meta">
                            <strong>{row.percent}%</strong> · {row.count} интервью
                          </span>
                        </div>
                        <div className="analytics-bar-track">
                          <div
                            className="analytics-bar-fill"
                            style={{ width: `${Math.max(row.percent, 3)}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Риск ухода по отделам">
              {departmentRows.length === 0 ? (
                <EmptyState title="Пока нет данных" />
              ) : (
                <DataTable columns={departmentColumns(openDepartment)} rows={departmentRows} />
              )}
            </Card>
          </div>
        )}
      </div>

      {activeCategory && (
        <Drawer title={activeCategory} onClose={() => setActiveCategory(null)}>
          {drilldownLoading || !drilldown ? (
            <LoadingState label="Загружаем разбор категории…" />
          ) : (
            <>
              <div className="analytics-summary-head">
                <span className="analytics-section-title" style={{ margin: 0 }}>
                  AI-саммари кластера
                </span>
                <Badge tone={drilldown.generated_by === 'llm' ? 'default' : 'neutral'}>
                  {drilldown.generated_by === 'llm' ? 'LLM' : 'эвристика'}
                </Badge>
              </div>
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

              <div className="analytics-advice">
                <Button type="button" variant="secondary" onClick={getAdvice}>
                  {adviceOpen ? 'Скрыть совет' : 'Получить совет'}
                </Button>
                {adviceOpen && (
                  <div className="analytics-solutions">
                    <h3 className="analytics-section-title">Как решить проблему</h3>
                    {adviceLoading || !advice ? (
                      <LoadingState label="Спрашиваем совет у AI…" />
                    ) : (
                      <ol className="analytics-solutions-list">
                        {advice.solutions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </Drawer>
      )}

      {activeDepartment && (
        <Drawer title={activeDepartment} onClose={() => setActiveDepartment(null)}>
          {departmentLoading || !departmentDrilldown ? (
            <LoadingState label="Загружаем разбор отдела…" />
          ) : (
            <>
              <div className="analytics-summary-head">
                <span className="analytics-section-title" style={{ margin: 0 }}>
                  AI-саммари отдела
                </span>
                <Badge tone={departmentDrilldown.generated_by === 'llm' ? 'default' : 'neutral'}>
                  {departmentDrilldown.generated_by === 'llm' ? 'LLM' : 'эвристика'}
                </Badge>
              </div>
              <p className="analytics-drawer-summary">{departmentDrilldown.summary}</p>

              <h3 className="analytics-section-title">Риск по интервью</h3>
              <div className="analytics-subtypes">
                <div className="analytics-subtype-row">
                  <span>Всего интервью</span>
                  <span className="analytics-subtype-count">{departmentDrilldown.total}</span>
                </div>
                <div className="analytics-subtype-row">
                  <span>Низкий риск</span>
                  <span className="analytics-subtype-count">{departmentDrilldown.low}</span>
                </div>
                <div className="analytics-subtype-row">
                  <span>Средний риск</span>
                  <span className="analytics-subtype-count">{departmentDrilldown.medium}</span>
                </div>
                <div className="analytics-subtype-row">
                  <span>Высокий риск</span>
                  <span className="analytics-subtype-count">{departmentDrilldown.high}</span>
                </div>
              </div>

              <h3 className="analytics-section-title">Основные причины ухода в отделе</h3>
              {departmentDrilldown.top_categories.length === 0 ? (
                <p className="analytics-empty-cell">Нет данных по причинам.</p>
              ) : (
                <div className="analytics-subtypes">
                  {departmentDrilldown.top_categories.map((c) => (
                    <div className="analytics-subtype-row" key={c.category}>
                      <span>{c.category}</span>
                      <span className="analytics-subtype-count">
                        {c.count} · {c.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Drawer>
      )}

      {interviewsOpen && (
        <Modal title="Все интервью" onClose={() => setInterviewsOpen(false)}>
          {interviewsLoading || !interviews ? (
            <LoadingState label="Загружаем список интервью…" />
          ) : interviews.length === 0 ? (
            <EmptyState title="Пока нет интервью" />
          ) : (
            <DataTable
              columns={interviewColumns}
              rows={interviews.map((i) => ({ ...i, id: i.id }))}
            />
          )}
        </Modal>
      )}
    </>
  )
}

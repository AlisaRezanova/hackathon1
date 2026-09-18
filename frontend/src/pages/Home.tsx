import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAnalyticsSummary } from '../features/analytics/api'
import type { AnalyticsSummary } from '../features/analytics/types'
import { Badge } from '../shared/ui/Badge'
import { Button } from '../shared/ui/Button'
import { Icon } from '../shared/ui/Icons'

export function Home() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [usedMock, setUsedMock] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAnalyticsSummary().then(({ data, usedMock }) => {
      if (cancelled) return
      setSummary(data)
      setUsedMock(usedMock)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const topReason = summary?.category_breakdown[0]
  const riskDepartment = summary?.department_risk[0]

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
          <Link to="/app/interviews"><Button>Новое интервью</Button></Link>
        </div>
      </header>

      <section className="home-metrics" aria-label="Сводка">
        <div className="home-metric">
          <span>Всего интервью</span>
          <strong>{summary?.total_interviews ?? '—'}</strong>
        </div>
        <div className="home-metric">
          <span>Основная причина</span>
          <strong>{topReason ? `${topReason.percent}%` : '—'}</strong>
          <small>{topReason?.category ?? 'Загрузка'}</small>
        </div>
        <div className="home-metric home-metric--risk">
          <span>Высокий риск</span>
          <strong>{riskDepartment ? `${riskDepartment.high_percent}%` : '—'}</strong>
          <small>{riskDepartment?.department ?? 'Загрузка'}</small>
        </div>
        <div className="home-metric">
          <span>Категорий причин</span>
          <strong>{summary?.category_breakdown.length ?? '—'}</strong>
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
            {(summary?.category_breakdown.slice(0, 4) ?? []).map((reason) => (
              <div className="home-reason" key={reason.category}>
                <div><span>{reason.category}</span><strong>{reason.percent}%</strong></div>
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
            <span>{riskDepartment ? `${riskDepartment.high} из ${riskDepartment.total} интервью с высоким риском` : 'Загрузка данных'}</span>
          </div>
          <Link to="/app/analytics" className="home-attention__link">
            Открыть разбор <Icon name="arrow" />
          </Link>
        </aside>
      </div>

      <section className="home-actions" aria-label="Быстрые действия">
        <Link to="/app/interviews" className="home-action">
          <Icon name="conversation" />
          <span><strong>Провести интервью</strong><small>Начать новый разговор</small></span>
          <Icon name="arrow" />
        </Link>
        <Link to="/app/analytics" className="home-action">
          <Icon name="analytics" />
          <span><strong>Открыть аналитику</strong><small>Причины, отделы и цитаты</small></span>
          <Icon name="arrow" />
        </Link>
      </section>
    </main>
  )
}

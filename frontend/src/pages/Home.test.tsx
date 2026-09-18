import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../shared/ui/Toast'
import { Home } from './Home'

// Home aggregates the two real features (interviews + analytics) — mock
// their api modules rather than hitting the network, same spirit as
// shared/http.ts's own mock fallback.
vi.mock('../features/analytics/api', () => ({
  fetchAnalyticsSummary: vi.fn(async () => ({
    data: {
      total_interviews: 12,
      category_breakdown: [{ category: 'Компенсация', count: 4, percent: 33 }],
      department_risk: [
        { department: 'Продажи', total: 3, low: 0, medium: 1, high: 2, high_percent: 67 },
      ],
    },
    usedMock: false,
  })),
  fetchInterviews: vi.fn(async () => ({
    data: [
      {
        id: 1,
        employee_alias: 'Сотрудник #1',
        position: 'Backend-разработчик',
        department: 'Разработка',
        interview_date: '2026-09-01',
        primary_category: 'Карьерный рост',
        risk_zone: 'medium',
      },
    ],
    usedMock: false,
  })),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Home />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('Home', () => {
  it('shows aggregated stats and the recent interviews table once data loads', async () => {
    renderHome()
    expect(await screen.findByText('Компенсация')).toBeInTheDocument()
    expect(screen.getByText('Сотрудник #1')).toBeInTheDocument()
    expect(screen.getByText('Продажи')).toBeInTheDocument()
  })

  it('links the primary actions into the HR app routes (/app/*)', async () => {
    renderHome()
    await screen.findByText('Компенсация')
    expect(screen.getByText('Начать exit-интервью').closest('a')).toHaveAttribute(
      'href',
      '/app/interviews',
    )
    expect(screen.getByText('Открыть аналитику').closest('a')).toHaveAttribute(
      'href',
      '/app/analytics',
    )
  })
})

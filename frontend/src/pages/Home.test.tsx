import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '../shared/ui/Toast'
import { Home } from './Home'

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
  it('renders the product entry point', async () => {
    renderHome()
    expect(screen.getByRole('heading', { name: 'Обзор exit-интервью' })).toBeInTheDocument()
    expect(await screen.findByText('Основные причины ухода')).toBeInTheDocument()
  })

  it('links to both primary product scenarios', async () => {
    renderHome()
    expect(screen.getAllByRole('link', { name: /Новое интервью/i })[0]).toHaveAttribute(
      'href',
      '/app/interviews',
    )
    expect((await screen.findAllByRole('link', { name: /Открыть аналитику/i }))[0]).toHaveAttribute(
      'href',
      '/app/analytics',
    )
  })
})

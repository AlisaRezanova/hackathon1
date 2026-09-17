import { fireEvent, render, screen } from '@testing-library/react'
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
  it('renders the demo roster table', () => {
    renderHome()
    expect(screen.getByText('Ростер (демоданные)')).toBeInTheDocument()
    expect(screen.getByText('Anna Ivanova')).toBeInTheDocument()
  })

  it('shows a toast when the notification button is clicked', async () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Показать уведомление' }))
    expect(await screen.findByText('Демо-уведомление отправлено')).toBeInTheDocument()
  })
})

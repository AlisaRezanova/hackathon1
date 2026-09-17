import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge tone="amber">Риск ухода</Badge>)
    expect(screen.getByText('Риск ухода')).toBeInTheDocument()
  })
})

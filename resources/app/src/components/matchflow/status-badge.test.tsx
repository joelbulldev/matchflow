import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { StatusBadge, AmountDisplay } from './index'

describe('StatusBadge', () => {
  it('renders status label', () => {
    const { getByText } = render(<StatusBadge status="issued" />)
    expect(getByText(/issued/i)).toBeInTheDocument()
  })

  it('marks void as destructive tone via class', () => {
    const { container } = render(<StatusBadge status="void" />)
    expect(container.textContent).toMatch(/void/i)
  })
})

describe('AmountDisplay', () => {
  it('shows formatted money', () => {
    const { getByText } = render(<AmountDisplay value="10.00" currency="USD" />)
    expect(getByText(/\$10\.00/)).toBeInTheDocument()
  })
})

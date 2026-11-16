import { describe, expect, it } from 'vitest'
import { cn, formatMoney } from './utils'

describe('formatMoney', () => {
  it('formats USD with tabular-friendly output', () => {
    expect(formatMoney('1234.5', 'USD')).toMatch(/1,234\.50/)
  })

  it('passes through non-numeric strings', () => {
    expect(formatMoney('n/a')).toBe('n/a')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'px-4')).toContain('px-4')
  })
})

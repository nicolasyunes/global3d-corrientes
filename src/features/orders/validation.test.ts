import { describe, expect, it } from 'vitest'
import { toISODate } from './validation'

describe('toISODate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

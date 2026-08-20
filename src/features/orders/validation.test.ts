import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  defaultDueDate,
  emptyDraft,
  parseMoney,
  resolvedPendingBalance,
  toISODate,
  validateOrder,
  DEFAULT_LEAD_TIME_DAYS,
  type OrderDraft,
} from './validation'

function draftWith(overrides: Partial<OrderDraft>): OrderDraft {
  return { ...emptyDraft(), ...overrides }
}

describe('validateOrder — required fields', () => {
  it('blocks submission when customer, product type, or due date are missing', () => {
    const errors = validateOrder(
      draftWith({ customerName: '', productType: '', dueDate: '' }),
    )
    expect(errors.customerName).toBeTruthy()
    expect(errors.productType).toBeTruthy()
    expect(errors.dueDate).toBeTruthy()
  })

  it('passes when the required fields are complete', () => {
    const errors = validateOrder(
      draftWith({
        customerName: 'Ada',
        productType: 'cup',
        dueDate: '2099-01-01',
      }),
    )
    expect(errors).toEqual({})
  })

  it('rejects a malformed due date', () => {
    const errors = validateOrder(draftWith({ dueDate: 'not-a-date' }))
    expect(errors.dueDate).toBeTruthy()
  })
})

describe('validateOrder — numeric fields', () => {
  it('rejects a non-numeric total', () => {
    const errors = validateOrder(draftWith({ totalAmount: 'abc' }))
    expect(errors.totalAmount).toBeTruthy()
  })

  it('rejects a negative total', () => {
    const errors = validateOrder(draftWith({ totalAmount: '-5' }))
    expect(errors.totalAmount).toBeTruthy()
  })

  it('rejects a deposit that exceeds the total', () => {
    const errors = validateOrder(
      draftWith({ totalAmount: '100', deposit: '150' }),
    )
    expect(errors.deposit).toBeTruthy()
  })

  it('rejects a deposit set without a total', () => {
    const errors = validateOrder(draftWith({ deposit: '50' }))
    expect(errors.deposit).toBeTruthy()
  })

  it('accepts an empty total and deposit (both optional)', () => {
    const errors = validateOrder(draftWith({ totalAmount: '', deposit: '' }))
    expect(errors.totalAmount).toBeUndefined()
    expect(errors.deposit).toBeUndefined()
  })

  it('rejects an invalid pending balance override', () => {
    const errors = validateOrder(draftWith({ pendingBalance: 'nope' }))
    expect(errors.pendingBalance).toBeTruthy()
  })
})

describe('parseMoney', () => {
  it('parses a valid decimal', () => {
    expect(parseMoney('12.50')).toBe(12.5)
  })

  it('returns null for empty input', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
  })

  it('returns null for invalid or negative input', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('-1')).toBeNull()
  })
})

describe('resolvedPendingBalance', () => {
  it('defaults to total − deposit', () => {
    expect(
      resolvedPendingBalance(draftWith({ totalAmount: '100', deposit: '30' })),
    ).toBe(70)
  })

  it('returns null when nothing is set', () => {
    expect(resolvedPendingBalance(emptyDraft())).toBeNull()
  })

  it('honors an explicit override over the computed value', () => {
    expect(
      resolvedPendingBalance(
        draftWith({ totalAmount: '100', deposit: '30', pendingBalance: '40' }),
      ),
    ).toBe(40)
  })
})

describe('smart defaults', () => {
  it('toISODate formats a date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('addBusinessDays skips weekends', () => {
    // Friday + 1 business day -> Monday.
    const friday = new Date(2026, 0, 2) // 2026-01-02 is a Friday
    expect(toISODate(addBusinessDays(friday, 1))).toBe('2026-01-05')
  })

  it('defaultDueDate is DEFAULT_LEAD_TIME_DAYS business days out and never a weekend', () => {
    const result = defaultDueDate(new Date(2026, 0, 5)) // Monday
    expect(result).toBe('2026-01-08') // Wed +3 business days (Tue, Wed, Thu)
    const weekday = new Date(`${result}T00:00:00`).getDay()
    expect([0, 6]).not.toContain(weekday)
  })

  it('emptyDraft applies the default due date and empty optional fields', () => {
    const draft = emptyDraft()
    expect(draft.dueDate).toBe(defaultDueDate())
    expect(draft.productType).toBe('')
    expect(draft.totalAmount).toBe('')
    expect(DEFAULT_LEAD_TIME_DAYS).toBeGreaterThan(0)
  })
})

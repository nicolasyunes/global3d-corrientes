import { describe, expect, it } from 'vitest'
import { groupSalesByDay, totalAmount } from './list'
import type { SaleWithInventory } from './sales.api'

function sale(overrides: Partial<SaleWithInventory>): SaleWithInventory {
  return {
    id: 'id',
    type: 'supplies_sale',
    order_id: null,
    amount: 1000,
    payment_account: null,
    method: 'cash',
    note: null,
    transacted_at: '2026-01-05T12:00:00Z',
    created_at: '2026-01-05T12:00:00Z',
    updated_at: '2026-01-05T12:00:00Z',
    inventory_id: null,
    quantity_grams: null,
    inventory: null,
    ...overrides,
  }
}

describe('groupSalesByDay', () => {
  it('buckets sales that share a day, preserving order', () => {
    const groups = groupSalesByDay([
      sale({ id: 'a', transacted_at: '2026-01-05T20:00:00Z' }),
      sale({ id: 'b', transacted_at: '2026-01-05T09:00:00Z' }),
      sale({ id: 'c', transacted_at: '2026-01-04T10:00:00Z' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].day).toBe('2026-01-05')
    expect(groups[0].sales.map((s) => s.id)).toEqual(['a', 'b'])
    expect(groups[1].day).toBe('2026-01-04')
    expect(groups[1].sales.map((s) => s.id)).toEqual(['c'])
  })

  it('sums each day\'s amount into that day\'s total', () => {
    const groups = groupSalesByDay([
      sale({ id: 'a', amount: 500, transacted_at: '2026-01-05T20:00:00Z' }),
      sale({ id: 'b', amount: 250, transacted_at: '2026-01-05T09:00:00Z' }),
    ])
    expect(groups[0].total).toBe(750)
  })

  it('returns an empty list for no sales', () => {
    expect(groupSalesByDay([])).toEqual([])
  })
})

describe('totalAmount', () => {
  it('sums the amount across all sales', () => {
    expect(
      totalAmount([sale({ amount: 500 }), sale({ amount: 250 })]),
    ).toBe(750)
  })

  it('is 0 for an empty list', () => {
    expect(totalAmount([])).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { mondayOf } from './WeekPage'
import { groupByOrder, sortWorkOrders } from './WorkshopPage'
import type { WorkPiece } from './workshop.api'

const piece = (over: Partial<WorkPiece>): WorkPiece =>
  ({
    id: 'p',
    order_id: 'o1',
    label: 'Tapa',
    color: null,
    quantity_total: 1,
    quantity_done: 0,
    status: 'pending',
    due_date: '2026-10-02',
    order_status: 'new',
    order_title: null,
    order_created_at: '2026-09-20T00:00:00Z',
    order_updated_at: '2026-09-20T00:00:00Z',
    customer_id: 'c1',
    customer_name: 'Ana',
    flexible: false,
    urgent: false,
    pp_sand: false,
    pp_paint: false,
    pp_notes: null,
    sand_done: false,
    paint_done: false,
    item_label: 'Vaso',
    ...over,
  }) as WorkPiece

describe('groupByOrder', () => {
  it('folds pieces into their order and titles it by its products', () => {
    const orders = groupByOrder([
      piece({ id: 'a' }),
      piece({ id: 'b', label: 'Base' }),
      piece({ id: 'c', order_id: 'o2', order_title: 'Trofeos' }),
    ])
    expect(orders).toHaveLength(2)
    expect(orders[0].pieces.map((p) => p.id)).toEqual(['a', 'b'])
    expect(orders[0].title).toBe('Vaso')
    expect(orders[1].title).toBe('Trofeos')
  })
})

describe('sortWorkOrders', () => {
  const orders = groupByOrder([
    piece({ id: 'late', order_id: 'late', due_date: '2026-09-01' }),
    piece({
      id: 'calm',
      order_id: 'calm',
      due_date: '2026-08-01',
      flexible: true,
    }),
    piece({
      id: 'event',
      order_id: 'event',
      due_date: '2026-12-20',
      urgent: true,
    }),
  ])

  it('puts urgent first, then by date, and "sin apuro" last', () => {
    expect(sortWorkOrders(orders, 'due').map((o) => o.id)).toEqual([
      'event',
      'late',
      'calm',
    ])
  })
})

describe('mondayOf', () => {
  it('finds the Monday of any day of the week', () => {
    expect(mondayOf('2026-09-30')).toBe('2026-09-28')
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
    expect(mondayOf('2026-10-04')).toBe('2026-09-28')
  })
})

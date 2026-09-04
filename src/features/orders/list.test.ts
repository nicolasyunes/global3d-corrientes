import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  emptyFilters,
  filterOrders,
  getOrderSemaphore,
  groupOrdersByStatus,
  isOverdue,
  shapeOrders,
} from './list'
import type { OrderWithCustomer } from './orders.api'

function order(overrides: Partial<OrderWithCustomer>): OrderWithCustomer {
  return {
    id: 'id',
    customer_id: 'customer',
    product_type: 'cup',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-05',
    total_amount: null,
    deposit: null,
    pending_balance: null,
    payment_method: null,
    status: 'new',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

function allIds(orders: readonly OrderWithCustomer[]): string[] {
  return orders.map((o) => o.id)
}

describe('addDaysISO', () => {
  it('adds days within a month', () => {
    expect(addDaysISO('2026-01-01', 7)).toBe('2026-01-08')
  })

  it('rolls over a month boundary', () => {
    expect(addDaysISO('2026-01-28', 7)).toBe('2026-02-04')
  })
})

describe('shapeOrders', () => {
  it('sorts pending orders by order_date descending (most recent first)', () => {
    const { pending } = shapeOrders(
      [
        order({ id: 'oldest', order_date: '2026-01-02' }),
        order({ id: 'newest', order_date: '2026-01-10' }),
        order({ id: 'middle', order_date: '2026-01-05' }),
      ],
      '2026-01-04',
    )
    expect(allIds(pending)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('breaks a same-day order_date tie with created_at descending', () => {
    const { pending } = shapeOrders(
      [
        order({
          id: 'earlier',
          order_date: '2026-01-05',
          created_at: '2026-01-05T09:00:00Z',
        }),
        order({
          id: 'later',
          order_date: '2026-01-05',
          created_at: '2026-01-05T18:00:00Z',
        }),
      ],
      '2026-01-05',
    )
    expect(allIds(pending)).toEqual(['later', 'earlier'])
  })

  it('hides cancelled, finished and delivered orders', () => {
    const { pending } = shapeOrders(
      [
        order({ id: 'a', status: 'new', due_date: '2026-01-02' }),
        order({ id: 'b', status: 'cancelled', due_date: '2026-01-03' }),
        order({ id: 'c', status: 'finished', due_date: '2026-01-03' }),
        order({ id: 'd', status: 'delivered', due_date: '2026-01-03' }),
      ],
      '2026-01-01',
    )
    expect(allIds(pending)).toEqual(['a'])
  })

  it('upcoming is pending narrowed to a due_date within the next 7 days', () => {
    const { pending, upcoming } = shapeOrders(
      [
        order({ id: 'past-due', due_date: '2026-01-01' }),
        order({ id: 'due-today', due_date: '2026-01-05' }),
        order({ id: 'within-7', due_date: '2026-01-12' }),
        order({ id: 'past-horizon', due_date: '2026-01-13' }),
      ],
      '2026-01-05',
    )
    expect(allIds(pending).sort()).toEqual(
      ['due-today', 'past-due', 'past-horizon', 'within-7'].sort(),
    )
    expect(allIds(upcoming)).toEqual(['due-today', 'within-7'])
  })

  it('does not mutate its input array', () => {
    const input = [
      order({ id: 'b', order_date: '2026-01-05' }),
      order({ id: 'a', order_date: '2026-01-02' }),
    ]
    shapeOrders(input, '2026-01-01')
    expect(allIds(input)).toEqual(['b', 'a'])
  })
})

describe('groupOrdersByStatus', () => {
  it('buckets each order under its own status', () => {
    const groups = groupOrdersByStatus(
      [
        order({ id: 'a', status: 'new' }),
        order({ id: 'b', status: 'printing' }),
        order({ id: 'c', status: 'new' }),
      ],
      ['new', 'printing', 'finished'],
    )
    expect(allIds(groups.new)).toEqual(['a', 'c'])
    expect(allIds(groups.printing)).toEqual(['b'])
    expect(allIds(groups.finished)).toEqual([])
  })

  it('sorts each column by order_date ascending (entry order, not due_date)', () => {
    const groups = groupOrdersByStatus(
      [
        order({
          id: 'late-due-early-entry',
          status: 'new',
          order_date: '2026-01-02',
          due_date: '2026-01-10',
        }),
        order({
          id: 'early-due-late-entry',
          status: 'new',
          order_date: '2026-01-05',
          due_date: '2026-01-03',
        }),
      ],
      ['new'],
    )
    expect(allIds(groups.new)).toEqual(['late-due-early-entry', 'early-due-late-entry'])
  })

  it('breaks a same-day order_date tie with created_at', () => {
    const groups = groupOrdersByStatus(
      [
        order({
          id: 'later',
          status: 'new',
          order_date: '2026-01-05',
          created_at: '2026-01-05T18:00:00Z',
        }),
        order({
          id: 'earlier',
          status: 'new',
          order_date: '2026-01-05',
          created_at: '2026-01-05T09:00:00Z',
        }),
      ],
      ['new'],
    )
    expect(allIds(groups.new)).toEqual(['earlier', 'later'])
  })

  it('includes cancelled orders when the status list asks for them', () => {
    const groups = groupOrdersByStatus(
      [order({ id: 'a', status: 'cancelled' })],
      ['new', 'cancelled'],
    )
    expect(allIds(groups.cancelled)).toEqual(['a'])
  })

  it('does not mutate its input array', () => {
    const input = [
      order({ id: 'b', status: 'new', due_date: '2026-01-05' }),
      order({ id: 'a', status: 'new', due_date: '2026-01-02' }),
    ]
    groupOrdersByStatus(input, ['new'])
    expect(allIds(input)).toEqual(['b', 'a'])
  })
})

describe('filterOrders', () => {
  it('returns everything when no filter is set', () => {
    const orders = [order({ id: 'a' }), order({ id: 'b' })]
    expect(allIds(filterOrders(orders, emptyFilters()))).toEqual(['a', 'b'])
  })

  it('filters by a due_date range', () => {
    const orders = [
      order({ id: 'early', due_date: '2026-01-01' }),
      order({ id: 'mid', due_date: '2026-01-05' }),
      order({ id: 'late', due_date: '2026-01-10' }),
    ]
    expect(
      allIds(
        filterOrders(orders, {
          ...emptyFilters(),
          dueFrom: '2026-01-02',
          dueTo: '2026-01-09',
        }),
      ),
    ).toEqual(['mid'])
  })

  it('filters by product type', () => {
    const orders = [
      order({ id: 'a', product_type: 'cup' }),
      order({ id: 'b', product_type: 'trophy' }),
    ]
    expect(
      allIds(
        filterOrders(orders, { ...emptyFilters(), productType: 'trophy' }),
      ),
    ).toEqual(['b'])
  })

  it('filters by customer name, case-insensitively', () => {
    const orders = [
      order({ id: 'a', customers: { name: 'Ada Lovelace', phone: null } }),
      order({ id: 'b', customers: { name: 'Grace Hopper', phone: null } }),
    ]
    expect(
      allIds(
        filterOrders(orders, { ...emptyFilters(), customerSearch: 'ada' }),
      ),
    ).toEqual(['a'])
  })

  it('treats a null customer as unmatched by a customer search', () => {
    const orders = [order({ id: 'a', customers: null })]
    expect(
      allIds(
        filterOrders(orders, { ...emptyFilters(), customerSearch: 'ada' }),
      ),
    ).toEqual([])
  })
})

describe('isOverdue', () => {
  it('is true when due_date is before today', () => {
    expect(isOverdue(order({ due_date: '2026-01-01' }), '2026-01-05')).toBe(
      true,
    )
  })

  it('is false when due exactly today or in the future', () => {
    expect(isOverdue(order({ due_date: '2026-01-05' }), '2026-01-05')).toBe(
      false,
    )
    expect(isOverdue(order({ due_date: '2026-01-09' }), '2026-01-05')).toBe(
      false,
    )
  })
})

describe('getOrderSemaphore', () => {
  it('is "delivered" whenever the order is delivered, regardless of due_date', () => {
    expect(
      getOrderSemaphore(
        order({ status: 'delivered', due_date: '2026-01-01' }),
        '2026-01-05',
      ),
    ).toBe('delivered')
  })

  it('is "ready" whenever the order is finished, regardless of due_date', () => {
    expect(
      getOrderSemaphore(
        order({ status: 'finished', due_date: '2026-01-01' }),
        '2026-01-05',
      ),
    ).toBe('ready')
  })

  it('is "urgent" when due_date is 3 days away or less, including overdue', () => {
    expect(
      getOrderSemaphore(
        order({ status: 'printing', due_date: '2026-01-08' }),
        '2026-01-05',
      ),
    ).toBe('urgent')
    expect(
      getOrderSemaphore(
        order({ status: 'printing', due_date: '2026-01-01' }),
        '2026-01-05',
      ),
    ).toBe('urgent')
  })

  it('is "ok" when due_date is more than 3 days away', () => {
    expect(
      getOrderSemaphore(
        order({ status: 'printing', due_date: '2026-01-10' }),
        '2026-01-05',
      ),
    ).toBe('ok')
  })
})

import { describe, expect, it } from 'vitest'
import { addDaysISO, getOrderSemaphore, groupOrdersByStatus } from './list'
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
    title: null,
    description: null,
    waiting_reason: null,
    follow_up_on: null,
    flexible: false,
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
    expect(allIds(groups.new)).toEqual([
      'late-due-early-entry',
      'early-due-late-entry',
    ])
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

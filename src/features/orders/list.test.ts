import { describe, expect, it } from 'vitest'
import { shapeOrders } from './list'
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
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

function allIds(orders: readonly OrderWithCustomer[]): string[] {
  return orders.map((o) => o.id)
}

describe('shapeOrders', () => {
  it('sorts active orders by due_date ascending', () => {
    const { today, upcoming } = shapeOrders(
      [
        order({ id: 'c', due_date: '2026-01-10' }),
        order({ id: 'a', due_date: '2026-01-02' }),
        order({ id: 'b', due_date: '2026-01-05' }),
      ],
      '2026-01-04',
    )
    expect(allIds([...today, ...upcoming])).toEqual(['a', 'b', 'c'])
  })

  it('hides cancelled orders', () => {
    const { today, upcoming } = shapeOrders(
      [
        order({ id: 'a', status: 'new', due_date: '2026-01-02' }),
        order({ id: 'b', status: 'cancelled', due_date: '2026-01-03' }),
      ],
      '2026-01-01',
    )
    expect(allIds([...today, ...upcoming])).toEqual(['a'])
  })

  it('buckets overdue and due-today into today, future into upcoming', () => {
    const { today, upcoming } = shapeOrders(
      [
        order({ id: 'overdue', due_date: '2026-01-01' }),
        order({ id: 'due-today', due_date: '2026-01-05' }),
        order({ id: 'future', due_date: '2026-01-09' }),
      ],
      '2026-01-05',
    )
    expect(allIds(today)).toEqual(['overdue', 'due-today'])
    expect(allIds(upcoming)).toEqual(['future'])
  })

  it('does not mutate its input array', () => {
    const input = [
      order({ id: 'b', due_date: '2026-01-05' }),
      order({ id: 'a', due_date: '2026-01-02' }),
    ]
    shapeOrders(input, '2026-01-01')
    expect(allIds(input)).toEqual(['b', 'a'])
  })
})

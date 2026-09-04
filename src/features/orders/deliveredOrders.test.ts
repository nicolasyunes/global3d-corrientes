import { describe, expect, it } from 'vitest'
import {
  groupVentasByMonth,
  toVentaRows,
  ventasTotal,
} from './deliveredOrders'
import type { OrderWithCustomer } from './orders.api'
import type { ProductSaleRow } from './productSales.api'

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
    total_amount: 1000,
    deposit: null,
    pending_balance: null,
    payment_method: null,
    status: 'delivered',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

function sale(overrides: Partial<ProductSaleRow>): ProductSaleRow {
  return {
    id: 'sale',
    type: 'product_sale',
    order_id: null,
    amount: 500,
    payment_account: null,
    method: null,
    note: null,
    transacted_at: '2026-01-10T12:00:00Z',
    created_at: '2026-01-10T12:00:00Z',
    updated_at: '2026-01-10T12:00:00Z',
    inventory_id: null,
    quantity_grams: null,
    product_id: 'prod-1',
    quantity: 1,
    customer_id: null,
    customers: null,
    products: { name: 'Llavero Batman' },
    ...overrides,
  }
}

describe('toVentaRows', () => {
  it('normalizes a delivered order into an order row with a detail link', () => {
    const [row] = toVentaRows(
      [
        order({
          id: 'o1',
          due_date: '2026-02-03',
          total_amount: 1200,
          origin_channel: 'whatsapp',
        }),
      ],
      [],
    )
    expect(row).toMatchObject({
      id: 'o1',
      kind: 'order',
      date: '2026-02-03',
      customerName: 'Ada',
      productLabel: 'Taza',
      channelLabel: 'WhatsApp',
      amount: 1200,
      href: '/admin/orders/o1',
    })
  })

  it('normalizes a catalog product sale, using the joined product name', () => {
    const [row] = toVentaRows(
      [],
      [sale({ id: 's1', products: { name: 'Taza Star Wars' } })],
    )
    expect(row).toMatchObject({
      id: 's1',
      kind: 'product',
      date: '2026-01-10',
      productLabel: 'Taza Star Wars',
      channelLabel: null,
      href: null,
    })
  })

  it('falls back to note for a free-text sale with no linked product', () => {
    const [row] = toVentaRows(
      [],
      [sale({ product_id: null, products: null, note: 'Sticker suelto' })],
    )
    expect(row.productLabel).toBe('Sticker suelto')
  })

  it('interleaves both sources newest-first by date', () => {
    const rows = toVentaRows(
      [
        order({ id: 'o-old', due_date: '2026-01-02' }),
        order({ id: 'o-new', due_date: '2026-03-20' }),
      ],
      [sale({ id: 's-mid', transacted_at: '2026-02-15T09:00:00Z' })],
    )
    expect(rows.map((r) => r.id)).toEqual(['o-new', 's-mid', 'o-old'])
  })
})

describe('groupVentasByMonth', () => {
  it('buckets rows that share a month, preserving order', () => {
    const groups = groupVentasByMonth(
      toVentaRows(
        [
          order({ id: 'a', due_date: '2026-01-20' }),
          order({ id: 'b', due_date: '2026-01-05' }),
          order({ id: 'c', due_date: '2025-12-15' }),
        ],
        [],
      ),
    )
    expect(groups).toHaveLength(2)
    expect(groups[0].month).toBe('2026-01')
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[1].month).toBe('2025-12')
  })

  it("sums each month's amounts, treating null as 0", () => {
    const groups = groupVentasByMonth(
      toVentaRows(
        [
          order({ id: 'a', total_amount: 500, due_date: '2026-01-20' }),
          order({ id: 'b', total_amount: null, due_date: '2026-01-05' }),
        ],
        [sale({ id: 's', amount: 250, transacted_at: '2026-01-10T00:00:00Z' })],
      ),
    )
    expect(groups[0].total).toBe(750)
  })

  it('returns an empty list for no rows', () => {
    expect(groupVentasByMonth([])).toEqual([])
  })
})

describe('ventasTotal', () => {
  it('sums amounts across orders and product sales', () => {
    const rows = toVentaRows(
      [order({ total_amount: 500 })],
      [sale({ amount: 250 })],
    )
    expect(ventasTotal(rows)).toBe(750)
  })

  it('treats a null amount as 0', () => {
    expect(ventasTotal(toVentaRows([order({ total_amount: null })], []))).toBe(0)
  })

  it('is 0 for an empty list', () => {
    expect(ventasTotal([])).toBe(0)
  })
})

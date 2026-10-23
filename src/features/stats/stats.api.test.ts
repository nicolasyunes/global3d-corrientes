import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: { table: string; filters: unknown[][] }[] = []
  const data: Record<string, unknown[]> = {}
  function from(table: string) {
    const entry = { table, filters: [] as unknown[][] }
    calls.push(entry)
    const q = {
      select: () => q,
      gte: (...a: unknown[]) => (entry.filters.push(['gte', ...a]), q),
      lt: (...a: unknown[]) => (entry.filters.push(['lt', ...a]), q),
      eq: (...a: unknown[]) => (entry.filters.push(['eq', ...a]), q),
      in: (...a: unknown[]) => (entry.filters.push(['in', ...a]), q),
      order: () => q,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: data[table] ?? [], error: null }),
    }
    return q
  }
  return { calls, data, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
vi.mock('@/features/orders/orders.api', () => ({
  listDeliveredOrders: vi.fn().mockResolvedValue([
    { id: 'o1', due_date: '2026-10-07', total_amount: 1000, title: 'A', product_type: 'other', origin_channel: null, customers: null },
    { id: 'o2', due_date: '2026-09-01', total_amount: 2000, title: 'B', product_type: 'other', origin_channel: null, customers: null },
  ]),
}))
vi.mock('@/features/orders/productSales.api', () => ({
  listProductSales: vi.fn().mockResolvedValue([
    { id: 't1', transacted_at: new Date(2026, 9, 7, 12).toISOString(), amount: 500, method: 'cash', note: 'x', customers: null, products: null },
    { id: 't2', transacted_at: new Date(2026, 8, 1, 12).toISOString(), amount: 900, method: 'cash', note: 'y', customers: null, products: null },
  ]),
}))

import { loadStats, STATS_LOG_KINDS } from './stats.api'

const RANGE = { from: new Date(2026, 9, 6), to: new Date(2026, 9, 13) }

describe('loadStats', () => {
  beforeEach(() => {
    h.calls.length = 0
    for (const k of Object.keys(h.data)) delete h.data[k]
  })

  it('pide ventas y registro solo del período', async () => {
    await loadStats(RANGE)
    const sales = h.calls.find((c) => c.table === 'filament_sales')!
    expect(sales.filters).toContainEqual(['gte', 'created_at', RANGE.from.toISOString()])
    expect(sales.filters).toContainEqual(['lt', 'created_at', RANGE.to.toISOString()])
    const log = h.calls.find((c) => c.table === 'filament_log')!
    expect(log.filters).toContainEqual(['in', 'kind', STATS_LOG_KINDS])
    expect(log.filters).toContainEqual(['gte', 'created_at', RANGE.from.toISOString()])
  })

  it('fecha de entrega real (último evento) o prometida, filtrada por período', async () => {
    h.data.production_events = [
      { order_id: 'o2', created_at: new Date(2026, 9, 8, 9).toISOString() },
      { order_id: 'o2', created_at: new Date(2026, 9, 7, 9).toISOString() },
    ]
    const { delivered } = await loadStats(RANGE)
    expect(delivered.map((r) => r.id).sort()).toEqual(['o1', 'o2', 't1'])
    expect(delivered.find((r) => r.id === 'o2')).toMatchObject({
      exact: true,
      at: new Date(2026, 9, 8, 9).toISOString(),
    })
    const ev = h.calls.find((c) => c.table === 'production_events')!
    expect(ev.filters).toContainEqual(['eq', 'kind', 'stage'])
    expect(ev.filters).toContainEqual(['eq', 'to_status', 'delivered'])
  })
})

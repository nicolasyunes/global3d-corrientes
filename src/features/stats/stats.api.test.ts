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
      range: () => q,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: data[table] ?? [], error: null }),
    }
    return q
  }
  return { calls, data, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
const listSales = vi.hoisted(() => vi.fn())
vi.mock('@/features/sales/sales.api', () => ({ listSales }))

import { loadStats, STATS_LOG_KINDS } from './stats.api'

const RANGE = { from: new Date(2026, 9, 6), to: new Date(2026, 9, 13) }

describe('loadStats', () => {
  beforeEach(() => {
    listSales.mockReset().mockResolvedValue([])
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

  it('las ventas salen del libro del período, sin las anuladas', async () => {
    listSales.mockResolvedValue([
      { id: 's1', sold_at: '2026-10-07T15:00:00Z', amount: 1000, list_total: 1000, method: 'cash', voided_at: null, order_id: 'o1', customers: null, orders: null, sale_items: [] },
      { id: 's2', sold_at: '2026-10-08T15:00:00Z', amount: 500, list_total: 500, method: 'cash', voided_at: '2026-10-08T16:00:00Z', order_id: null, customers: null, orders: null, sale_items: [] },
    ])
    const { delivered } = await loadStats(RANGE)
    expect(listSales).toHaveBeenCalledWith(RANGE.from, RANGE.to)
    expect(delivered.map((r) => r.id)).toEqual(['s1'])
  })
})

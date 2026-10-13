import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: { table: string; filters: unknown[][] }[] = []
  const data: Record<string, unknown[]> = {}
  const errors: Record<string, string> = {}
  function from(table: string) {
    const entry = { table, filters: [] as unknown[][] }
    calls.push(entry)
    let slice: [number, number] | null = null
    const q = {
      select: () => q,
      in: (...a: unknown[]) => (entry.filters.push(['in', ...a]), q),
      is: (...a: unknown[]) => (entry.filters.push(['is', ...a]), q),
      gte: (...a: unknown[]) => (entry.filters.push(['gte', ...a]), q),
      lt: (...a: unknown[]) => (entry.filters.push(['lt', ...a]), q),
      order: () => q,
      range: (a: number, b: number) => ((slice = [a, b]), q),
      then: (resolve: (v: unknown) => void) => {
        if (errors[table]) return resolve({ data: null, error: { message: errors[table] } })
        const rows = data[table] ?? []
        resolve({ data: slice ? rows.slice(slice[0], slice[1] + 1) : rows, error: null })
      },
    }
    return q
  }
  return { calls, data, errors, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
vi.mock('./stats.api', () => ({
  deliveredMoments: vi.fn().mockResolvedValue(new Map([['o1', '2026-10-08T12:00:00Z']])),
}))

import { loadSummary } from './summary.api'

const RANGE = { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) }
const CMP = { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) }

describe('loadSummary', () => {
  beforeEach(() => {
    h.calls.length = 0
    for (const k of Object.keys(h.data)) delete h.data[k]
    for (const k of Object.keys(h.errors)) delete h.errors[k]
  })

  it('suma las unidades de los ítems de cada pedido', async () => {
    h.data.orders = [
      {
        id: 'o1', customer_id: 'c1', created_at: '2026-10-02T10:00:00Z', due_date: '2026-10-20',
        status: 'new', total_amount: 5000, pending_balance: 1000, flexible: false,
        origin_channel: 'whatsapp', order_items: [{ quantity: 2 }, { quantity: 3 }],
      },
      {
        id: 'o2', customer_id: 'c2', created_at: '2026-10-03T10:00:00Z', due_date: '2026-10-21',
        status: 'new', total_amount: null, pending_balance: null, flexible: true,
        origin_channel: null, order_items: [],
      },
    ]
    const out = await loadSummary(RANGE, null)
    expect(out.orders.map((o) => [o.id, o.quantity])).toEqual([['o1', 5], ['o2', 0]])
    expect(out.orders[0]).not.toHaveProperty('order_items')
  })

  it('cobros de pedidos, ventas directas y filamento con su origen', async () => {
    h.data.transactions = [
      { id: 't1', type: '3d_service', amount: 3000, method: 'cash', transacted_at: '2026-10-02T10:00:00Z' },
      { id: 't2', type: 'product_sale', amount: 800, method: null, transacted_at: '2026-10-03T10:00:00Z' },
    ]
    h.data.filament_sales = [
      { id: 'f1', total: 12000, payment: 'transfer', created_at: '2026-10-04T10:00:00Z' },
    ]
    const out = await loadSummary(RANGE, null)
    expect(out.payments).toEqual([
      { id: 't1', amount: 3000, method: 'cash', at: '2026-10-02T10:00:00Z', source: 'order' },
      { id: 't2', amount: 800, method: null, at: '2026-10-03T10:00:00Z', source: 'direct' },
      { id: 'f1', amount: 12000, method: 'transfer', at: '2026-10-04T10:00:00Z', source: 'filament' },
    ])
  })

  it('excluye anuladas y pide desde el comienzo del período de comparación', async () => {
    await loadSummary(RANGE, CMP)
    const tx = h.calls.find((c) => c.table === 'transactions')!
    expect(tx.filters).toContainEqual(['is', 'voided_at', null])
    expect(tx.filters).toContainEqual(['gte', 'transacted_at', CMP.from.toISOString()])
    expect(tx.filters).toContainEqual(['lt', 'transacted_at', RANGE.to.toISOString()])
    const fs = h.calls.find((c) => c.table === 'filament_sales')!
    expect(fs.filters).toContainEqual(['is', 'voided_at', null])
    expect(fs.filters).toContainEqual(['gte', 'created_at', CMP.from.toISOString()])
  })

  it('sin comparación pide desde el comienzo del período', async () => {
    await loadSummary(RANGE, null)
    const tx = h.calls.find((c) => c.table === 'transactions')!
    expect(tx.filters).toContainEqual(['gte', 'transacted_at', RANGE.from.toISOString()])
  })

  it('devuelve las entregas reales', async () => {
    const out = await loadSummary(RANGE, null)
    expect(out.deliveredAt.get('o1')).toBe('2026-10-08T12:00:00Z')
  })

  it('pagina los cobros: 1001 transacciones llegan completas', async () => {
    h.data.transactions = Array.from({ length: 1001 }, (_, i) => ({
      id: `t${i}`, type: '3d_service', amount: 1, method: 'cash', transacted_at: '2026-10-02T10:00:00Z',
    }))
    const out = await loadSummary(RANGE, null)
    expect(out.payments).toHaveLength(1001)
    expect(out.payments[1000].id).toBe('t1000')
    expect(h.calls.filter((c) => c.table === 'transactions')).toHaveLength(2)
  })

  it('un error de la base rechaza con su mensaje', async () => {
    h.errors.transactions = 'boom'
    await expect(loadSummary(RANGE, null)).rejects.toThrow('boom')
  })
})

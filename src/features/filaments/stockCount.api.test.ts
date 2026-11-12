import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import {
  listCountStatus,
  listStockCounts,
  resolveStockCount,
  submitStockCount,
} from './stockCount.api'

describe('stock count API', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    rpc.mockResolvedValue({ data: { id: 'k1' }, error: null })
  })

  it('submitStockCount manda persona e ítems', async () => {
    const items = [{ color_id: 'c1', refill: false, counted: 3 }]
    await submitStockCount('op1', items)
    expect(rpc).toHaveBeenCalledWith('submit_stock_count', {
      p_operator: 'op1',
      p_items: items,
    })
  })

  it('resolveStockCount manda conteo, persona y decisión', async () => {
    await resolveStockCount('k1', 'op1', true)
    expect(rpc).toHaveBeenCalledWith('resolve_stock_count', {
      p_count: 'k1',
      p_operator: 'op1',
      p_approve: true,
    })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Este conteo ya se resolvió' } })
    await expect(resolveStockCount('k1', 'op1', false)).rejects.toThrow(
      'Este conteo ya se resolvió',
    )
  })

  it('listStockCounts pide los conteos con sus ítems, el más nuevo primero', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'k1', items: [] }], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    from.mockReturnValue({ select })
    const r = await listStockCounts(5)
    expect(from).toHaveBeenCalledWith('stock_counts')
    expect(select).toHaveBeenCalledWith('*, items:stock_count_items(*)')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(5)
    expect(r).toEqual([{ id: 'k1', items: [] }])
  })

  it('listCountStatus pide solo fecha y estado', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    from.mockReturnValue({ select })
    await listCountStatus()
    expect(select).toHaveBeenCalledWith('created_at, status')
    expect(limit).toHaveBeenCalledWith(60)
  })
})

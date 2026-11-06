import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import { createSale, editSale, listSales, voidSale } from './sales.api'

const payload = {
  channel: 'local' as const,
  customer_id: null,
  method: 'cash' as const,
  discount: 0,
  note: null,
  items: [
    {
      product_id: 'p1',
      description: 'Vaso',
      quantity: 1,
      list_unit_price: 100,
      unit_price: 100,
    },
  ],
}

describe('sales API', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    rpc.mockResolvedValue({ data: 's1', error: null })
  })

  it('createSale manda el ticket y quién vende', async () => {
    await expect(createSale(payload, 'op1')).resolves.toBe('s1')
    expect(rpc).toHaveBeenCalledWith('create_sale', {
      p: payload,
      p_operator: 'op1',
    })
  })

  it('editSale y voidSale mandan venta, persona y datos', async () => {
    await editSale('s1', payload, 'adm')
    expect(rpc).toHaveBeenCalledWith('edit_sale', {
      p_sale: 's1',
      p: payload,
      p_operator: 'adm',
    })
    await voidSale('s1', 'adm', 'mal cargada')
    expect(rpc).toHaveBeenCalledWith('void_sale', {
      p_sale: 's1',
      p_operator: 'adm',
      p_reason: 'mal cargada',
    })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'No hay stock suficiente de Vaso' },
    })
    await expect(createSale(payload, 'op1')).rejects.toThrow(
      'No hay stock suficiente de Vaso',
    )
  })

  it('listSales filtra por fecha y ordena la más nueva primero', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const lt = vi.fn().mockReturnValue({ order })
    const gte = vi.fn().mockReturnValue({ lt })
    const select = vi.fn().mockReturnValue({ gte })
    from.mockReturnValue({ select })
    const a = new Date('2026-11-01T03:00:00Z')
    const b = new Date('2026-11-02T03:00:00Z')
    await listSales(a, b)
    expect(from).toHaveBeenCalledWith('sales')
    expect(gte).toHaveBeenCalledWith('sold_at', a.toISOString())
    expect(lt).toHaveBeenCalledWith('sold_at', b.toISOString())
    expect(order).toHaveBeenCalledWith('sold_at', { ascending: false })
  })
})

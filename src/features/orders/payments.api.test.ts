import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import { listOrderPayments, registerOrderPayment, voidOrderPayment } from './payments.api'

describe('payments API', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    rpc.mockResolvedValue({ data: { id: 'p1' }, error: null })
  })

  it('registerOrderPayment manda pedido, monto, medio, persona y nota', async () => {
    await registerOrderPayment('o1', 5000, 'transfer', 'op1', 'seña')
    expect(rpc).toHaveBeenCalledWith('register_order_payment', {
      p_order: 'o1', p_amount: 5000, p_method: 'transfer', p_operator: 'op1', p_note: 'seña',
    })
  })

  it('voidOrderPayment manda cobro, persona y motivo', async () => {
    await voidOrderPayment('p1', 'op1', 'error de carga')
    expect(rpc).toHaveBeenCalledWith('void_order_payment', {
      p_tx: 'p1', p_operator: 'op1', p_reason: 'error de carga',
    })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'El cobro supera el saldo (queda $500)' } })
    await expect(registerOrderPayment('o1', 9999, 'cash', 'op1')).rejects.toThrow(
      'El cobro supera el saldo (queda $500)',
    )
  })

  it('listOrderPayments pide los cobros del pedido, el más nuevo primero', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    const eqType = vi.fn().mockReturnValue({ order })
    const eqOrder = vi.fn().mockReturnValue({ eq: eqType })
    const select = vi.fn().mockReturnValue({ eq: eqOrder })
    from.mockReturnValue({ select })
    const r = await listOrderPayments('o1')
    expect(from).toHaveBeenCalledWith('transactions')
    expect(eqOrder).toHaveBeenCalledWith('order_id', 'o1')
    expect(eqType).toHaveBeenCalledWith('type', '3d_service')
    expect(order).toHaveBeenCalledWith('transacted_at', { ascending: false })
    expect(r).toEqual([{ id: 'p1' }])
  })
})

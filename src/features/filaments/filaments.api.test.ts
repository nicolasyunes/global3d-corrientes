import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above plain consts, so the mock state must be hoisted too.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from: vi.fn() } }))

import {
  adjustFilament,
  sellFilament,
  takeFilament,
  voidFilamentSale,
} from './filaments.api'

describe('filament RPCs', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { id: 'x' }, error: null })
  })

  it('sellFilament manda cantidad, cobro y cliente', async () => {
    await sellFilament('c1', false, 2, 'cash', 'op1', 'Juan')
    expect(rpc).toHaveBeenCalledWith('sell_filament', {
      p_color: 'c1',
      p_refill: false,
      p_qty: 2,
      p_payment: 'cash',
      p_operator: 'op1',
      p_customer: 'Juan',
    })
  })

  it('takeFilament manda el motivo y la nota', async () => {
    await takeFilament('c1', true, 1, 'personal', 'op1', 'para muestra')
    expect(rpc).toHaveBeenCalledWith('take_filament', {
      p_color: 'c1',
      p_refill: true,
      p_qty: 1,
      p_kind: 'personal',
      p_operator: 'op1',
      p_note: 'para muestra',
    })
  })

  it('adjustFilament y voidFilamentSale usan sus RPC', async () => {
    await adjustFilament('c1', false, -1, 'op1', 'rollo fallado')
    await voidFilamentSale('s1', 'op1', 'error')
    expect(rpc).toHaveBeenNthCalledWith(1, 'adjust_filament', {
      p_color: 'c1',
      p_refill: false,
      p_delta: -1,
      p_operator: 'op1',
      p_note: 'rollo fallado',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'void_filament_sale', {
      p_sale: 's1',
      p_operator: 'op1',
      p_reason: 'error',
    })
  })

  it('relanza el mensaje de la base', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'No hay stock suficiente (quedan 0)' },
    })
    await expect(sellFilament('c1', false, 1, 'cash', 'op1', '')).rejects.toThrow(
      'No hay stock suficiente (quedan 0)',
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft, type OrderDraft } from './orderDraft'

// Minimal Supabase fake: every query resolves to whatever `respond` returns
// for that table + operation, and every insert is recorded.
type Op = 'select' | 'insert' | 'update' | 'delete'
const calls: { table: string; op: Op; payload?: unknown }[] = []
let respond: (table: string, op: Op, payload?: unknown) => unknown

function builder(table: string) {
  let op: Op = 'select'
  let payload: unknown
  const q = {
    select: () => q,
    insert: (p: unknown) => ((op = 'insert'), (payload = p), q),
    update: (p: unknown) => ((op = 'update'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
    eq: () => q,
    in: () => q,
    order: () => q,
    single: () => q,
    maybeSingle: () => q,
    then: (resolve: (v: unknown) => void) => {
      calls.push({ table, op, payload })
      resolve({ data: respond(table, op, payload), error: null, count: 0 })
    },
  }
  return q
}

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table), rpc },
}))

import { createOrderFromDraft, sameName } from './orderSave.api'

function draft(over: Partial<OrderDraft>): OrderDraft {
  return {
    ...emptyDraft(),
    items: [{ product: 'Vaso', quantity: '1', details: '' }],
    dueDate: '2026-10-10',
    ...over,
  }
}

beforeEach(() => {
  calls.length = 0
  rpc.mockReset()
  rpc.mockResolvedValue({ data: { id: 'p1' }, error: null })
  respond = (table, op) => {
    if (table === 'customers' && op === 'select')
      return [{ id: 'old', name: 'pelotin' }]
    if (table === 'customers' && op === 'insert') return { id: 'new' }
    if (table === 'orders') return { id: 'o1' }
    if (table === 'order_items') return [{ id: 'i1', position: 0 }]
    return null
  }
})

describe('createOrderFromDraft — nombre del cliente', () => {
  it('no usa el nombre de otro cliente que tenga el mismo teléfono', async () => {
    await createOrderFromDraft(
      draft({ customerName: 'Juan Pérez', customerPhone: '123123123' }),
    )
    expect(calls).toContainEqual({
      table: 'customers',
      op: 'insert',
      payload: { name: 'Juan Pérez', phone: '123123123' },
    })
    const order = calls.find((c) => c.table === 'orders')
    expect(order?.payload).toMatchObject({ customer_id: 'new' })
  })

  it('reusa el cliente si el teléfono y el nombre coinciden', async () => {
    await createOrderFromDraft(
      draft({ customerName: ' Pelotín ', customerPhone: '123123123' }),
    )
    expect(
      calls.some((c) => c.table === 'customers' && c.op === 'insert'),
    ).toBe(false)
    const order = calls.find((c) => c.table === 'orders')
    expect(order?.payload).toMatchObject({ customer_id: 'old' })
  })
})

describe('createOrderFromDraft — seña como cobro', () => {
  it('la seña no va en el pedido: se registra como cobro', async () => {
    await createOrderFromDraft(
      draft({ total: '10000', deposit: '3000', depositMethod: 'cash', channel: 'instagram' }),
      'op1',
    )
    const orderInsert = calls.find((c) => c.table === 'orders' && c.op === 'insert')!
    expect(orderInsert.payload).toMatchObject({ deposit: null, pending_balance: 10000 })
    expect(rpc).toHaveBeenCalledWith('register_order_payment', expect.objectContaining({
      p_amount: 3000, p_method: 'cash', p_operator: 'op1',
    }))
  })

  it('sin seña no llama a la función de cobros', async () => {
    await createOrderFromDraft(draft({ total: '10000', channel: 'local' }), 'op1')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('si el cobro falla, el pedido igual se guarda y vuelve un aviso', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Cargá primero el total del pedido' } })
    const r = await createOrderFromDraft(
      draft({ total: '10000', deposit: '3000', depositMethod: 'cash' }),
      'op1',
    )
    expect(r.paymentWarning).toContain('Cargá primero el total del pedido')
  })
})

describe('sameName', () => {
  it('ignora mayúsculas, tildes y espacios', () => {
    expect(sameName('  José  Luis ', 'jose luis')).toBe(true)
    expect(sameName('Ana', 'Anabel')).toBe(false)
  })
})

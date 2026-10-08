import { describe, expect, it } from 'vitest'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import type { ProductSaleRow } from '@/features/orders/productSales.api'
import {
  comparisonRange,
  deliveredSummary,
  type DeliveredRow,
  exitsByPerson,
  exitsByReason,
  inRange,
  pctChange,
  periodRange,
  previousRange,
  salesSummary,
  toDeliveredRows,
  topColors,
} from './stats'

// Thursday 8 Oct 2026, 15:30 local time.
const NOW = new Date(2026, 9, 8, 15, 30)
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

function sale(over: Partial<FilamentSale>): FilamentSale {
  return {
    id: 's',
    created_at: new Date(2026, 9, 8, 10, 0).toISOString(),
    operator_id: 'op-1',
    color_id: 'c1',
    line_label: '3N3 PLA',
    color_label: 'Rojo',
    refill: false,
    quantity: 1,
    unit_price: 12000,
    total: 12000,
    payment: 'cash',
    customer: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...over,
  }
}

function log(over: Partial<FilamentLogRow>): FilamentLogRow {
  return {
    id: 'l',
    created_at: new Date(2026, 9, 8, 10, 0).toISOString(),
    operator_id: 'op-1',
    kind: 'used',
    line_label: '3N3 PLA',
    color_label: 'Rojo',
    refill: false,
    delta: -1,
    note: null,
    ...over,
  }
}

describe('periodRange', () => {
  it('hoy es el día local completo', () => {
    expect(periodRange('today', NOW)).toEqual({ from: d(2026, 10, 8), to: d(2026, 10, 9) })
  })
  it('la semana arranca el lunes', () => {
    expect(periodRange('week', NOW)).toEqual({ from: d(2026, 10, 5), to: d(2026, 10, 12) })
  })
  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(periodRange('week', new Date(2026, 9, 11, 9))).toEqual({
      from: d(2026, 10, 5),
      to: d(2026, 10, 12),
    })
  })
  it('mes calendario', () => {
    expect(periodRange('month', NOW)).toEqual({ from: d(2026, 10, 1), to: d(2026, 11, 1) })
  })
  it('rango libre incluye el último día', () => {
    expect(periodRange('custom', NOW, { from: '2026-09-01', to: '2026-09-15' })).toEqual({
      from: d(2026, 9, 1),
      to: d(2026, 9, 16),
    })
  })
  it('rango libre con fechas invertidas las intercambia', () => {
    expect(periodRange('custom', NOW, { from: '2026-09-15', to: '2026-09-01' })).toEqual({
      from: d(2026, 9, 1),
      to: d(2026, 9, 16),
    })
  })
})

describe('comparisonRange', () => {
  it('hoy: ayer hasta la misma hora', () => {
    expect(comparisonRange('today', periodRange('today', NOW), NOW)).toEqual({
      from: d(2026, 10, 7),
      to: new Date(2026, 9, 7, 15, 30),
    })
  })
  it('semana: lunes anterior hasta jueves a la misma hora', () => {
    expect(comparisonRange('week', periodRange('week', NOW), NOW)).toEqual({
      from: d(2026, 9, 28),
      to: new Date(2026, 9, 1, 15, 30),
    })
  })
  it('mes: mes anterior hasta el mismo día y hora', () => {
    expect(comparisonRange('month', periodRange('month', NOW), NOW)).toEqual({
      from: d(2026, 9, 1),
      to: new Date(2026, 8, 8, 15, 30),
    })
  })
  it('nunca pasa del fin del período anterior', () => {
    const at = new Date(2026, 2, 31, 12) // March vs 28-day February
    expect(comparisonRange('month', periodRange('month', at), at).to).toEqual(d(2026, 3, 1))
  })
  it('rango libre: período anterior completo', () => {
    const r = periodRange('custom', NOW, { from: '2026-09-11', to: '2026-09-20' })
    expect(comparisonRange('custom', r, NOW)).toEqual({ from: d(2026, 9, 1), to: d(2026, 9, 11) })
  })
})

describe('previousRange', () => {
  it('semana anterior', () => {
    expect(previousRange('week', periodRange('week', NOW))).toEqual({
      from: d(2026, 9, 28),
      to: d(2026, 10, 5),
    })
  })
  it('mes anterior es el mes calendario anterior', () => {
    expect(previousRange('month', periodRange('month', NOW))).toEqual({
      from: d(2026, 9, 1),
      to: d(2026, 10, 1),
    })
  })
  it('rango libre: misma cantidad de días justo antes', () => {
    const r = periodRange('custom', NOW, { from: '2026-09-11', to: '2026-09-20' })
    expect(previousRange('custom', r)).toEqual({ from: d(2026, 9, 1), to: d(2026, 9, 11) })
  })
})

describe('inRange', () => {
  const week = periodRange('week', NOW)
  it('acepta ISO y fecha sola', () => {
    expect(inRange(new Date(2026, 9, 5, 0, 0).toISOString(), week)).toBe(true)
    expect(inRange('2026-10-11', week)).toBe(true)
    expect(inRange('2026-10-12', week)).toBe(false)
    expect(inRange('2026-10-04', week)).toBe(false)
  })
})

describe('toDeliveredRows', () => {
  const order = {
    id: 'o1',
    due_date: '2026-10-01',
    total_amount: 55000,
    title: 'Trofeo',
    product_type: 'other',
    origin_channel: null,
    customers: { name: 'María', phone: null },
  } as unknown as OrderWithCustomer
  const direct = {
    id: 't1',
    transacted_at: new Date(2026, 9, 7, 18, 0).toISOString(),
    amount: 8000,
    method: 'transfer',
    note: 'Llavero',
    customers: null,
    products: null,
  } as unknown as ProductSaleRow

  it('usa la fecha real de entrega si existe', () => {
    const at = new Date(2026, 9, 3, 11, 20).toISOString()
    const [row] = toDeliveredRows([order], [], new Map([['o1', at]]))
    expect(row).toMatchObject({ id: 'o1', kind: 'order', at, exact: true, amount: 55000, method: null })
  })
  it('si no, la fecha prometida', () => {
    const [row] = toDeliveredRows([order], [], new Map())
    expect(row).toMatchObject({ at: '2026-10-01', exact: false })
  })
  it('ventas directas con forma de cobro, más nuevo primero', () => {
    const rows = toDeliveredRows([order], [direct], new Map())
    expect(rows.map((r) => r.id)).toEqual(['t1', 'o1'])
    expect(rows[0]).toMatchObject({ kind: 'product', exact: true, method: 'transfer', amount: 8000 })
  })
  it('conserva la forma de cobro tal cual y null si falta', () => {
    const one = (method: string | null) =>
      toDeliveredRows([], [{ ...direct, method } as ProductSaleRow], new Map())[0].method
    expect(one('uala')).toBe('uala')
    expect(one('mercadopago')).toBe('mercadopago')
    expect(one(null)).toBeNull()
  })
})

describe('salesSummary', () => {
  it('suma por forma de cobro y deja afuera las anuladas', () => {
    const s = salesSummary([
      sale({ id: 'a', quantity: 2, total: 24000, payment: 'cash' }),
      sale({ id: 'b', total: 12000, payment: 'transfer' }),
      sale({ id: 'c', total: 12000, payment: 'cash', voided_at: 'x', void_reason: 'error' }),
    ])
    expect(s).toEqual({ count: 2, units: 3, total: 36000, cash: 24000, transfer: 12000, voided: 1 })
  })
})

describe('deliveredSummary', () => {
  const row = (over: Partial<DeliveredRow>): DeliveredRow => ({
    id: 'x', kind: 'product', at: '2026-10-02', exact: true, customerName: null,
    productLabel: 'x', amount: 1000, method: null, href: null, ...over,
  })
  it('separa pedidos y ventas directas', () => {
    const s = deliveredSummary([
      row({ id: 'o1', kind: 'order', amount: 55000 }),
      row({ id: 'o2', kind: 'order', amount: null }),
      row({ id: 't1', amount: 8000, method: 'transfer' }),
      row({ id: 't2', amount: 3000, method: 'cash' }),
    ])
    expect(s).toEqual({
      orders: 2, ordersAmount: 55000, direct: 2, directAmount: 11000, cash: 3000, transfer: 8000, other: 0,
    })
  })
  it('Mercado Pago es transferencia; Ualá, Brubank, otro y sin dato van a otros', () => {
    const s = deliveredSummary([
      row({ amount: 100, method: 'mercadopago' }),
      row({ amount: 10, method: 'uala' }),
      row({ amount: 20, method: 'brubank' }),
      row({ amount: 30, method: 'other' }),
      row({ amount: 40, method: null }),
      row({ kind: 'order', amount: 999, method: null }),
    ])
    expect(s).toMatchObject({ cash: 0, transfer: 100, other: 100 })
  })
})

describe('exitsByReason / exitsByPerson', () => {
  const rows = [
    log({ kind: 'used', delta: -2 }),
    log({ kind: 'transfer', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'personal', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'adjust', delta: -3 }),
    log({ kind: 'adjust', delta: 2, operator_id: 'op-2' }),
    log({ kind: 'count', delta: 4 }),
    log({ kind: 'sale', delta: -3, operator_id: 'op-2' }),
    log({ kind: 'purchase', delta: 10 }),
  ]
  const sales = [
    sale({ id: 'a', operator_id: 'op-2', quantity: 2 }),
    sale({ id: 'b', operator_id: 'op-2', quantity: 5, voided_at: 'x', void_reason: 'e' }),
    sale({ id: 'c', operator_id: 'op-3', quantity: 1 }),
  ]
  it('cuenta movimientos y unidades por motivo (ajuste y conteo con signo)', () => {
    const r = exitsByReason(rows)
    expect(r.used).toEqual({ moves: 1, units: 2 })
    expect(r.transfer).toEqual({ moves: 1, units: 1 })
    expect(r.personal).toEqual({ moves: 1, units: 1 })
    expect(r.adjust).toEqual({ moves: 2, units: -1 })
    expect(r.count).toEqual({ moves: 1, units: 4 })
  })
  it('por persona: vendió sale de ventas no anuladas; ajuste con signo', () => {
    expect(exitsByPerson(rows, sales)).toEqual([
      { operatorId: 'op-2', sale: 2, used: 0, transfer: 1, personal: 1, adjust: 2 },
      { operatorId: 'op-1', sale: 0, used: 2, transfer: 0, personal: 0, adjust: -3 },
      { operatorId: 'op-3', sale: 1, used: 0, transfer: 0, personal: 0, adjust: 0 },
    ])
  })
  it('quien solo vendió aparece; una venta anulada no suma', () => {
    expect(exitsByPerson([], [sale({ operator_id: 'op-9', quantity: 3 })])).toEqual([
      { operatorId: 'op-9', sale: 3, used: 0, transfer: 0, personal: 0, adjust: 0 },
    ])
    expect(exitsByPerson([], [sale({ voided_at: 'x', void_reason: 'e' })])).toEqual([])
  })
})

describe('topColors', () => {
  it('agrupa por color y línea, sin anuladas', () => {
    expect(
      topColors([
        sale({ id: 'a', quantity: 2, total: 24000 }),
        sale({ id: 'b', color_label: 'Azul', total: 12000 }),
        sale({ id: 'c', quantity: 1, total: 12000 }),
        sale({ id: 'd', color_label: 'Azul', quantity: 5, total: 60000, voided_at: 'x', void_reason: 'e' }),
      ]),
    ).toEqual([
      { label: 'Rojo · 3N3 PLA', units: 3, total: 36000 },
      { label: 'Azul · 3N3 PLA', units: 1, total: 12000 },
    ])
  })
})

describe('pctChange', () => {
  it('variación porcentual; null sin base', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
    expect(pctChange(10, 0)).toBeNull()
  })
})

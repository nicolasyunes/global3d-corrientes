import { describe, expect, it } from 'vitest'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import type { ProductSaleRow } from '@/features/orders/productSales.api'
import {
  deliveredSummary,
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
  it('una forma de cobro desconocida queda en null', () => {
    const [row] = toDeliveredRows([], [{ ...direct, method: 'other' } as ProductSaleRow], new Map())
    expect(row.method).toBeNull()
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
  it('separa pedidos y ventas directas', () => {
    const s = deliveredSummary([
      { id: 'o1', kind: 'order', at: '2026-10-01', exact: false, customerName: null, productLabel: 'x', amount: 55000, method: null, href: null },
      { id: 'o2', kind: 'order', at: '2026-10-02', exact: false, customerName: null, productLabel: 'x', amount: null, method: null, href: null },
      { id: 't1', kind: 'product', at: '2026-10-02', exact: true, customerName: null, productLabel: 'x', amount: 8000, method: 'transfer', href: null },
      { id: 't2', kind: 'product', at: '2026-10-02', exact: true, customerName: null, productLabel: 'x', amount: 3000, method: 'cash', href: null },
    ])
    expect(s).toEqual({ orders: 2, ordersAmount: 55000, direct: 2, directAmount: 11000, cash: 3000, transfer: 8000 })
  })
})

describe('exitsByReason / exitsByPerson', () => {
  const rows = [
    log({ kind: 'used', delta: -2 }),
    log({ kind: 'transfer', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'personal', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'adjust', delta: -1 }),
    log({ kind: 'adjust', delta: 2 }),
    log({ kind: 'sale', delta: -3, operator_id: 'op-2' }),
    log({ kind: 'purchase', delta: 10 }),
  ]
  it('cuenta movimientos y unidades por motivo (ajuste = neto)', () => {
    const r = exitsByReason(rows)
    expect(r.used).toEqual({ moves: 1, units: 2 })
    expect(r.transfer).toEqual({ moves: 1, units: 1 })
    expect(r.personal).toEqual({ moves: 1, units: 1 })
    expect(r.adjust).toEqual({ moves: 2, units: 1 })
    expect(r.count).toEqual({ moves: 0, units: 0 })
  })
  it('por persona, ordenado por unidades', () => {
    expect(exitsByPerson(rows)).toEqual([
      { operatorId: 'op-2', sale: 3, used: 0, transfer: 1, personal: 1, adjust: 0 },
      { operatorId: 'op-1', sale: 0, used: 2, transfer: 0, personal: 0, adjust: 1 },
    ])
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

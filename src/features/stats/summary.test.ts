import { describe, expect, it } from 'vitest'
import {
  byChannel,
  collected,
  collectedByMethod,
  newCustomers,
  onTimeRate,
  ordersByWeek,
  pointsDiff,
  receivable,
  sold,
  ticketAverage,
  type SummaryOrder,
  type SummaryPayment,
} from './summary'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString()
const OCT = { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) }

function order(over: Partial<SummaryOrder> = {}): SummaryOrder {
  return {
    id: 'o',
    customer_id: 'c1',
    created_at: at(2026, 10, 5),
    due_date: '2026-10-20',
    status: 'in_queue',
    total_amount: 10000,
    pending_balance: 0,
    flexible: false,
    origin_channel: 'whatsapp',
    quantity: 1,
    ...over,
  }
}

function pay(over: Partial<SummaryPayment> = {}): SummaryPayment {
  return { id: 'p', amount: 1000, method: 'cash', at: at(2026, 10, 5), source: 'order', ...over }
}

describe('sold', () => {
  it('cuenta por alta, sin cancelados, con unidades', () => {
    const rows = [
      order({ id: 'a', total_amount: 10000, quantity: 2 }),
      order({ id: 'b', total_amount: 5000, quantity: 3 }),
      order({ id: 'c', status: 'cancelled', total_amount: 99999 }),
      order({ id: 'd', created_at: at(2026, 9, 28), total_amount: 7000 }),
    ]
    expect(sold(rows, OCT)).toEqual({
      amount: 15000,
      orders: 2,
      units: 5,
      withAmount: 2,
      withoutAmount: 0,
    })
  })

  it('los pedidos sin monto cuentan como pedido pero no suman ni promedian', () => {
    const rows = [order({ id: 'a', total_amount: 9000 }), order({ id: 'b', total_amount: null })]
    const s = sold(rows, OCT)
    expect(s).toMatchObject({ amount: 9000, orders: 2, withAmount: 1, withoutAmount: 1 })
    expect(ticketAverage(s)).toBe(9000)
  })

  it('período vacío: ticket nulo', () => {
    expect(ticketAverage(sold([], OCT))).toBeNull()
  })
})

describe('collected', () => {
  it('suma por origen y respeta el período', () => {
    const rows = [
      pay({ id: '1', amount: 1000, source: 'order' }),
      pay({ id: '2', amount: 500, source: 'direct' }),
      pay({ id: '3', amount: 2500, source: 'filament' }),
      pay({ id: '4', amount: 9999, at: at(2026, 9, 30) }),
    ]
    expect(collected(rows, OCT)).toEqual({
      total: 4000,
      count: 3,
      orders: 1000,
      direct: 500,
      filament: 2500,
    })
  })
})

describe('collectedByMethod', () => {
  it('agrupa otros medios y marca el que no tiene', () => {
    const rows = [
      pay({ id: '1', amount: 3000, method: 'cash' }),
      pay({ id: '2', amount: 1000, method: 'uala' }),
      pay({ id: '3', amount: 1000, method: 'brubank' }),
      pay({ id: '4', amount: 2000, method: null }),
      pay({ id: '5', amount: 3000, method: 'transfer' }),
    ]
    const out = collectedByMethod(rows, OCT)
    // A igual monto, desempata por etiqueta: "Otros" antes que "Sin medio".
    expect(out.map((r) => [r.key, r.value])).toEqual([
      ['cash', 3000],
      ['transfer', 3000],
      ['other', 2000],
      ['none', 2000],
    ])
    expect(out.find((r) => r.key === 'none')?.label).toBe('Sin medio')
    expect(out.reduce((s, r) => s + r.pct, 0)).toBeGreaterThanOrEqual(99)
  })

  it('sin cobros: lista vacía', () => {
    expect(collectedByMethod([], OCT)).toEqual([])
  })
})

describe('receivable', () => {
  const cutoff = new Date(2026, 8, 30)

  it('cuenta saldos desde el corte y aparta los anteriores', () => {
    const rows = [
      order({ id: 'a', pending_balance: 4000 }),
      order({ id: 'b', pending_balance: 1000, created_at: at(2026, 9, 29) }),
      order({ id: 'c', pending_balance: 0 }),
      order({ id: 'd', pending_balance: 8000, status: 'cancelled' }),
      order({ id: 'e', pending_balance: null }),
    ]
    expect(receivable(rows, cutoff)).toEqual({
      amount: 4000,
      orders: 1,
      legacyOrders: 1,
      legacyAmount: 1000,
    })
  })
})

describe('onTimeRate', () => {
  const deliveredAt = new Map([
    ['a', at(2026, 10, 18)], // a tiempo (vence 20)
    ['b', at(2026, 10, 22)], // tarde
    ['c', at(2026, 10, 10)], // flexible: fuera
    ['e', at(2026, 9, 10)], // fuera del período
  ])

  it('porcentaje sobre entregados con fecha real, sin flexibles', () => {
    const rows = [
      order({ id: 'a' }),
      order({ id: 'b' }),
      order({ id: 'c', flexible: true }),
      order({ id: 'd' }), // sin evento de entrega
      order({ id: 'e' }),
    ]
    expect(onTimeRate(rows, deliveredAt, OCT)).toEqual({ total: 2, late: 1, rate: 50 })
  })

  it('el día de vencimiento cuenta como a tiempo', () => {
    const map = new Map([['a', at(2026, 10, 20, 23)]])
    expect(onTimeRate([order({ id: 'a', due_date: '2026-10-20' })], map, OCT).rate).toBe(100)
  })

  it('sin entregas: tasa nula', () => {
    expect(onTimeRate([order()], new Map(), OCT)).toEqual({ total: 0, late: 0, rate: null })
  })
})

describe('newCustomers', () => {
  it('es nuevo quien tuvo su primer pedido en el período', () => {
    const rows = [
      order({ id: 'a', customer_id: 'viejo', created_at: at(2026, 8, 3) }),
      order({ id: 'b', customer_id: 'viejo', created_at: at(2026, 10, 3) }),
      order({ id: 'c', customer_id: 'nuevo', created_at: at(2026, 10, 4) }),
      order({ id: 'd', customer_id: 'nuevo', created_at: at(2026, 10, 9) }),
      order({ id: 'e', customer_id: 'cancelado', created_at: at(2026, 10, 9), status: 'cancelled' }),
      order({ id: 'f', customer_id: 'futuro', created_at: at(2026, 11, 2) }),
    ]
    expect(newCustomers(rows, OCT)).toEqual({ fresh: 1, total: 2 })
  })
})

describe('ordersByWeek', () => {
  // Martes 13 de octubre de 2026.
  const NOW = new Date(2026, 9, 13, 12)

  it('8 semanas de lunes a domingo; la última en curso es parcial', () => {
    const rows = [
      order({ id: 'a', created_at: at(2026, 10, 13) }),
      order({ id: 'b', created_at: at(2026, 10, 7) }),
      order({ id: 'c', created_at: at(2026, 10, 5) }),
      order({ id: 'x', created_at: at(2026, 10, 6), status: 'cancelled' }),
    ]
    const bars = ordersByWeek(rows, OCT, NOW)
    expect(bars).toHaveLength(8)
    expect(bars[7]).toMatchObject({ label: '12/10', count: 1, partial: true })
    expect(bars[6]).toMatchObject({ label: '5/10', count: 2, partial: false })
    expect(bars[0].label).toBe('24/8')
  })

  it('un período cerrado termina en su última semana', () => {
    const sep = { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) }
    const bars = ordersByWeek([], sep, NOW)
    expect(bars[7].label).toBe('28/9')
    expect(bars[7].partial).toBe(false)
  })
})

describe('byChannel', () => {
  it('agrupa WhatsApp, deja el nulo como "Sin canal" y ordena', () => {
    const rows = [
      order({ id: 'a', origin_channel: 'whatsapp' }),
      order({ id: 'b', origin_channel: 'whatsapp_personal' }),
      order({ id: 'c', origin_channel: 'instagram' }),
      order({ id: 'd', origin_channel: null }),
      order({ id: 'e', origin_channel: 'mercadolibre' }),
      order({ id: 'f', origin_channel: 'instagram', status: 'cancelled' }),
    ]
    const out = byChannel(rows, OCT)
    expect(out[0]).toMatchObject({ key: 'whatsapp', label: 'WhatsApp', value: 2, pct: 40 })
    expect(out.map((r) => r.label)).toContain('Sin canal')
    expect(out.map((r) => r.label)).toContain('Mercado Libre')
    expect(out.reduce((s, r) => s + r.value, 0)).toBe(5)
  })
})

describe('pointsDiff', () => {
  it('diferencia en puntos o nulo si falta un lado', () => {
    expect(pointsDiff(71, 80)).toBe(-9)
    expect(pointsDiff(null, 80)).toBeNull()
    expect(pointsDiff(71, null)).toBeNull()
  })
})

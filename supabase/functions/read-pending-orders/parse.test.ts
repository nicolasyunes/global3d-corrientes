import { describe, expect, it } from 'vitest'
import { dateSortKey, parseMoneyLoose, toPendingOrders } from './parse.ts'

// Column order in "Pedidos": Columna 1 | CLIENTE | PRODUCTO | DESCRIPCION |
// FECHA DE ENTREGA | Total (ARS) | SEÑA | SALDO | CANAL | ESTADO | (K) order id
function row(overrides: Partial<Record<number, string>> = {}): string[] {
  const base = [
    '',
    'Ada',
    'Vaso',
    'con logo',
    '05/08/2026',
    '$1.000,00',
    '$500,00',
    '$500,00',
    'WhatsApp',
    '',
    'order-1',
  ]
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v
  return base
}

describe('parseMoneyLoose', () => {
  it('accepts app-written and hand-typed formats', () => {
    expect(parseMoneyLoose('$1.000,00')).toBe(1000)
    expect(parseMoneyLoose('1500')).toBe(1500)
    expect(parseMoneyLoose('$ 1.500')).toBe(1500)
    expect(parseMoneyLoose('')).toBeNull()
  })
})

describe('dateSortKey', () => {
  it('turns dd/mm/yyyy into a sortable key and sorts blanks last', () => {
    expect(dateSortKey('05/08/2026')).toBe('2026-08-05')
    expect(dateSortKey('')).toBe('9999-99-99')
  })
})

describe('toPendingOrders', () => {
  it('skips rows with no CLIENTE', () => {
    expect(toPendingOrders([row({ 1: '' })])).toHaveLength(0)
  })

  it('keeps cancelled rows so the Planilla can filter by "Cancelado"', () => {
    const orders = toPendingOrders([row({ 9: 'Cancelado' })])
    expect(orders).toHaveLength(1)
    expect(orders[0].estado).toBe('cancelado')
  })

  it('carries column K through as the order id, blank when absent', () => {
    expect(toPendingOrders([row({ 10: 'order-42' })])[0].id).toBe('order-42')
    expect(toPendingOrders([row({ 10: '' })])[0].id).toBe('')
  })

  it('sorts by delivery date ascending', () => {
    const orders = toPendingOrders([
      row({ 1: 'Later', 4: '20/08/2026' }),
      row({ 1: 'Sooner', 4: '01/08/2026' }),
    ])
    expect(orders.map((o) => o.nombre)).toEqual(['Sooner', 'Later'])
  })
})

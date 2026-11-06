import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  filterSales,
  itemsSummary,
  logLabel,
  salesTotals,
} from './sales'
import type { SaleWithRefs } from './sales.api'

function sale(over: Partial<SaleWithRefs>): SaleWithRefs {
  return {
    id: 's',
    sold_at: '2026-11-06T15:00:00Z',
    channel: 'local',
    customer_id: null,
    order_id: null,
    method: 'cash',
    list_total: 1000,
    discount: 0,
    amount: 1000,
    operator_id: 'op1',
    note: null,
    source_tx_id: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_at: '',
    updated_at: '',
    sale_items: [],
    customers: null,
    orders: null,
    ...over,
  } as SaleWithRefs
}

describe('sales list helpers', () => {
  const rows = [
    sale({ id: 'a', amount: 900, list_total: 1000 }),
    sale({
      id: 'b',
      channel: 'web',
      method: 'transfer',
      customers: { name: 'X', wholesale: true },
    }),
    sale({ id: 'c', voided_at: '2026-11-06T16:00:00Z' }),
    sale({ id: 'd', channel: null }),
  ]

  it('por defecto oculta anuladas y los totales no las suman', () => {
    const v = filterSales(rows, DEFAULT_FILTERS)
    expect(v.map((r) => r.id)).toEqual(['a', 'b', 'd'])
    expect(salesTotals(v)).toEqual({ amount: 2900, count: 3, discounts: 100 })
  })

  it('mostrar anuladas las lista pero siguen sin sumar', () => {
    const v = filterSales(rows, { ...DEFAULT_FILTERS, showVoided: true })
    expect(v).toHaveLength(4)
    expect(salesTotals(v).count).toBe(3)
  })

  it('filtra por canal, sin canal, medio y mayorista', () => {
    expect(
      filterSales(rows, { ...DEFAULT_FILTERS, channel: 'web' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b'])
    expect(
      filterSales(rows, { ...DEFAULT_FILTERS, channel: 'none' }).map(
        (r) => r.id,
      ),
    ).toEqual(['d'])
    expect(
      filterSales(rows, { ...DEFAULT_FILTERS, method: 'transfer' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b'])
    expect(
      filterSales(rows, { ...DEFAULT_FILTERS, wholesale: true }).map(
        (r) => r.id,
      ),
    ).toEqual(['b'])
  })

  it('resume las líneas', () => {
    expect(
      itemsSummary([
        { description: 'Vaso Boca', quantity: 2, position: 0 },
        { description: 'Llavero', quantity: 1, position: 1 },
        { description: 'Mate', quantity: 1, position: 2 },
      ]),
    ).toBe('Vaso Boca ×2 + 2 más')
    expect(
      itemsSummary([{ description: 'Llavero', quantity: 1, position: 0 }]),
    ).toBe('Llavero')
  })

  it('etiqueta del historial', () => {
    const name = (id: string | null) => (id ? 'Nico' : 'Sistema')
    expect(
      logLabel(
        { kind: 'voided', operator_id: 'x', reason: 'mal' } as never,
        name,
      ),
    ).toBe('Anulada por Nico: mal')
    expect(
      logLabel(
        { kind: 'created', operator_id: null, reason: null } as never,
        name,
      ),
    ).toBe('Creada por Sistema')
  })
})

import { describe, expect, it } from 'vitest'
import { filterMovements, groupByDay, movementGroup } from './movements'
import type { ProductLogRow } from './products.api'

function log(over: Partial<ProductLogRow>): ProductLogRow {
  return {
    id: 'l1',
    created_at: '2026-10-19T15:00:00Z',
    operator_id: 'op-1',
    kind: 'in',
    product_id: 'p1',
    product_label: 'Llavero Zelda',
    delta: 5,
    stock_after: 5,
    note: null,
    ...over,
  }
}

describe('movementGroup', () => {
  it('separa entradas, salidas y altas o cambios', () => {
    expect(movementGroup(log({ kind: 'in' }))).toBe('in')
    expect(movementGroup(log({ kind: 'out', delta: -1 }))).toBe('out')
    expect(movementGroup(log({ kind: 'sale', delta: -1 }))).toBe('out')
    expect(movementGroup(log({ kind: 'created' }))).toBe('other')
    expect(movementGroup(log({ kind: 'edited', delta: null }))).toBe('other')
  })

  it('una corrección cuenta según su signo', () => {
    expect(movementGroup(log({ kind: 'adjust', delta: 2 }))).toBe('in')
    expect(movementGroup(log({ kind: 'adjust', delta: -2 }))).toBe('out')
  })
})

describe('filterMovements', () => {
  const rows = [
    log({ id: 'a' }),
    log({ id: 'b', kind: 'out', delta: -1, operator_id: 'op-2' }),
    log({ id: 'c', product_label: 'Vaso Spiderman', note: 'se rompió' }),
  ]
  const all = { kind: 'all' as const, person: 'all', query: '' }

  it('filtra por tipo, persona y texto', () => {
    expect(
      filterMovements(rows, { ...all, kind: 'out' }).map((r) => r.id),
    ).toEqual(['b'])
    expect(
      filterMovements(rows, { ...all, person: 'op-2' }).map((r) => r.id),
    ).toEqual(['b'])
    expect(
      filterMovements(rows, { ...all, query: 'spider' }).map((r) => r.id),
    ).toEqual(['c'])
    expect(
      filterMovements(rows, { ...all, query: 'rompió' }).map((r) => r.id),
    ).toEqual(['c'])
  })
})

describe('groupByDay', () => {
  it('agrupa filas seguidas del mismo día', () => {
    const days = groupByDay([
      log({ id: 'a', created_at: '2026-10-19T15:00:00' }),
      log({ id: 'b', created_at: '2026-10-19T09:00:00' }),
      log({ id: 'c', created_at: '2026-10-18T20:00:00' }),
    ])
    expect(days.map((d) => d.rows.length)).toEqual([2, 1])
  })
})

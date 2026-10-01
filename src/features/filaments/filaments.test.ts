import { describe, expect, it } from 'vitest'
import { designLines } from './fixtures'
import {
  colorFamily,
  filterLines,
  groupByFamily,
  lineSubtitle,
  moveWhen,
  parseMoney,
  stockState,
  summarize,
  type FilamentColor,
} from './filaments'

const lines = designLines()
const byName = (brand: string, name: string) =>
  lines.find((l) => l.brand === brand && l.name === name)!

describe('summarize', () => {
  it('matches the numbers of the design', () => {
    const s = summarize(lines)
    expect(s.spools).toBe(108)
    expect(s.value).toBe(2_612_400)
    expect(s.outOfStock).toBe(83)
    expect(s.colors).toBe(126)
    expect(s.low).toBe(21)
  })
})

describe('stock state and subtitle', () => {
  it('tells out, low and ok apart', () => {
    const c = { stock: 0, stock_refill: null, min_stock: 1 } as FilamentColor
    expect(stockState(c)).toBe('out')
    expect(stockState({ ...c, stock: 1 })).toBe('low')
    expect(stockState({ ...c, stock: 2 })).toBe('ok')
    expect(stockState({ ...c, stock: 0, stock_refill: 3 })).toBe('ok')
  })

  it('describes each line like the cards', () => {
    expect(lineSubtitle(byName('3N3', 'PLA'))).toBe(
      'PLA · 6/22 colores en stock',
    )
    expect(lineSubtitle(byName('Grilon3', 'PLA especial'))).toBe(
      'PLA · Silk · Boutique · Wood · 2/12 colores en stock',
    )
    expect(lineSubtitle(byName('Bambu Lab', 'PLA Lite'))).toBe(
      'PLA · dos presentaciones',
    )
  })
})

describe('filterLines', () => {
  it('filters by material, search and stock', () => {
    const petg = filterLines(lines, {
      material: 'PETG',
      query: '',
      hideEmpty: false,
    })
    expect(petg.map((l) => `${l.brand} ${l.name}`)).toEqual([
      '3N3 PETG',
      'Grilon3 PETG',
    ])

    const rojo = filterLines(lines, {
      material: 'all',
      query: 'rojo',
      hideEmpty: true,
    })
    expect(rojo.flatMap((l) => l.colors.map((c) => c.name))).toEqual([
      'Rojo',
      'Rojo Clear',
      'Rojo',
    ])

    const brand = filterLines(lines, {
      material: 'all',
      query: 'grilon3 pla',
      hideEmpty: false,
    })
    expect(brand[0].colors).toHaveLength(24)
  })
})

describe('por color', () => {
  it('sorts names into families', () => {
    const fam = (name: string, swatch = '#000000', finish = 'Estándar') =>
      colorFamily({ name, swatch, finish })
    expect(fam('Piel 720')).toBe('brown')
    expect(fam('Gold World Cup')).toBe('yellow')
    expect(fam('Salmón')).toBe('pink')
    expect(fam('Bordó')).toBe('red')
    expect(fam('Traslúcido', '#eeeeee', 'Traslúcido')).toBe('multi')
    expect(fam('Matte Graphite Purple')).toBe('violet')
    expect(fam('NOVA', '#8a9097')).toBe('grey')
  })

  it('groups what is in stock like the design', () => {
    const groups = groupByFamily(lines)
    const summary = groups.map((g) => [g.family, g.spools, g.options.length])
    expect(summary).toEqual([
      ['white', 19, 8],
      ['black', 16, 6],
      ['grey', 3, 3],
      ['red', 19, 4],
      ['pink', 9, 3],
      ['orange', 2, 2],
      ['yellow', 12, 7],
      ['green', 3, 2],
      ['blue', 14, 7],
      ['violet', 1, 1],
      ['brown', 9, 3],
      ['multi', 1, 1],
    ])
    expect(groups[0].options[0].color.name).toBe('Blanco Rapid')
  })
})

describe('helpers', () => {
  it('reads prices typed any way', () => {
    expect(parseMoney('$26.600')).toBe(26600)
    expect(parseMoney('21000')).toBe(21000)
    expect(parseMoney('26.600,50')).toBe(26600)
    expect(parseMoney('')).toBeNull()
  })

  it('says when a movement happened', () => {
    const now = new Date('2026-10-01T15:00:00')
    expect(moveWhen('2026-10-01T09:05:00', now)).toBe('hoy 09:05')
    expect(moveWhen('2026-09-30T21:40:00', now)).toBe('ayer 21:40')
    expect(moveWhen('2026-09-12T10:00:00', now)).toMatch(/^12 sept?$/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  parseMoneyLoose,
  parseRolls,
  slugifyInsumo,
  toInsumos,
} from './parse.ts'

// Column order in the "Stock Sync" tab: PRODUCTO | COLOR | ROLLOS | PRECIO | SKU
function row(overrides: Partial<Record<number, string>> = {}): string[] {
  const base = ['3N3 PLA 1kg', 'Negro', '3', '$18.000,00', '3n3-pla-1kg-negro']
  for (const [i, v] of Object.entries(overrides)) base[Number(i)] = v
  return base
}

describe('parseRolls', () => {
  it('reads whole and decimal roll counts, blanks as zero', () => {
    expect(parseRolls('3')).toBe(3)
    expect(parseRolls('3 rollos')).toBe(3)
    expect(parseRolls('3,5')).toBe(3.5)
    expect(parseRolls('')).toBe(0)
    expect(parseRolls('-2')).toBe(0)
  })
})

describe('parseMoneyLoose', () => {
  it('accepts app-written and hand-typed price formats', () => {
    expect(parseMoneyLoose('$18.000,00')).toBe(18000)
    expect(parseMoneyLoose('18000')).toBe(18000)
    expect(parseMoneyLoose('')).toBeNull()
  })
})

describe('slugifyInsumo', () => {
  it('lower-cases, strips accents, dashes the rest', () => {
    expect(slugifyInsumo('3N3 PLA 1kg', 'Rústico')).toBe('3n3-pla-1kg-rustico')
    expect(slugifyInsumo('Grilon3 PLA 1kg especial', 'Dorado Silk')).toBe(
      'grilon3-pla-1kg-especial-dorado-silk',
    )
  })
})

describe('toInsumos', () => {
  it('parses a well-formed row', () => {
    expect(toInsumos([row()])).toEqual([
      {
        sku: '3n3-pla-1kg-negro',
        material: '3N3 PLA 1kg',
        color: 'Negro',
        rolls: 3,
        unit_price: 18000,
      },
    ])
  })

  it('skips rows with no PRODUCTO', () => {
    expect(toInsumos([row({ 0: '' })])).toHaveLength(0)
  })

  it('keeps rows with a blank COLOR', () => {
    expect(toInsumos([row({ 1: '', 4: '' })])[0].sku).toBe('3n3-pla-1kg')
  })

  it('falls back to a slug when the SKU cell is blank', () => {
    expect(toInsumos([row({ 4: '' })])[0].sku).toBe('3n3-pla-1kg-negro')
  })

  it('collapses duplicate skus, last row wins', () => {
    const parsed = toInsumos([row({ 2: '3' }), row({ 2: '7' })])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].rolls).toBe(7)
  })
})

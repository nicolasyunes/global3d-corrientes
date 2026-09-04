import { describe, expect, it } from 'vitest'
import { formatMoney, gramsToRolls, toSheetRow } from './mapping.ts'

describe('gramsToRolls', () => {
  it('renders whole and partial rolls, null as zero', () => {
    expect(gramsToRolls(3000)).toBe('3')
    expect(gramsToRolls(3400)).toBe('3.4')
    expect(gramsToRolls(0)).toBe('0')
    expect(gramsToRolls(null)).toBe('0')
  })
})

describe('formatMoney', () => {
  it('groups thousands the Argentine way, blank when null', () => {
    expect(formatMoney(18000)).toBe('$18.000,00')
    expect(formatMoney(null)).toBe('')
  })
})

describe('toSheetRow', () => {
  it('lays out A:E as PRODUCTO | COLOR | ROLLOS | PRECIO | SKU', () => {
    expect(
      toSheetRow({
        id: 'inv-1',
        sku: '3n3-pla-1kg-negro',
        material: '3N3 PLA 1kg',
        color: 'Negro',
        remaining_grams: 3400,
        unit_price: 18000,
      }),
    ).toEqual([
      '3N3 PLA 1kg',
      'Negro',
      '3.4',
      '$18.000,00',
      '3n3-pla-1kg-negro',
    ])
  })

  it('tolerates null color/price', () => {
    expect(
      toSheetRow({
        id: 'inv-2',
        sku: 'x',
        material: 'PETG',
        color: null,
        remaining_grams: null,
        unit_price: null,
      }),
    ).toEqual(['PETG', '', '0', '', 'x'])
  })
})

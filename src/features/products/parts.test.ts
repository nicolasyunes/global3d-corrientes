import { describe, expect, it } from 'vitest'
import {
  cleanParts,
  findTemplate,
  newPartDraft,
  partsSummary,
  piecesForItem,
  type ProductTemplate,
} from './parts'

const spiderman: ProductTemplate = {
  id: 'p1',
  name: 'Vaso milkshake Spiderman',
  basePrice: 15000,
  imageUrl: null,
  parts: [
    { label: 'cabeza', color: 'rojo', quantity: 1 },
    { label: 'ojos', color: 'negro', quantity: 2 },
  ],
}

describe('findTemplate', () => {
  it('matches the exact name ignoring case, accents and spaces', () => {
    expect(findTemplate('  vaso MILKSHAKE   spiderman ', [spiderman])).toBe(
      spiderman,
    )
  })

  it('does not match partial or free text', () => {
    expect(findTemplate('Vaso milkshake', [spiderman])).toBeNull()
    expect(findTemplate('', [spiderman])).toBeNull()
  })
})

describe('piecesForItem', () => {
  it('multiplies each part by the ordered quantity', () => {
    expect(piecesForItem(spiderman.parts, 3)).toEqual([
      { label: 'cabeza', color: 'rojo', quantity: 3 },
      { label: 'ojos', color: 'negro', quantity: 6 },
    ])
  })

  it('stores a blank color as null and skips unnamed parts', () => {
    expect(
      piecesForItem(
        [
          { label: 'base', color: '  ', quantity: 1 },
          { label: ' ', color: 'rojo', quantity: 1 },
        ],
        1,
      ),
    ).toEqual([{ label: 'base', color: null, quantity: 1 }])
  })
})

describe('cleanParts', () => {
  it('drops empty rows and normalizes quantities', () => {
    expect(
      cleanParts([
        newPartDraft({ label: ' cabeza ', color: ' rojo ' }),
        { ...newPartDraft({ label: 'ojos' }), quantity: '0' },
        newPartDraft(),
      ]),
    ).toEqual([
      { label: 'cabeza', color: 'rojo', quantity: 1 },
      { label: 'ojos', color: '', quantity: 1 },
    ])
  })
})

describe('partsSummary', () => {
  it('counts parts and lists distinct colors', () => {
    expect(partsSummary(spiderman.parts)).toBe('2 piezas · rojo, negro')
    expect(partsSummary([])).toBe('Sin piezas')
  })
})

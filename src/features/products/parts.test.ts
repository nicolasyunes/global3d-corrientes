import { describe, expect, it } from 'vitest'
import {
  cleanParts,
  findTemplate,
  newPartDraft,
  partsSummary,
  piecesForItem,
  productSuggestions,
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

describe('productSuggestions', () => {
  const boca: ProductTemplate = {
    ...spiderman,
    id: 'p2',
    name: 'Vaso Camiseta 650 ml BOCA',
  }
  const templates = [spiderman, boca]

  it('busca por palabras en guardados y en nombres usados', () => {
    const names = productSuggestions('vaso boca', templates, [
      'Vaso texturizado 1 L Boca',
      'Trofeo pádel',
    ]).map((s) => s.name)
    expect(names).toEqual([
      'Vaso Camiseta 650 ml BOCA',
      'Vaso texturizado 1 L Boca',
    ])
  })

  it('marca los productos guardados y no repite nombres', () => {
    const hits = productSuggestions('camiseta', templates, [
      'vaso camiseta 650 ml boca',
    ])
    expect(hits).toEqual([{ name: boca.name, template: boca }])
  })

  it('no sugiere nada sin texto ni lo que ya está escrito igual', () => {
    expect(productSuggestions('  ', templates, [])).toEqual([])
    expect(
      productSuggestions('vaso milkshake spiderman', templates, []),
    ).toEqual([])
  })

  it('ignora acentos', () => {
    expect(
      productSuggestions('padel', [], ['Trofeo pádel']).map((s) => s.name),
    ).toEqual(['Trofeo pádel'])
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

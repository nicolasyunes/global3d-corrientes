import { describe, expect, it } from 'vitest'
import {
  buildCards,
  familyCards,
  selectionForVariant,
  variantLabel,
} from './catalogCards'
import type { Family } from './types'

const vaso = {
  slug: 'vaso-camiseta',
  name: 'Vaso camiseta',
  category: 'vasos',
  description: null,
  saleMode: 'stock',
  leadDays: 3,
  minQty: 1,
  optionAxes: [
    { key: 'cap', label: 'Capacidad' },
    { key: 'club', label: 'Equipo' },
  ],
  variants: [
    {
      id: 'a',
      name: 'x',
      options: { club: 'River', cap: '650 ml' },
      price: 100,
      stock: 2,
      images: ['river.jpg'],
    },
    {
      id: 'b',
      name: 'y',
      options: { club: 'Mandiyú', cap: '1 L' },
      price: 150,
      stock: 0,
      images: [],
    },
  ],
} as unknown as Family

const trofeo = {
  slug: 'trofeo-padel',
  name: 'Trofeo pádel',
  category: 'trofeos',
  description: null,
  saleMode: 'cotizacion',
  leadDays: 7,
  minQty: 1,
  optionAxes: [],
  variants: [],
  images: ['t.jpg'],
} as unknown as Family

describe('catalogCards', () => {
  it('etiqueta con los valores en el orden de optionAxes', () => {
    expect(variantLabel(vaso, vaso.variants[0])).toBe('650 ml · River')
  })

  it('una tarjeta por variante con 2+, una sola para familias sin variantes', () => {
    const cards = buildCards([vaso, trofeo])
    expect(cards.map((c) => c.key)).toEqual([
      'vaso-camiseta:a',
      'vaso-camiseta:b',
      'trofeo-padel',
    ])
    expect(familyCards(trofeo)[0].image).toBe('t.jpg')
  })

  it('usa la foto de la variante o la de la familia como respaldo', () => {
    const [a, b] = familyCards(vaso)
    expect(a.image).toBe('river.jpg')
    expect(b.image).toBe('river.jpg')
    expect(b.availability).toEqual({ kind: 'pedido', days: 3 })
    expect(a.availability).toEqual({ kind: 'stock', units: 2 })
  })

  it('el filtro de stock aplica por variante', () => {
    const cards = buildCards([vaso, trofeo], { onlyStock: true })
    expect(cards.map((c) => c.key)).toEqual(['vaso-camiseta:a'])
  })

  it('busca por opciones sin tildes y deja solo la variante que coincide', () => {
    const cards = buildCards([vaso, trofeo], { query: 'mandiyu' })
    expect(cards.map((c) => c.key)).toEqual(['vaso-camiseta:b'])
    expect(buildCards([vaso], { query: 'vaso 1 l' })).toHaveLength(1)
  })

  it('selectionForVariant devuelve las opciones o null', () => {
    expect(selectionForVariant(vaso, 'b')).toEqual({
      club: 'Mandiyú',
      cap: '1 L',
    })
    expect(selectionForVariant(vaso, 'zzz')).toBeNull()
    expect(selectionForVariant(vaso, null)).toBeNull()
  })
})

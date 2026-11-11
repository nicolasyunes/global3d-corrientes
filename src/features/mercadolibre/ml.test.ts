import { describe, expect, it } from 'vitest'
import {
  expectedMl,
  fabricateTotals,
  listingDiffs,
  listingState,
  rulePrice,
  toFabricate,
  urgency,
} from './ml'

describe('toFabricate', () => {
  it('lo vendido sin stock es lo que hay que imprimir', () => {
    expect(
      toFabricate([
        {
          product_id: 'a',
          description: 'Vaso Boca',
          quantity: 3,
          stock_descontado: 1,
        },
        {
          product_id: 'b',
          description: 'Mate',
          quantity: 1,
          stock_descontado: 1,
        },
        { product_id: null, description: 'Sin vincular', quantity: 2 },
      ]),
    ).toEqual([
      { description: 'Vaso Boca', qty: 2 },
      { description: 'Sin vincular', qty: 2 },
    ])
  })

  it('suma entre ventas', () => {
    expect(
      fabricateTotals([
        { items: [{ product_id: 'a', description: 'Vaso', quantity: 1 }] },
        { items: [{ product_id: 'a', description: 'Vaso', quantity: 2 }] },
        { items: null },
      ]),
    ).toEqual([{ description: 'Vaso', qty: 3 }])
  })
})

describe('urgency', () => {
  const now = new Date('2026-11-11T12:00:00Z')
  it.each([
    ['2026-11-11T11:00:00Z', 'late'],
    ['2026-11-11T20:00:00Z', 'today'],
    ['2026-11-12T20:00:00Z', 'soon'],
    ['2026-11-14T12:00:00Z', 'ok'],
    [null, 'none'],
  ])('%s → %s', (limit, want) => {
    expect(urgency(limit, now)).toBe(want)
  })
})

describe('rulePrice', () => {
  it('igual que la vista: +20% redondeado a 100 hacia arriba', () => {
    const rule = {
      channel: 'ml' as const,
      markup_pct: 20,
      fixed_add: 0,
      round_to: 100,
    }
    expect(rulePrice(11000, rule)).toBe(13200)
    expect(rulePrice(3900, rule)).toBe(4700)
  })
  it('descuento de efectivo', () => {
    const rule = {
      channel: 'efectivo' as const,
      markup_pct: -10,
      fixed_add: 0,
      round_to: 100,
    }
    expect(rulePrice(11000, rule)).toBe(9900)
  })
})

describe('expectedMl', () => {
  it('con stock: real y sin plazo', () => {
    expect(expectedMl(5, true, 'stock', 3)).toEqual({
      stock: 5,
      leadDays: null,
    })
  })
  it('sin stock pero fabricable: 3 con plazo', () => {
    expect(expectedMl(0, true, 'stock', 4)).toEqual({ stock: 3, leadDays: 4 })
  })
  it('sin stock ni plazo, o inactivo: 0', () => {
    expect(expectedMl(0, true, 'stock', 0)).toEqual({
      stock: 0,
      leadDays: null,
    })
    expect(expectedMl(9, false, 'stock', 3)).toEqual({
      stock: 0,
      leadDays: null,
    })
  })
  it('a pedido: siempre con plazo', () => {
    expect(expectedMl(0, true, 'a_pedido', 0)).toEqual({
      stock: 3,
      leadDays: 5,
    })
  })
})

describe('listingState / listingDiffs', () => {
  const base = {
    status: 'active',
    needs_review: false,
    ml_price: 13200,
    ml_stock: 3,
  }
  it('estados', () => {
    expect(listingState(null)).toBe('sin_publicar')
    expect(listingState(base)).toBe('activa')
    expect(listingState({ ...base, status: 'paused' })).toBe('pausada')
    expect(listingState({ ...base, needs_review: true })).toBe('revisar')
  })
  it('detecta diferencias de precio y stock', () => {
    expect(listingDiffs(base, { price: 13200, stock: 3 })).toEqual([])
    expect(listingDiffs(base, { price: 14000, stock: 1 })).toEqual([
      'precio',
      'stock',
    ])
  })
})

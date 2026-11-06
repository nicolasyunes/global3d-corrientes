import { describe, expect, it } from 'vitest'
import {
  buildProductPatch,
  emptyProductDraft,
  parseNonNegativeDecimal,
  parseNonNegativeInt,
  validateProduct,
} from './validation'

describe('buildProductPatch', () => {
  const draft = {
    ...emptyProductDraft(),
    name: ' Vaso Camiseta 650 ml BOCA ',
    basePrice: '26.000',
    stockQuantity: '1',
  }

  it('al editar sin tocar el stock manda el precio y no el stock', () => {
    // El producto se abrió con stock 1 y una venta lo dejó en 0 en la base:
    // guardar el precio no tiene que devolverle la unidad vendida.
    const patch = buildProductPatch(draft, 1)
    expect(patch).toEqual({
      name: 'Vaso Camiseta 650 ml BOCA',
      description: null,
      base_price: 26000,
      active: true,
    })
    expect(patch).not.toHaveProperty('stock_quantity')
  })

  it('manda el stock si se cambió en la ficha', () => {
    expect(
      buildProductPatch({ ...draft, stockQuantity: '3' }, 1),
    ).toMatchObject({ stock_quantity: 3, base_price: 26000 })
  })

  it('un producto nuevo siempre lleva stock', () => {
    expect(buildProductPatch(draft, null)).toMatchObject({ stock_quantity: 1 })
  })
})

describe('parseNonNegativeDecimal', () => {
  it('parses a valid decimal', () => {
    expect(parseNonNegativeDecimal('12.5')).toBe(12.5)
  })

  it('rejects negative values', () => {
    expect(parseNonNegativeDecimal('-1')).toBeNull()
  })

  it('returns null for empty/non-numeric input', () => {
    expect(parseNonNegativeDecimal('')).toBeNull()
    expect(parseNonNegativeDecimal('abc')).toBeNull()
  })
})

describe('parseNonNegativeInt', () => {
  it('parses a valid integer', () => {
    expect(parseNonNegativeInt('5')).toBe(5)
  })

  it('rejects decimals and negatives', () => {
    expect(parseNonNegativeInt('5.5')).toBeNull()
    expect(parseNonNegativeInt('-1')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseNonNegativeInt('')).toBeNull()
  })
})

describe('validateProduct', () => {
  it('requires a name', () => {
    const errors = validateProduct({ ...emptyProductDraft(), name: '' })
    expect(errors.name).toBeDefined()
  })

  it('accepts an empty base price (optional)', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'Llavero',
      basePrice: '',
    })
    expect(errors.basePrice).toBeUndefined()
  })

  it('accepts an AR-formatted price', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'Vaso',
      basePrice: '12.500',
    })
    expect(errors.basePrice).toBeUndefined()
  })

  it('rejects an invalid base price', () => {
    for (const basePrice of ['-5', 'abc']) {
      const errors = validateProduct({
        ...emptyProductDraft(),
        name: 'Llavero',
        basePrice,
      })
      expect(errors.basePrice).toBeDefined()
    }
  })

  it('rejects an invalid stock quantity', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'Llavero',
      stockQuantity: '',
    })
    expect(errors.stockQuantity).toBeDefined()
  })

  it('passes with a valid minimal draft', () => {
    const errors = validateProduct({ ...emptyProductDraft(), name: 'Llavero' })
    expect(errors).toEqual({})
  })
})

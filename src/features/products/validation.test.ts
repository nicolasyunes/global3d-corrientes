import { describe, expect, it } from 'vitest'
import {
  emptyProductDraft,
  parseNonNegativeDecimal,
  parseNonNegativeInt,
  validateProduct,
} from './validation'

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

  it('rejects an invalid base price', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'Llavero',
      basePrice: '-5',
    })
    expect(errors.basePrice).toBeDefined()
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

  it('rechaza un slug con caracteres inválidos', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      slug: 'Con Espacios',
    })
    expect(errors.slug).toBeDefined()
  })

  it('acepta un slug kebab-case válido', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      slug: 'vaso-fernetero-boca',
    })
    expect(errors.slug).toBeUndefined()
  })

  it('rechaza un precio comparativo menor o igual al precio base', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      basePrice: '100',
      compareAtPrice: '100',
    })
    expect(errors.compareAtPrice).toBeDefined()
  })

  it('acepta un precio comparativo mayor al base', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      basePrice: '100',
      compareAtPrice: '150',
    })
    expect(errors.compareAtPrice).toBeUndefined()
  })

  it('rechaza un peso no entero', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      weightGrams: '10.5',
    })
    expect(errors.weightGrams).toBeDefined()
  })

  it('rechaza un SKU con espacios', () => {
    const errors = validateProduct({
      ...emptyProductDraft(),
      name: 'X',
      sku: 'A B',
    })
    expect(errors.sku).toBeDefined()
  })
})

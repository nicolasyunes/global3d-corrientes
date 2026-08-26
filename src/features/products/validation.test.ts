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
    const errors = validateProduct({ ...emptyProductDraft(), name: 'Llavero', basePrice: '' })
    expect(errors.basePrice).toBeUndefined()
  })

  it('rejects an invalid base price', () => {
    const errors = validateProduct({ ...emptyProductDraft(), name: 'Llavero', basePrice: '-5' })
    expect(errors.basePrice).toBeDefined()
  })

  it('rejects an invalid stock quantity', () => {
    const errors = validateProduct({ ...emptyProductDraft(), name: 'Llavero', stockQuantity: '' })
    expect(errors.stockQuantity).toBeDefined()
  })

  it('passes with a valid minimal draft', () => {
    const errors = validateProduct({ ...emptyProductDraft(), name: 'Llavero' })
    expect(errors).toEqual({})
  })
})

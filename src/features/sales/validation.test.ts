import { describe, expect, it } from 'vitest'
import {
  emptySaleDraft,
  parsePositiveDecimal,
  remainingAfterSale,
  validateSale,
} from './validation'
import type { InventoryRow } from './sales.api'

function spool(overrides: Partial<InventoryRow> = {}): InventoryRow {
  return {
    id: 'spool-1',
    sku: null,
    material: 'PLA',
    color: 'black',
    brand: null,
    quantity_grams: 1000,
    remaining_grams: 200,
    unit_price: null,
    active: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('parsePositiveDecimal', () => {
  it('parses a positive decimal', () => {
    expect(parsePositiveDecimal('12.5')).toBe(12.5)
  })

  it('returns null for empty, zero, negative, or invalid input', () => {
    expect(parsePositiveDecimal('')).toBeNull()
    expect(parsePositiveDecimal('0')).toBeNull()
    expect(parsePositiveDecimal('-1')).toBeNull()
    expect(parsePositiveDecimal('abc')).toBeNull()
  })
})

describe('validateSale', () => {
  it('requires a spool, grams, and amount', () => {
    const errors = validateSale(emptySaleDraft(), [])
    expect(errors.inventoryId).toBeTruthy()
    expect(errors.quantityGrams).toBeTruthy()
    expect(errors.amount).toBeTruthy()
  })

  it('passes for a valid, in-stock sale', () => {
    const errors = validateSale(
      {
        inventoryId: 'spool-1',
        quantityGrams: '100',
        amount: '5000',
        method: 'cash',
      },
      [spool()],
    )
    expect(errors).toEqual({})
  })

  it('rejects grams that exceed the spool remaining_grams (client-side pre-check)', () => {
    const errors = validateSale(
      {
        inventoryId: 'spool-1',
        quantityGrams: '500',
        amount: '100',
        method: '',
      },
      [spool({ remaining_grams: 200 })],
    )
    expect(errors.quantityGrams).toBeTruthy()
  })

  it('allows any positive grams when remaining_grams is unset (unknown stock)', () => {
    const errors = validateSale(
      {
        inventoryId: 'spool-1',
        quantityGrams: '9999',
        amount: '100',
        method: '',
      },
      [spool({ remaining_grams: null })],
    )
    expect(errors.quantityGrams).toBeUndefined()
  })
})

describe('remainingAfterSale', () => {
  it('subtracts grams from the spool remaining_grams', () => {
    expect(remainingAfterSale(spool({ remaining_grams: 200 }), 50)).toBe(150)
  })

  it('returns null when no spool, no grams, or unknown stock', () => {
    expect(remainingAfterSale(undefined, 50)).toBeNull()
    expect(remainingAfterSale(spool({ remaining_grams: 200 }), null)).toBeNull()
    expect(remainingAfterSale(spool({ remaining_grams: null }), 50)).toBeNull()
  })
})

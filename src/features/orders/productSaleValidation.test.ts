import { describe, expect, it } from 'vitest'
import type { ProductRow } from '@/features/products/products.api'
import {
  emptyProductSaleDraft,
  FREE_TEXT_PRODUCT,
  parsePositiveInt,
  remainingStockAfterSale,
  selectedCatalogProduct,
  suggestedAmount,
  validateProductSale,
  type ProductSaleDraft,
} from './productSaleValidation'

function product(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'prod-1',
    name: 'Llavero Batman',
    description: null,
    base_price: 1500,
    stock_quantity: 4,
    image_url: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    slug: null,
    sku: null,
    compare_at_price: null,
    custom_on_request: false,
    personalizable: false,
    weight_grams: null,
    category_id: null,
    subcategory: null,
    ...overrides,
  }
}

function draft(overrides: Partial<ProductSaleDraft> = {}): ProductSaleDraft {
  return { ...emptyProductSaleDraft(), amount: '1500', ...overrides }
}

describe('parsePositiveInt', () => {
  it('accepts a positive integer', () => {
    expect(parsePositiveInt('3')).toBe(3)
  })
  it('rejects zero, negatives, decimals and blanks', () => {
    expect(parsePositiveInt('0')).toBeNull()
    expect(parsePositiveInt('-2')).toBeNull()
    expect(parsePositiveInt('1.5')).toBeNull()
    expect(parsePositiveInt('')).toBeNull()
  })
})

describe('selectedCatalogProduct', () => {
  it('resolves a catalog id, and is undefined for blank / free-text', () => {
    const products = [product()]
    expect(selectedCatalogProduct({ productId: 'prod-1' }, products)).toBe(
      products[0],
    )
    expect(selectedCatalogProduct({ productId: '' }, products)).toBeUndefined()
    expect(
      selectedCatalogProduct({ productId: FREE_TEXT_PRODUCT }, products),
    ).toBeUndefined()
  })
})

describe('suggestedAmount', () => {
  it('is base_price * quantity when both are known', () => {
    expect(suggestedAmount(product({ base_price: 1500 }), 3)).toBe(4500)
  })
  it('is null without a price or quantity', () => {
    expect(suggestedAmount(product({ base_price: null }), 2)).toBeNull()
    expect(suggestedAmount(product(), null)).toBeNull()
    expect(suggestedAmount(undefined, 2)).toBeNull()
  })
})

describe('remainingStockAfterSale', () => {
  it('subtracts the quantity from catalog stock', () => {
    expect(remainingStockAfterSale(product({ stock_quantity: 4 }), 3)).toBe(1)
  })
  it('is null without a catalog product or quantity', () => {
    expect(remainingStockAfterSale(undefined, 1)).toBeNull()
    expect(remainingStockAfterSale(product(), null)).toBeNull()
  })
})

describe('validateProductSale', () => {
  const products = [product({ id: 'prod-1', stock_quantity: 4 })]

  it('passes for a valid catalog sale', () => {
    expect(
      validateProductSale(
        draft({ productId: 'prod-1', quantity: '2', amount: '3000' }),
        products,
      ),
    ).toEqual({})
  })

  it('requires a product choice', () => {
    expect(validateProductSale(draft({ productId: '' }), products)).toHaveProperty(
      'productId',
    )
  })

  it('requires a name when the free-text option is chosen', () => {
    const errors = validateProductSale(
      draft({ productId: FREE_TEXT_PRODUCT, productName: '  ' }),
      products,
    )
    expect(errors).toHaveProperty('productName')
  })

  it('accepts a free-text sale with a name and no catalog link', () => {
    expect(
      validateProductSale(
        draft({ productId: FREE_TEXT_PRODUCT, productName: 'Sticker', quantity: '1' }),
        products,
      ),
    ).toEqual({})
  })

  it('rejects a quantity above catalog stock', () => {
    const errors = validateProductSale(
      draft({ productId: 'prod-1', quantity: '9' }),
      products,
    )
    expect(errors.quantity).toContain('4')
  })

  it('rejects a non-positive quantity', () => {
    expect(
      validateProductSale(draft({ productId: 'prod-1', quantity: '0' }), products),
    ).toHaveProperty('quantity')
  })

  it('rejects a missing or non-positive amount', () => {
    expect(
      validateProductSale(draft({ productId: 'prod-1', amount: '' }), products),
    ).toHaveProperty('amount')
    expect(
      validateProductSale(draft({ productId: 'prod-1', amount: '-5' }), products),
    ).toHaveProperty('amount')
  })

  it('does not flag stock when the sale is free-text', () => {
    const errors = validateProductSale(
      draft({ productId: FREE_TEXT_PRODUCT, productName: 'Algo', quantity: '99' }),
      products,
    )
    expect(errors).toEqual({})
  })
})

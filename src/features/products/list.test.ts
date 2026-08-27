import { describe, expect, it } from 'vitest'
import { filterProducts, stockLevel } from './list'
import type { ProductRow } from './products.api'

function product(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 'id',
    name: 'Taza térmica',
    description: null,
    base_price: 1000,
    stock_quantity: 10,
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

describe('stockLevel', () => {
  it('is "out" at zero or below', () => {
    expect(stockLevel(product({ stock_quantity: 0 }))).toBe('out')
  })

  it('is "low" below the threshold but above zero', () => {
    expect(stockLevel(product({ stock_quantity: 1 }))).toBe('low')
    expect(stockLevel(product({ stock_quantity: 4 }))).toBe('low')
  })

  it('is "ok" at or above the threshold', () => {
    expect(stockLevel(product({ stock_quantity: 5 }))).toBe('ok')
    expect(stockLevel(product({ stock_quantity: 50 }))).toBe('ok')
  })
})

describe('filterProducts', () => {
  it('returns everything when the filter is empty', () => {
    const products = [product({ id: 'a' }), product({ id: 'b' })]
    expect(
      filterProducts(products, {
        query: '',
        activeOnly: false,
        categoryId: '',
      }),
    ).toHaveLength(2)
  })

  it('matches the query against name case-insensitively', () => {
    const products = [
      product({ id: 'a', name: 'Llavero Zelda' }),
      product({ id: 'b', name: 'Taza térmica' }),
    ]
    const result = filterProducts(products, {
      query: 'zelda',
      activeOnly: false,
      categoryId: '',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('matches the query against description too', () => {
    const products = [
      product({ id: 'a', name: 'Producto', description: 'Edición especial' }),
      product({ id: 'b', name: 'Otro', description: null }),
    ]
    const result = filterProducts(products, {
      query: 'especial',
      activeOnly: false,
      categoryId: '',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('excludes inactive products when activeOnly is set', () => {
    const products = [
      product({ id: 'a', active: true }),
      product({ id: 'b', active: false }),
    ]
    const result = filterProducts(products, {
      query: '',
      activeOnly: true,
      categoryId: '',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('filtra por categoría cuando categoryId está seteado', () => {
    const products = [
      product({ id: 'a', category_id: 'cat-1' }),
      product({ id: 'b', category_id: 'cat-2' }),
      product({ id: 'c', category_id: null }),
    ]
    const result = filterProducts(products, {
      query: '',
      activeOnly: false,
      categoryId: 'cat-1',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('devuelve todo cuando categoryId es ""', () => {
    const products = [
      product({ id: 'a', category_id: 'cat-1' }),
      product({ id: 'b', category_id: null }),
    ]
    expect(
      filterProducts(products, {
        query: '',
        activeOnly: false,
        categoryId: '',
      }),
    ).toHaveLength(2)
  })
})

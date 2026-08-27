import { describe, expect, it } from 'vitest'
import { filterProducts, type ProductFilters } from './filter'
import type { Product } from './data/products'

const baseFilters: ProductFilters = {
  search: '',
  category: 'all',
  priceBucket: 'all',
  brand: 'all',
  personalizableOnly: false,
  sort: 'relevance',
}

const products: Product[] = [
  { id: 'a', cat: 'llaveros', name: 'Llavero barato', price: 1000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: '', specs: [] },
  { id: 'b', cat: 'trofeos', name: 'Trofeo personalizado', price: 15000, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: '', specs: [] },
  { id: 'c', cat: 'filamentos', brand: '3n3', name: '3N3 — PLA', price: 25000, personalizable: false, customOnRequest: false, colors: null, stock: 'in', desc: '', specs: [] },
  { id: 'd', cat: 'filamentos', brand: 'grilon3', name: 'Grilon3 — PLA', price: 25000, personalizable: false, customOnRequest: false, colors: null, stock: 'in', desc: '', specs: [] },
]

describe('filterProducts', () => {
  it('filters by category', () => {
    const result = filterProducts(products, { ...baseFilters, category: 'trofeos' })
    expect(result.map((p) => p.id)).toEqual(['b'])
  })

  it('search overrides category (matches design behavior)', () => {
    const result = filterProducts(products, { ...baseFilters, category: 'trofeos', search: 'llavero' })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('is case-insensitive on search', () => {
    const result = filterProducts(products, { ...baseFilters, search: 'TROFEO' })
    expect(result.map((p) => p.id)).toEqual(['b'])
  })

  it('filters by price bucket', () => {
    expect(filterProducts(products, { ...baseFilters, priceBucket: 'low' }).map((p) => p.id)).toEqual(['a'])
    expect(filterProducts(products, { ...baseFilters, priceBucket: 'mid' }).map((p) => p.id)).toEqual(['b'])
    expect(filterProducts(products, { ...baseFilters, priceBucket: 'high' }).map((p) => p.id)).toEqual(['c', 'd'])
  })

  it('filters personalizable-only', () => {
    const result = filterProducts(products, { ...baseFilters, personalizableOnly: true })
    expect(result.map((p) => p.id)).toEqual(['b'])
  })

  it('filters by brand only within the filamentos category', () => {
    const result = filterProducts(products, { ...baseFilters, category: 'filamentos', brand: '3n3' })
    expect(result.map((p) => p.id)).toEqual(['c'])
  })

  it('ignores brand filter outside the filamentos category', () => {
    const result = filterProducts(products, { ...baseFilters, category: 'trofeos', brand: '3n3' })
    expect(result.map((p) => p.id)).toEqual(['b'])
  })

  it('sorts by price ascending/descending', () => {
    expect(filterProducts(products, { ...baseFilters, sort: 'price-asc' }).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(filterProducts(products, { ...baseFilters, sort: 'price-desc' })[0].id).toBe('c')
  })
})

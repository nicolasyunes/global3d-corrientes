import { describe, expect, it } from 'vitest'
import { filterProducts, type ProductFilters } from './filter'
import type { Product } from './data/products'

const baseFilters: ProductFilters = {
  search: '',
  category: 'all',
  subcat: 'all',
  capacity: 'all',
  themes: [],
  priceBucket: 'all',
  brand: 'all',
  personalizableOnly: false,
  sort: 'relevance',
}

const p = (over: Partial<Product>): Product => ({
  id: 'x', cat: 'llaveros', name: '', price: 1000, personalizable: false,
  customOnRequest: true, colors: null, stock: 'in', desc: '', specs: [], ...over,
})

const products: Product[] = [
  p({ id: 'a', cat: 'llaveros', name: 'Llavero barato', price: 1000 }),
  p({ id: 'b', cat: 'trofeos', subcat: 'placas', name: 'Trofeo personalizado', price: 15000, personalizable: true }),
  p({ id: 'c', cat: 'filamentos', brand: '3n3', unit: 'kg', name: '3N3 — PLA', price: 25000, customOnRequest: false }),
  p({ id: 'd', cat: 'filamentos', brand: 'grilon3', unit: 'L', name: 'Grilon3 — Resina', price: 25000, customOnRequest: false }),
  p({ id: 'e', cat: 'vasos-ferneteros', subcat: 'futbol-clubes', themes: ['futbol', 'river'], capacity: '1L', name: 'Vaso River 1L', price: 27000 }),
  p({ id: 'f', cat: 'vasos-ferneteros', subcat: 'mundial', themes: ['mundial', 'afa'], capacity: '1L', name: 'Vaso Copa del Mundo', price: 28500 }),
  p({ id: 'g', cat: 'vasos-ferneteros', subcat: 'otros-disenos', themes: ['corrientes'], capacity: '500ml', name: 'Vaso Ará Berá', price: 18000 }),
]

describe('filterProducts', () => {
  it('filters by category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos' }).map((x) => x.id)).toEqual(['b'])
  })

  it('search overrides category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos', search: 'llavero' }).map((x) => x.id)).toEqual(['a'])
  })

  it('is case-insensitive on search', () => {
    expect(filterProducts(products, { ...baseFilters, search: 'TROFEO' }).map((x) => x.id)).toEqual(['b'])
  })

  it('filters by price bucket', () => {
    expect(filterProducts(products, { ...baseFilters, priceBucket: 'low' }).map((x) => x.id)).toEqual(['a'])
  })

  it('filters personalizable-only', () => {
    expect(filterProducts(products, { ...baseFilters, personalizableOnly: true }).map((x) => x.id)).toEqual(['b'])
  })

  it('maps the filamentos alias to the impresion-3d category', () => {
    const r = filterProducts(products, { ...baseFilters, category: 'filamentos' }).map((x) => x.id)
    expect(r.sort()).toEqual(['c', 'd'])
  })

  it('filters by brand only within impresion-3d', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', brand: '3n3' }).map((x) => x.id)).toEqual(['c'])
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos', brand: '3n3' }).map((x) => x.id)).toEqual(['b'])
  })

  it('filters by memberCats sub-link + unit (resina)', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', subcat: 'resina' }).map((x) => x.id)).toEqual(['d'])
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', subcat: 'filamentos' }).map((x) => x.id)).toEqual(['c'])
  })

  it('filters by subcat within a normal category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'vasos-ferneteros', subcat: 'mundial' }).map((x) => x.id)).toEqual(['f'])
  })

  it('filters by capacity', () => {
    expect(
      filterProducts(products, { ...baseFilters, category: 'vasos-ferneteros', capacity: '500ml' }).map((x) => x.id),
    ).toEqual(['g'])
  })

  it('filters by themes with OR semantics, even when category is all', () => {
    expect(filterProducts(products, { ...baseFilters, themes: ['mundial'] }).map((x) => x.id)).toEqual(['f'])
    expect(
      filterProducts(products, { ...baseFilters, themes: ['river', 'corrientes'] }).map((x) => x.id).sort(),
    ).toEqual(['e', 'g'])
  })

  it('sorts by price ascending / descending', () => {
    expect(filterProducts(products, { ...baseFilters, sort: 'price-asc' })[0].id).toBe('a')
    expect(filterProducts(products, { ...baseFilters, sort: 'price-desc' })[0].id).toBe('f')
  })
})

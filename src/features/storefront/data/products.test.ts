import { describe, expect, it } from 'vitest'
import { BRAND_LIST, CATEGORIES, FEATURED_PRODUCT_IDS, PRODUCTS, colorBg, colorName, findCategory, findProduct } from './products'

describe('PRODUCTS', () => {
  it('has no duplicate ids', () => {
    const ids = PRODUCTS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every product belongs to a known category', () => {
    const slugs = new Set(CATEGORIES.map((c) => c.slug))
    for (const p of PRODUCTS) expect(slugs.has(p.cat)).toBe(true)
  })

  it('every featured product id resolves to a real product', () => {
    for (const id of FEATURED_PRODUCT_IDS) expect(findProduct(id)).toBeDefined()
  })

  it('every filamentos product references a known brand', () => {
    const brandSlugs = new Set(BRAND_LIST.map((b) => b.slug))
    for (const p of PRODUCTS.filter((p) => p.cat === 'filamentos')) {
      expect(p.brand).toBeDefined()
      expect(brandSlugs.has(p.brand!)).toBe(true)
    }
  })
})

describe('findCategory / findProduct', () => {
  it('finds an existing category by slug', () => {
    expect(findCategory('trofeos')?.name).toBe('Trofeos personalizados')
  })

  it('returns undefined for an unknown id/slug', () => {
    expect(findCategory('nope')).toBeUndefined()
    expect(findProduct('nope')).toBeUndefined()
  })
})

describe('colorBg / colorName', () => {
  it('reads hex/name off a color object', () => {
    expect(colorBg({ name: 'Rojo', hex: '#c0392b' })).toBe('#c0392b')
    expect(colorName({ name: 'Rojo', hex: '#c0392b' })).toBe('Rojo')
  })

  it('looks up a bg color for a plain color-name string', () => {
    expect(colorBg('Negro')).toBe('#1a1a1a')
    expect(colorName('Negro')).toBe('Negro')
  })

  it('falls back to a default gray for an unknown color name', () => {
    expect(colorBg('Fucsia')).toBe('#cccccc')
  })
})

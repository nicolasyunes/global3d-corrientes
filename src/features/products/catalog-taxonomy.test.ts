import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '@/features/storefront/data/products'
import {
  CATEGORY_SEED,
  CATEGORY_SLUGS,
  deriveSubcategory,
  mapLegacyCategory,
  SUBCATEGORY_OPTIONS,
  slugify,
} from './catalog-taxonomy'

describe('slugify', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(slugify('Vaso Fernetero Mandiyú 1 lt')).toBe(
      'vaso-fernetero-mandiyu-1-lt',
    )
  })
  it('colapsa separadores y recorta guiones', () => {
    expect(slugify('  Trofeo / placa  ')).toBe('trofeo-placa')
  })
})

describe('mapLegacyCategory', () => {
  it('mapea vasos milkshake por nombre', () => {
    expect(mapLegacyCategory('vasos', 'Vaso milkshake Sonic')).toBe(
      'vasos-milkshake',
    )
  })
  it('mapea vasos no-milkshake a ferneteros', () => {
    expect(mapLegacyCategory('vasos', 'Vaso Fernetero Boca 1 lt')).toBe(
      'vasos-ferneteros',
    )
  })
  it('colapsa filamentos e impresoras en impresion-3d', () => {
    expect(mapLegacyCategory('filamentos', 'x')).toBe('impresion-3d')
    expect(mapLegacyCategory('impresoras', 'x')).toBe('impresion-3d')
  })
  it('tira error ante una categoría legacy desconocida', () => {
    expect(() => mapLegacyCategory('zarasa', 'x')).toThrow()
  })
})

describe('CATEGORY_SEED', () => {
  it('tiene 11 entradas con slugs únicos y positions 0..10', () => {
    expect(CATEGORY_SEED).toHaveLength(11)
    expect(new Set(CATEGORY_SLUGS).size).toBe(11)
    expect(CATEGORY_SEED.map((c) => c.position)).toEqual([...Array(11).keys()])
  })
})

describe('taxonomía sobre el catálogo real', () => {
  it('cada producto mapea a una categoría válida', () => {
    for (const p of PRODUCTS) {
      expect(CATEGORY_SLUGS).toContain(mapLegacyCategory(p.cat, p.name))
    }
  })
  it('deriveSubcategory devuelve null u opción válida de esa categoría', () => {
    for (const p of PRODUCTS) {
      const catSlug = mapLegacyCategory(p.cat, p.name)
      const sub = deriveSubcategory(p.cat, p)
      if (sub === null) continue
      const allowed = (SUBCATEGORY_OPTIONS[catSlug] ?? []).map((o) => o.slug)
      expect(allowed).toContain(sub)
    }
  })
})

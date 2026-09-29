import { describe, expect, it } from 'vitest'
import {
  CATEGORY_SEED,
  CATEGORY_SLUGS,
  mapLegacyCategory,
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

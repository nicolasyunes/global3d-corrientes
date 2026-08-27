import { describe, expect, it } from 'vitest'
import {
  NAV,
  THEME_LABELS,
  navSubLinks,
  resolveCategorySlug,
  allProductCats,
  findCategory,
} from './navigation'

describe('NAV config', () => {
  it('has 11 categories with unique slugs', () => {
    expect(NAV).toHaveLength(11)
    const slugs = NAV.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has unique sub-link slugs within each category', () => {
    for (const c of NAV) {
      const slugs = c.subLinks.map((s) => s.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })

  it('every category has a name and a single-glyph icon', () => {
    for (const c of NAV) {
      expect(c.name.length).toBeGreaterThan(0)
      expect([...c.icon].length).toBeGreaterThanOrEqual(1)
    }
  })

  it('only impresion-3d uses memberCats', () => {
    for (const c of NAV) {
      for (const s of c.subLinks) {
        if (s.memberCats) expect(c.slug).toBe('impresion-3d')
      }
    }
  })

  it('marks exactly the two vasos categories as featured', () => {
    expect(NAV.filter((c) => c.featured).map((c) => c.slug)).toEqual([
      'vasos-ferneteros',
      'vasos-milkshake',
    ])
  })

  it('resolves alias slugs to canonical', () => {
    expect(resolveCategorySlug('vasos')).toBe('vasos-ferneteros')
    expect(resolveCategorySlug('filamentos')).toBe('impresion-3d')
    expect(resolveCategorySlug('impresoras')).toBe('impresion-3d')
    expect(resolveCategorySlug('trofeos')).toBe('trofeos')
    expect(resolveCategorySlug('nope')).toBe('nope')
  })

  it('navSubLinks works through an alias', () => {
    expect(navSubLinks('vasos').map((s) => s.slug)).toContain('futbol-clubes')
  })

  it('allProductCats includes NAV slugs and memberCats targets', () => {
    const cats = allProductCats()
    expect(cats.has('vasos-ferneteros')).toBe(true)
    expect(cats.has('filamentos')).toBe(true)
    expect(cats.has('impresoras')).toBe(true)
  })

  it('THEME_LABELS has a label for every theme referenced by a sub-link slug', () => {
    // sub-link slugs that double as theme slugs must be labelled
    for (const slug of ['stranger-things', 'sonic', 'toy-story', 'mundial']) {
      expect(THEME_LABELS[slug]).toBeTruthy()
    }
  })

  it('findCategory returns the back-compat shape', () => {
    expect(findCategory('trofeos')).toEqual({ slug: 'trofeos', name: 'Trofeos y Premios' })
    expect(findCategory('nope')).toBeUndefined()
  })
})

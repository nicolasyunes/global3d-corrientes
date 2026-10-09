import { describe, expect, it, vi } from 'vitest'
import {
  accessTags,
  buildSearchUrl,
  domainOf,
  initialOf,
  isSearchTemplate,
  lastUsedLabel,
  openSearch,
  pinnedResources,
  searchSites,
  sections,
  type Resource,
} from './resources'

function res(over: Partial<Resource>): Resource {
  return {
    id: 'r',
    name: 'Sitio',
    url: 'https://www.sitio.com/x',
    category: 'modelos',
    description: null,
    price: 'gratis',
    needs_account: false,
    account_hint: null,
    search_url: null,
    pinned: false,
    position: 0,
    created_by: null,
    created_at: '2026-10-01T10:00:00Z',
    ...over,
  }
}

describe('búsqueda', () => {
  it('builds the search url with the words encoded', () => {
    expect(
      buildSearchUrl('https://a.com/s?q={q}', '  portalápices gato '),
    ).toBe('https://a.com/s?q=portal%C3%A1pices%20gato')
    expect(buildSearchUrl('https://y.com/q/{q}/', 'mate')).toBe(
      'https://y.com/q/mate/',
    )
  })

  it('accepts only templates with {q}', () => {
    expect(isSearchTemplate('https://a.com/s?q={q}')).toBe(true)
    expect(isSearchTemplate('https://a.com/s?q=')).toBe(false)
    expect(isSearchTemplate('a.com/{q}')).toBe(false)
  })

  it('lists the search sites in order', () => {
    const rs = [
      res({ id: 'b', name: 'B', search_url: 'https://b/{q}', position: 2 }),
      res({ id: 'n', name: 'No busca' }),
      res({ id: 'a', name: 'A', search_url: 'https://a/{q}', position: 1 }),
    ]
    expect(searchSites(rs).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('opens one tab per site and reports the blocked ones', () => {
    const win = { opener: {} } as unknown as Window
    const open = vi.fn().mockReturnValueOnce(win).mockReturnValueOnce(null)
    expect(openSearch(['https://a', 'https://b'], open)).toEqual(['https://b'])
    expect(open).toHaveBeenCalledWith('https://a', '_blank')
    expect(win.opener).toBeNull()
  })
})

describe('pantalla', () => {
  it('groups into the four sections and filters by text', () => {
    const rs = [
      res({ id: 'm', name: 'MakerWorld', url: 'https://makerworld.com' }),
      res({ id: 'i', name: 'Hunyuan', category: 'ia' }),
      res({
        id: 'f',
        name: 'Reparar',
        category: 'reparar',
        description: 'Arregla STL',
      }),
    ]
    const all = sections(rs, '')
    expect(all.map((s) => s.section.key)).toEqual([
      'modelos',
      'crear',
      'proveedores',
      'guias',
    ])
    expect(all[1].items.map((r) => r.id)).toEqual(['i', 'f'])
    const found = sections(rs, 'stl')
    expect(
      found.find((s) => s.section.key === 'crear')!.items.map((r) => r.id),
    ).toEqual(['f'])
    expect(found.find((s) => s.section.key === 'modelos')).toBeUndefined()
    expect(sections(rs, 'makerworld.com')[0].items.map((r) => r.id)).toEqual([
      'm',
    ])
  })

  it('keeps pinned ones apart, in order', () => {
    const rs = [
      res({ id: 'b', name: 'B', pinned: true, position: 2 }),
      res({ id: 'x', name: 'X' }),
      res({ id: 'a', name: 'A', pinned: true, position: 1 }),
    ]
    expect(pinnedResources(rs).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('describes access and domain', () => {
    expect(accessTags(res({ price: 'mixto', needs_account: true }))).toEqual([
      'Gratis y pago',
      'Con cuenta',
    ])
    expect(accessTags(res({}))).toEqual(['Gratis', 'Sin cuenta'])
    expect(domainOf('https://www.printables.com/model/1')).toBe(
      'printables.com',
    )
    expect(domainOf('no es un link')).toBe('no es un link')
    expect(initialOf('  cults3D')).toBe('C')
  })

  it('says when a search was last used', () => {
    const now = new Date('2026-10-10T15:00:00')
    expect(lastUsedLabel(null, now)).toBe('nunca')
    expect(lastUsedLabel('2026-10-10T08:00:00', now)).toBe('hoy')
    expect(lastUsedLabel('2026-10-09T20:00:00', now)).toBe('ayer')
    expect(lastUsedLabel('2026-10-07T10:00:00', now)).toBe('hace 3 días')
    expect(lastUsedLabel('2026-10-02T10:00:00', now)).toBe('hace 1 sem')
    expect(lastUsedLabel('2026-09-20T10:00:00', now)).toBe('hace 2 sem')
    expect(lastUsedLabel('2026-08-01T10:00:00', now)).toMatch(/^1 ago$/)
  })
})

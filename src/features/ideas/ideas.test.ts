import { describe, expect, it } from 'vitest'
import {
  collectionCountdown,
  coverOf,
  detectSource,
  fileKind,
  filterIdeas,
  groupByCollection,
  validateIdeaFile,
  type Collection,
  type Idea,
} from './ideas'

function idea(over: Partial<Idea> = {}): Idea {
  return {
    id: 'i1',
    title: 'Maceta low-poly',
    url: null,
    source: 'other',
    preview_image_url: null,
    preview_author: null,
    collection_id: null,
    status: 'idea',
    priority: 'normal',
    notes: null,
    created_by: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    files: [],
    ...over,
  }
}

const mom: Collection = {
  id: 'c1',
  name: 'Día de la Madre',
  target_date: '2026-10-18',
  position: 0,
  created_at: '',
}
const xmas: Collection = {
  id: 'c2',
  name: 'Navidad',
  target_date: '2026-12-25',
  position: 1,
  created_at: '',
}

describe('detectSource', () => {
  it.each([
    ['https://makerworld.com/es/models/123', 'makerworld'],
    ['https://cults3d.com/es/modelo-3d/x', 'cults'],
    ['https://www.printables.com/model/1', 'printables'],
    ['https://www.thingiverse.com/thing:1', 'thingiverse'],
    ['https://www.instagram.com/reel/abc/', 'instagram'],
    ['https://vm.tiktok.com/xyz', 'tiktok'],
    ['https://ar.pinterest.com/pin/1', 'pinterest'],
    ['https://pin.it/abc', 'pinterest'],
    ['https://ejemplo.com.ar/cosa', 'other'],
  ])('%s → %s', (url, source) => {
    expect(detectSource(url)).toBe(source)
  })

  it('treats no link or garbage as other', () => {
    expect(detectSource(null)).toBe('other')
    expect(detectSource('no es un link')).toBe('other')
  })
})

describe('files', () => {
  it('classifies by type and extension', () => {
    expect(fileKind('foto.png', 'image/png')).toBe('image')
    expect(fileKind('reel.mp4', 'video/mp4')).toBe('video')
    expect(fileKind('Llavero.3MF', '')).toBe('model')
    expect(fileKind('pieza.stl', 'application/octet-stream')).toBe('model')
    expect(fileKind('planilla.xlsx', 'application/vnd.ms-excel')).toBeNull()
  })

  it('rejects unknown types and files over 50 MB', () => {
    const ok = new File(['x'], 'a.stl')
    expect(validateIdeaFile(ok)).toBeNull()
    expect(validateIdeaFile(new File(['x'], 'a.zip'))).toMatch(/STL/)
    const big = new File(['x'], 'b.3mf')
    Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 })
    expect(validateIdeaFile(big)).toMatch(/50 MB/)
  })
})

describe('collectionCountdown', () => {
  it('counts the days left', () => {
    expect(collectionCountdown('2026-10-18', '2026-09-30')).toBe(
      'faltan 18 días',
    )
    expect(collectionCountdown('2026-10-01', '2026-09-30')).toBe('falta 1 día')
    expect(collectionCountdown('2026-09-30', '2026-09-30')).toBe('es hoy')
    expect(collectionCountdown('2026-09-01', '2026-09-30')).toBe('ya pasó')
    expect(collectionCountdown(null, '2026-09-30')).toBeNull()
  })
})

describe('filterIdeas', () => {
  const list = [
    idea({ id: 'a', collection_id: 'c1', priority: 'high' }),
    idea({ id: 'b', collection_id: 'c2', title: 'Árbol de Navidad' }),
    idea({ id: 'c', notes: 'para el stand de la feria' }),
  ]
  const ids = (xs: Idea[]) => xs.map((x) => x.id)

  it('filters by collection, including "none"', () => {
    expect(ids(filterIdeas(list, { collection: 'c1' }))).toEqual(['a'])
    expect(ids(filterIdeas(list, { collection: 'none' }))).toEqual(['c'])
    expect(ids(filterIdeas(list, { collection: 'all' }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('keeps only high priority and searches title and notes, ignoring accents', () => {
    expect(ids(filterIdeas(list, { onlyHigh: true }))).toEqual(['a'])
    expect(ids(filterIdeas(list, { query: 'arbol' }))).toEqual(['b'])
    expect(ids(filterIdeas(list, { query: 'FERIA' }))).toEqual(['c'])
  })
})

describe('groupByCollection', () => {
  it('follows the collection order and leaves "Sin colección" last', () => {
    const groups = groupByCollection(
      [
        idea({ id: 'a' }),
        idea({ id: 'b', collection_id: 'c2' }),
        idea({ id: 'c', collection_id: 'c1' }),
      ],
      [xmas, mom],
    )
    expect(groups.map((g) => g.collection?.name ?? 'Sin colección')).toEqual([
      'Día de la Madre',
      'Navidad',
      'Sin colección',
    ])
    expect(groups[2].ideas.map((i) => i.id)).toEqual(['a'])
  })

  it('keeps empty collections so "Agregar acá" is reachable', () => {
    const groups = groupByCollection([], [mom])
    expect(groups).toHaveLength(1)
    expect(groups[0].ideas).toEqual([])
  })
})

describe('coverOf', () => {
  it('prefers the link image, then the first own photo or video', () => {
    expect(coverOf(idea({ preview_image_url: 'https://x/og.jpg' }))).toEqual({
      url: 'https://x/og.jpg',
      video: false,
    })
    const withFiles = idea({
      files: [
        {
          id: 'f1',
          idea_id: 'i1',
          storage_path: 'i1/a.stl',
          kind: 'model',
          file_name: 'a.stl',
          size_bytes: 1,
          position: 0,
          created_at: '',
        },
        {
          id: 'f2',
          idea_id: 'i1',
          storage_path: 'i1/b.mp4',
          kind: 'video',
          file_name: 'b.mp4',
          size_bytes: 1,
          position: 1,
          created_at: '',
        },
      ],
    })
    expect(coverOf(withFiles, (p) => `pub/${p}`)).toEqual({
      url: 'pub/i1/b.mp4',
      video: true,
    })
    expect(coverOf(idea())).toEqual({ url: null, video: false })
  })
})

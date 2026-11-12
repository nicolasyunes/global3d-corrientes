import { describe, expect, it } from 'vitest'
import { familyImage, heroPhotos, shuffle } from './catalog'
import type { Family } from './types'

const fam = (slug: string, variants: Array<[string | null, number]>) =>
  ({
    slug,
    variants: variants.map(([img, stock]) => ({
      stock,
      images: img ? [img] : [],
    })),
  }) as unknown as Family

describe('heroPhotos', () => {
  it('alterna entre familias y pone primero las variantes con stock', () => {
    const photos = heroPhotos(
      [
        fam('vaso', [
          ['vaso-sin-stock', 0],
          ['vaso-river', 2],
          ['vaso-boca', 1],
        ]),
        fam('mate', [['mate-1', 3]]),
        fam('sin-foto', [[null, 5]]),
      ],
      8,
    )
    expect(photos).toEqual([
      'vaso-river',
      'mate-1',
      'vaso-boca',
      'vaso-sin-stock',
    ])
  })

  it('usa las fotos propias de la familia si sus productos no tienen', () => {
    const f = { ...fam('premios', []), images: ['p1', 'p2'] } as Family
    expect(heroPhotos([f, fam('b', [['z', 1]])], 8)).toEqual(['p1', 'z', 'p2'])
    expect(familyImage(f)).toBe('p1')
  })

  it('respeta el máximo y no repite', () => {
    const photos = heroPhotos(
      [
        fam('a', [
          ['x', 1],
          ['x', 1],
          ['y', 1],
        ]),
        fam('b', [['z', 1]]),
      ],
      2,
    )
    expect(photos).toEqual(['x', 'z'])
  })
})

describe('shuffle', () => {
  it('devuelve las mismas fotos en otro orden y no toca el original', () => {
    const src = ['a', 'b', 'c', 'd']
    const seq = [0.1, 0.9, 0.5]
    let i = 0
    const out = shuffle(src, () => seq[i++ % seq.length])
    expect(out).not.toEqual(src)
    expect([...out].sort()).toEqual(src)
    expect(src).toEqual(['a', 'b', 'c', 'd'])
  })

  it('con una lista vacía o de un elemento no rompe', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['x'])).toEqual(['x'])
  })
})

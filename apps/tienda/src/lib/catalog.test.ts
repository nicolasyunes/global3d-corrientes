import { describe, expect, it } from 'vitest'
import { heroPhotos } from './catalog'
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

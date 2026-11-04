import { describe, expect, it } from 'vitest'
import { cleanPostLinks } from './instagram'

describe('cleanPostLinks', () => {
  it('saca parámetros, repetidos y links que no son publicaciones', () => {
    expect(
      cleanPostLinks([
        'https://www.instagram.com/p/DNyxc4G3mCB/?img_index=1',
        'https://instagram.com/p/DNyxc4G3mCB/',
        'https://www.instagram.com/reel/AbC_1-2/',
        'https://www.instagram.com/global3d_corrientes/',
        'https://example.com/p/xxx/',
      ]),
    ).toEqual([
      'https://www.instagram.com/p/DNyxc4G3mCB/',
      'https://www.instagram.com/reel/AbC_1-2/',
    ])
  })

  it('corta en el máximo y tolera undefined', () => {
    const many = Array.from(
      { length: 9 },
      (_, i) => `https://www.instagram.com/p/x${i}/`,
    )
    expect(cleanPostLinks(many)).toHaveLength(6)
    expect(cleanPostLinks(undefined)).toEqual([])
  })
})

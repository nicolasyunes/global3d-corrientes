import { describe, expect, it } from 'vitest'
import { optimizedSrc, optimizedSrcSet, VERCEL_WIDTHS } from './img'

const PHOTO =
  'https://bukjmleercxlxbexekos.supabase.co/storage/v1/object/public/product-images/abc/0-1.jpeg'

describe('optimizedSrc', () => {
  it('pasa las fotos de Supabase por el optimizador de Vercel', () => {
    expect(optimizedSrc(PHOTO, 'card', true)).toBe(
      `/_vercel/image?url=${encodeURIComponent(PHOTO)}&w=640&q=75`,
    )
    expect(optimizedSrc(PHOTO, 'thumb', true)).toContain('&w=256&')
    expect(optimizedSrc(PHOTO, 'full', true)).toContain('&w=1080&')
  })

  it('también optimiza las fotos propias de la tienda (public/familias)', () => {
    expect(
      optimizedSrc('/tienda/familias/premiaciones-1.jpg', 'card', true),
    ).toBe(
      `/_vercel/image?url=${encodeURIComponent('/tienda/familias/premiaciones-1.jpg')}&w=640&q=75`,
    )
    expect(optimizedSrc('/tienda/familias/../secreto.jpg', 'card', true)).toBe(
      '/tienda/familias/../secreto.jpg',
    )
    expect(optimizedSrc('/tienda/familias/a.jpg', 'card', false)).toBe(
      '/tienda/familias/a.jpg',
    )
  })

  it('deja la original cuando está apagado (dev)', () => {
    expect(optimizedSrc(PHOTO, 'card', false)).toBe(PHOTO)
  })

  it('no toca URLs de otros hosts ni rutas relativas', () => {
    expect(optimizedSrc('https://example.com/a.jpg', 'card', true)).toBe(
      'https://example.com/a.jpg',
    )
    expect(optimizedSrc('/tienda/logo.png', 'card', true)).toBe(
      '/tienda/logo.png',
    )
    expect(
      optimizedSrc('https://x.supabase.co/rest/v1/algo', 'card', true),
    ).toBe('https://x.supabase.co/rest/v1/algo')
  })
})

describe('optimizedSrcSet', () => {
  it('ofrece los anchos hasta el máximo del tamaño', () => {
    const set = optimizedSrcSet(PHOTO, 'card', true)!
    expect(set.split(', ').map((x) => x.split(' ')[1])).toEqual([
      '256w',
      '384w',
      '640w',
    ])
    expect(set).toContain(`url=${encodeURIComponent(PHOTO)}&w=384&q=75 384w`)
    expect(optimizedSrcSet(PHOTO, 'full', true)!.split(', ')).toHaveLength(
      VERCEL_WIDTHS.length,
    )
  })

  it('no arma srcset en dev ni para fotos que no se optimizan', () => {
    expect(optimizedSrcSet(PHOTO, 'card', false)).toBeNull()
    expect(
      optimizedSrcSet('https://example.com/a.jpg', 'card', true),
    ).toBeNull()
    expect(
      optimizedSrcSet('/tienda/familias/../x.jpg', 'card', true),
    ).toBeNull()
  })
})

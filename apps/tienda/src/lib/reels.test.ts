import { describe, expect, it } from 'vitest'
import { cleanReels } from './reels'

describe('cleanReels', () => {
  it('resuelve archivos propios contra la base y deja pasar https', () => {
    expect(
      cleanReels(
        [
          {
            video: 'reels/vaso.mp4',
            poster: 'reels/vaso.jpg',
            titulo: ' Vaso ',
          },
          { video: 'https://cdn.ejemplo.com/a.mp4' },
        ],
        '/tienda/',
      ),
    ).toEqual([
      {
        video: '/tienda/reels/vaso.mp4',
        poster: '/tienda/reels/vaso.jpg',
        title: 'Vaso',
        link: null,
      },
      {
        video: 'https://cdn.ejemplo.com/a.mp4',
        poster: null,
        title: '',
        link: null,
      },
    ])
  })

  it('descarta esquemas raros, rutas que salen de la carpeta y entradas inválidas', () => {
    expect(
      cleanReels([
        { video: 'javascript:alert(1)' },
        { video: 'http://inseguro.com/a.mp4' },
        { video: '../secreto.mp4' },
        { video: '//otro.com/a.mp4' },
        { video: 42 },
        null,
        'reels/x.mp4',
        {},
      ]),
    ).toEqual([])
  })

  it('limpia el link de Instagram, saca repetidos y respeta el máximo', () => {
    const r = cleanReels(
      [
        {
          video: 'a.mp4',
          link: 'https://www.instagram.com/reel/ABC123/?igsh=x',
        },
        { video: 'a.mp4' },
        { video: 'b.mp4', link: 'https://example.com/reel/ABC123/' },
        { video: 'c.mp4' },
      ],
      '/',
      2,
    )
    expect(r.map((x) => x.video)).toEqual(['/a.mp4', '/b.mp4'])
    expect(r[0].link).toBe('https://www.instagram.com/reel/ABC123/')
    expect(r[1].link).toBeNull()
  })

  it('si no es una lista devuelve vacío', () => {
    expect(cleanReels(undefined)).toEqual([])
    expect(cleanReels({ video: 'a.mp4' })).toEqual([])
  })
})

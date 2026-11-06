import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { InstagramFeed } from './InstagramFeed'

vi.mock('../lib/api', () => ({ api: { instagram: vi.fn() } }))

const post = (i: number, isVideo = false) => ({
  id: String(i),
  url: `https://www.instagram.com/p/${i}/`,
  image: `https://scontent.example/${i}.jpg`,
  isVideo,
  caption: `Publicación ${i}`,
  date: '2026-11-01T12:00:00+0000',
})

describe('InstagramFeed', () => {
  beforeEach(() => vi.mocked(api.instagram).mockReset())

  it('muestra hasta 6 publicaciones con link a cada una', async () => {
    vi.mocked(api.instagram).mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => post(i, i === 0)),
    )
    render(<InstagramFeed handle="global3d_corrientes" />)
    const links = await screen.findAllByRole('link', { name: /Publicación/ })
    expect(links).toHaveLength(6)
    expect(links[1]).toHaveAttribute('href', 'https://www.instagram.com/p/1/')
    expect(
      screen.getByRole('link', { name: '@global3d_corrientes' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/global3d_corrientes/')
  })

  it('sin API usa los links elegidos con el embed oficial', async () => {
    vi.mocked(api.instagram).mockResolvedValue([])
    const { container } = render(
      <InstagramFeed
        handle="global3d_corrientes"
        links={['https://www.instagram.com/p/DexTXJyofqu/?img_index=1']}
      />,
    )
    await vi.waitFor(() => expect(api.instagram).toHaveBeenCalled())
    const quote = container.querySelector('blockquote.instagram-media')
    expect(quote).toHaveAttribute(
      'data-instgrm-permalink',
      'https://www.instagram.com/p/DexTXJyofqu/',
    )
  })

  it('no muestra nada si no hay publicaciones', async () => {
    vi.mocked(api.instagram).mockResolvedValue([])
    const { container } = render(<InstagramFeed handle="x" />)
    await vi.waitFor(() => expect(api.instagram).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

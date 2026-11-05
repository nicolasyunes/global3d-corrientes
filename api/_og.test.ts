import { describe, expect, it } from 'vitest'
import {
  absoluteImage,
  priceLabel,
  productMeta,
  renderHtml,
  type OgFamily,
} from './_og'

const ORIGIN = 'https://global3d-corrientes.vercel.app'
const PHOTO =
  'https://bukjmleercxlxbexekos.supabase.co/storage/v1/object/public/product-images/a/0-1.jpeg'

const vaso: OgFamily = {
  slug: 'vaso-camiseta',
  name: 'Vaso camiseta',
  description: 'Vaso con textura de camiseta de fútbol.',
  saleMode: 'stock',
  priceFrom: null,
  variants: [
    { price: 22500, stock: 0, images: ['sin-stock.jpg'] },
    { price: 30000, stock: 2, images: [PHOTO] },
  ],
}

describe('vista previa de fichas', () => {
  it('arma título con precio, descripción y foto optimizada', () => {
    const m = productMeta('vaso-camiseta', [vaso], ORIGIN)
    expect(m.title).toBe('Vaso camiseta · Desde $ 22.500')
    expect(m.description).toBe('Vaso con textura de camiseta de fútbol.')
    expect(m.image).toBe(
      `${ORIGIN}/_vercel/image?url=${encodeURIComponent(PHOTO)}&w=1080&q=75`,
    )
    expect(m.url).toBe(`${ORIGIN}/tienda/p/vaso-camiseta`)
  })

  it('usa las fotos propias de la familia y rutas locales absolutas', () => {
    const f: OgFamily = {
      ...vaso,
      slug: 'premios',
      saleMode: 'a_pedido',
      priceFrom: 10000,
      images: ['/tienda/familias/p-1.jpg'],
      variants: [],
    }
    const m = productMeta('premios', [f], ORIGIN)
    expect(m.image).toBe(`${ORIGIN}/tienda/familias/p-1.jpg`)
    expect(m.title).toContain('Desde $ 10.000')
  })

  it('en el dominio propio el link no lleva /tienda', () => {
    const m = productMeta(
      'vaso-camiseta',
      [vaso],
      'https://global3d.com.ar',
      '',
    )
    expect(m.url).toBe('https://global3d.com.ar/p/vaso-camiseta')
  })

  it('producto inexistente: vista previa genérica sin foto', () => {
    const m = productMeta('no-existe', [vaso], ORIGIN)
    expect(m.title).toContain('Global3D')
    expect(m.image).toBeNull()
  })

  it('precio: a cotizar y precio único', () => {
    expect(priceLabel({ ...vaso, saleMode: 'cotizacion' })).toBe('A cotizar')
    expect(
      priceLabel({
        ...vaso,
        variants: [{ price: 5000, stock: 1, images: [] }],
      }),
    ).toBe('$ 5.000')
  })

  it('escapa el HTML', () => {
    const html = renderHtml({
      title: 'Vaso "River" <b>',
      description: 'a & b',
      image: null,
      url: `${ORIGIN}/tienda/p/x`,
    })
    expect(html).toContain('content="Vaso &quot;River&quot; &lt;b&gt;"')
    expect(html).toContain('content="a &amp; b"')
    expect(html).not.toContain('og:image')
  })

  it('no toca imágenes de otros hosts', () => {
    expect(absoluteImage('https://example.com/a.jpg', ORIGIN)).toBe(
      'https://example.com/a.jpg',
    )
  })
})

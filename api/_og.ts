// Vista previa de las fichas de la tienda para WhatsApp, Instagram, Facebook,
// Telegram, etc. Esos robots no ejecutan JavaScript, así que no ven el título
// ni la foto que arma React. vercel.json les manda /tienda/p/:slug a
// /api/tienda-og, que responde un HTML mínimo con las etiquetas Open Graph.
// Las personas nunca pasan por acá.

export interface OgVariant {
  price: number | null
  stock: number
  images: string[]
}

export interface OgFamily {
  slug: string
  name: string
  description: string | null
  saleMode: 'stock' | 'a_pedido' | 'cotizacion'
  priceFrom: number | null
  images?: string[]
  variants: OgVariant[]
}

export interface OgMeta {
  title: string
  description: string
  image: string | null
  url: string
}

const SITE = 'Global3D'
const DEFAULT_DESCRIPTION =
  'Vasos, trofeos, figuras y regalos impresos en 3D en Corrientes. Personalizados con tu nombre, tu club o el logo de tu negocio.'

export function ars(n: number): string {
  return '$ ' + Math.round(n).toLocaleString('es-AR')
}

export function priceLabel(f: OgFamily): string | null {
  if (f.saleMode === 'cotizacion') return 'A cotizar'
  if (f.priceFrom != null) return `Desde ${ars(f.priceFrom)}`
  const prices = f.variants
    .map((v) => v.price)
    .filter((p): p is number => p != null && p > 0)
  if (!prices.length) return null
  const min = Math.min(...prices)
  return prices.some((p) => p !== min) ? `Desde ${ars(min)}` : ars(min)
}

/** Misma elección que la tienda: primero una variante con stock y foto. */
export function familyPhoto(f: OgFamily): string | null {
  const withStock = f.variants.find((v) => v.stock > 0 && v.images.length)
  const any = f.variants.find((v) => v.images.length)
  return (withStock ?? any)?.images[0] ?? f.images?.[0] ?? null
}

/** URL absoluta y liviana: las fotos de Supabase pasan por el optimizador. */
export function absoluteImage(src: string, origin: string): string {
  if (src.startsWith('/')) return origin + src
  if (/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//.test(src))
    return `${origin}/_vercel/image?url=${encodeURIComponent(src)}&w=1080&q=75`
  return src
}

export function productMeta(
  slug: string,
  families: OgFamily[],
  origin: string,
): OgMeta {
  const url = `${origin}/tienda/p/${encodeURIComponent(slug)}`
  const f = families.find((x) => x.slug === slug)
  if (!f)
    return {
      title: `${SITE} · Impresión 3D en Corrientes`,
      description: DEFAULT_DESCRIPTION,
      image: null,
      url,
    }
  const price = priceLabel(f)
  const photo = familyPhoto(f)
  const text = (f.description ?? '').replace(/\s+/g, ' ').trim()
  return {
    title: price ? `${f.name} · ${price}` : f.name,
    description:
      (text.length > 180 ? text.slice(0, 179) + '…' : text) ||
      `${f.name}, impreso en 3D en Corrientes.`,
    image: photo ? absoluteImage(photo, origin) : null,
    url,
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderHtml(m: OgMeta): string {
  const tags = [
    ['og:type', 'product'],
    ['og:site_name', SITE],
    ['og:locale', 'es_AR'],
    ['og:title', m.title],
    ['og:description', m.description],
    ['og:url', m.url],
    ...(m.image ? [['og:image', m.image]] : []),
  ]
    .map(([p, c]) => `<meta property="${p}" content="${esc(c)}">`)
    .join('\n')
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(m.title)} · ${SITE}</title>
<meta name="description" content="${esc(m.description)}">
<link rel="canonical" href="${esc(m.url)}">
${tags}
<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">
</head>
<body><a href="${esc(m.url)}">${esc(m.title)}</a></body>
</html>`
}

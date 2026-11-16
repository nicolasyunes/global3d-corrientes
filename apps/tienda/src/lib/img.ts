// Las fotos del catálogo son originales del celular (hasta ~3 MB). Supabase no
// las achica en este plan, así que en producción pasan por la optimización de
// imágenes de Vercel (`images` en vercel.json). En dev ese endpoint no existe y
// se usa la original. Si el endpoint falla, <Img> cae a la original.

// Anchos que acepta el optimizador: tienen que coincidir con `images.sizes`
// de vercel.json. Cada tamaño es el ancho máximo que se pide para ese uso; con
// `srcset` el navegador elige el menor que alcance para la pantalla.
export const VERCEL_WIDTHS = [256, 384, 640, 828, 1080] as const
export const IMG_WIDTHS = { thumb: 256, card: 640, full: 1080 } as const
export type ImgSize = keyof typeof IMG_WIDTHS

/** Lo que ocupa cada foto en pantalla, para que el navegador elija el ancho. */
export const IMG_SIZES = {
  // Tarjetas: 2 columnas, 3 desde 700 px, 4 desde 1100 px (contenedor 1200)
  card: '(min-width: 1100px) 292px, (min-width: 700px) 33vw, 50vw',
  // Vidriera del inicio: el grande ocupa 2 columnas de 2 (o de 4 desde 900 px)
  bentoBig: '(min-width: 900px) min(50vw, 584px), 100vw',
  bentoSmall: '(min-width: 900px) min(25vw, 292px), 50vw',
  // Foto principal de la ficha
  pdp: '(min-width: 900px) min(53vw, 620px), 100vw',
} as const

const STORAGE_PATH = '/storage/v1/object/public/'
// Tiene que coincidir con `images.localPatterns` de vercel.json.
const LOCAL_PATH = '/tienda/familias/'

function optimizable(src: string): boolean {
  // Fotos propias de la tienda (public/familias): también pesan 150-250 KB.
  if (src.startsWith(LOCAL_PATH)) return !src.includes('..')
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  return (
    url.hostname.endsWith('.supabase.co') &&
    url.pathname.startsWith(STORAGE_PATH)
  )
}

function vercelUrl(src: string, w: number): string {
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=75`
}

export function optimizedSrc(
  src: string,
  size: ImgSize,
  enabled: boolean = import.meta.env.PROD,
): string {
  if (!enabled || !optimizable(src)) return src
  return vercelUrl(src, IMG_WIDTHS[size])
}

/** `srcset` con los anchos hasta el de `size`, o null si la foto no pasa por el optimizador. */
export function optimizedSrcSet(
  src: string,
  size: ImgSize,
  enabled: boolean = import.meta.env.PROD,
): string | null {
  if (!enabled || !optimizable(src)) return null
  return VERCEL_WIDTHS.filter((w) => w <= IMG_WIDTHS[size])
    .map((w) => `${vercelUrl(src, w)} ${w}w`)
    .join(', ')
}

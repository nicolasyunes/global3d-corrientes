// Las fotos del catálogo son originales del celular (hasta ~3 MB). Supabase no
// las achica en este plan, así que en producción pasan por la optimización de
// imágenes de Vercel (`images` en vercel.json). En dev ese endpoint no existe y
// se usa la original. Si el endpoint falla, <Img> cae a la original.

// Tienen que coincidir con `images.sizes` de vercel.json.
export const IMG_WIDTHS = { thumb: 256, card: 640, full: 1080 } as const
export type ImgSize = keyof typeof IMG_WIDTHS

const STORAGE_PATH = '/storage/v1/object/public/'
// Tiene que coincidir con `images.localPatterns` de vercel.json.
const LOCAL_PATH = '/tienda/familias/'

export function optimizedSrc(
  src: string,
  size: ImgSize,
  enabled: boolean = import.meta.env.PROD,
): string {
  if (!enabled) return src
  // Fotos propias de la tienda (public/familias): también pesan 150-250 KB.
  if (src.startsWith(LOCAL_PATH) && !src.includes('..'))
    return `/_vercel/image?url=${encodeURIComponent(src)}&w=${IMG_WIDTHS[size]}&q=75`
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return src
  }
  if (
    !url.hostname.endsWith('.supabase.co') ||
    !url.pathname.startsWith(STORAGE_PATH)
  )
    return src
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${IMG_WIDTHS[size]}&q=75`
}

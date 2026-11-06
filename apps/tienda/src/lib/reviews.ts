import type { ReviewSettings, ShopReview } from './types'

/**
 * Link para dejar una reseña. Con el Place ID abre directo el formulario de
 * Google; sin él, la ficha del local en Maps (ahí está el botón de reseña).
 */
export function writeReviewUrl(
  reviews: ReviewSettings | undefined,
  mapsQuery: string,
): string {
  const placeId = reviews?.placeId?.trim()
  if (placeId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
  }
  return mapsUrl(mapsQuery)
}

/** Link para leer todas las reseñas del local en Google. */
export function allReviewsUrl(
  reviews: ReviewSettings | undefined,
  mapsQuery: string,
): string {
  const placeId = reviews?.placeId?.trim()
  if (placeId) {
    return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`
  }
  return mapsUrl(mapsQuery)
}

function mapsUrl(q: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Deja solo reseñas con nombre y texto; las estrellas quedan entre 1 y 5. */
export function cleanReviews(
  items: ShopReview[] | undefined,
  max = 6,
): ShopReview[] {
  const out: ShopReview[] = []
  for (const r of items ?? []) {
    const nombre = r?.nombre?.trim()
    const texto = r?.texto?.trim()
    if (!nombre || !texto) continue
    const n = Math.round(Number(r.estrellas))
    out.push({
      nombre,
      texto,
      estrellas: Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 5,
      ...(r.fecha?.trim() ? { fecha: r.fecha.trim() } : {}),
    })
  }
  return out.slice(0, max)
}

/** Solo el primer nombre, con mayúscula inicial: "andres sosa" → "Andres". */
export function firstName(nombre: string): string {
  const first = nombre.trim().split(/\s+/)[0] ?? ''
  return first.charAt(0).toLocaleUpperCase('es') + first.slice(1)
}

/** "4,9" con coma decimal; null si la nota no es válida. */
export function formatRating(nota: number | undefined): string | null {
  if (typeof nota !== 'number' || !Number.isFinite(nota)) return null
  if (nota < 1 || nota > 5) return null
  return nota.toFixed(1).replace('.', ',')
}

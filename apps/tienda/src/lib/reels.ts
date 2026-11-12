import { cleanPostLinks } from './instagram'

/** Video de la sección "Mirá cómo quedan", tal como se carga en shop_settings.reels */
export interface ReelSetting {
  /** https://… o una ruta de archivo de la tienda, p. ej. "reels/vaso-river.mp4" */
  video: string
  poster?: string
  titulo?: string
  /** Link del reel en Instagram, para el botón "Ver en Instagram" */
  link?: string
}

export interface Reel {
  video: string
  poster: string | null
  title: string
  link: string | null
}

const MAX_REELS = 8

/** Solo https o archivos propios (sin esquemas raros ni rutas fuera de la tienda). */
function fileUrl(v: unknown, base: string): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (/^https:\/\/\S+$/i.test(s)) return s
  if (/^[\w][\w./-]*$/.test(s) && !s.includes('..')) return `${base}${s}`
  return null
}

/**
 * Deja solo los videos válidos de la lista cargada a mano: máximo 8, sin
 * repetidos y con las rutas de archivo resueltas contra la base de la tienda.
 */
export function cleanReels(raw: unknown, base = '/', max = MAX_REELS): Reel[] {
  if (!Array.isArray(raw)) return []
  const out: Reel[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const video = fileUrl(o.video, base)
    if (!video || out.some((r) => r.video === video)) continue
    out.push({
      video,
      poster: fileUrl(o.poster, base),
      title: typeof o.titulo === 'string' ? o.titulo.trim().slice(0, 80) : '',
      link:
        cleanPostLinks(typeof o.link === 'string' ? [o.link] : [])[0] ?? null,
    })
  }
  return out.slice(0, max)
}

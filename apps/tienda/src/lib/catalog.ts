import type { Family, Variant } from './types'

export interface CategoryMeta {
  slug: string
  label: string
  blurb: string
}

// Orden y nombres de las categorías tal como las ve el cliente
export const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'vasos',
    label: 'Vasos',
    blurb: 'Camiseta, ferneteros y Ferchetto, con tu nombre.',
  },
  {
    slug: 'milkshake',
    label: 'Milkshake',
    blurb: 'Vasos con la figura arriba.',
  },
  {
    slug: 'regalos',
    label: 'Regalos',
    blurb: 'Boxes, portalatas, mates y más.',
  },
  {
    slug: 'trofeos',
    label: 'Trofeos',
    blurb: 'Para torneos, clubes y eventos.',
  },
  {
    slug: 'llaveros',
    label: 'Llaveros',
    blurb: 'Sueltos o con tu logo por cantidad.',
  },
  { slug: 'figuras', label: 'Figuras', blurb: 'Articulados y personajes.' },
  {
    slug: 'juegos',
    label: 'Juegos',
    blurb: 'Tetris Balance, tateti y ruleta.',
  },
  {
    slug: 'hogar',
    label: 'Hogar',
    blurb: 'Lámparas, soportes y organizadores.',
  },
  { slug: 'didactico', label: 'Didáctico', blurb: 'Modelos para estudiar.' },
  { slug: 'insumos', label: 'Insumos', blurb: 'Pegamento y activador.' },
]

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug
}

export function inStock(f: Family): boolean {
  return f.variants.some((v) => v.stock > 0)
}

/** Precio mínimo de la familia (o el "desde" de las familias a pedido) */
export function minPrice(f: Family): number | null {
  if (f.variants.length === 0) return f.priceFrom
  return Math.min(...f.variants.map((v) => v.price))
}

export function maxPrice(f: Family): number | null {
  if (f.variants.length === 0) return f.priceFrom
  return Math.max(...f.variants.map((v) => v.price))
}

export function familyImage(f: Family): string | null {
  const withStock = f.variants.find((v) => v.stock > 0 && v.images.length > 0)
  const any = f.variants.find((v) => v.images.length > 0)
  return (withStock ?? any)?.images[0] ?? f.images?.[0] ?? null
}

/**
 * Fotos para rotar en el hero: la primera foto de cada producto (variante),
 * alternando entre familias para que dos seguidas no sean del mismo
 * producto. Primero las variantes con stock. Sin repetidos.
 */
export function heroPhotos(families: Family[], max: number): string[] {
  const queues = families.map((f) => {
    const fromVariants = [...f.variants]
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .map((v) => v.images[0])
      .filter((x): x is string => !!x)
    return fromVariants.length ? fromVariants : (f.images ?? [])
  })
  const out: string[] = []
  for (let round = 0; out.length < max; round++) {
    let added = false
    for (const q of queues) {
      const src = q[round]
      if (src === undefined) continue
      added = true
      if (!out.includes(src)) out.push(src)
      if (out.length === max) break
    }
    if (!added) break
  }
  return out
}

/** Copia mezclada (Fisher-Yates). `rnd` se puede inyectar para probarla. */
export function shuffle<T>(items: readonly T[], rnd = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export type Availability =
  | { kind: 'stock'; units: number }
  | { kind: 'pedido'; days: number }
  | { kind: 'cotizar' }

export function familyAvailability(f: Family): Availability {
  if (f.saleMode === 'cotizacion') return { kind: 'cotizar' }
  const units = f.variants.reduce((a, v) => a + v.stock, 0)
  return units > 0
    ? { kind: 'stock', units }
    : { kind: 'pedido', days: f.leadDays }
}

export function variantAvailability(
  f: Family,
  v: Variant | null,
  qty: number,
  personalized: boolean,
): Availability {
  if (f.saleMode === 'cotizacion') return { kind: 'cotizar' }
  if (!v || v.stock < qty || personalized)
    return { kind: 'pedido', days: f.leadDays }
  return { kind: 'stock', units: v.stock }
}

/** Valores posibles de cada eje, en el orden en que aparecen las variantes */
export function axisValues(f: Family, key: string): string[] {
  const out: string[] = []
  for (const v of f.variants) {
    const val = v.options[key]
    if (val && !out.includes(val)) out.push(val)
  }
  return out
}

/** Variante que coincide con la selección (o null si la combinación no existe) */
export function findVariant(
  f: Family,
  sel: Record<string, string>,
): Variant | null {
  if (f.variants.length === 1 && f.optionAxes.length === 0) return f.variants[0]
  return (
    f.variants.find((v) =>
      f.optionAxes.every((a) => !sel[a.key] || v.options[a.key] === sel[a.key]),
    ) ?? null
  )
}

/** ¿Existe alguna variante con este valor, dadas las otras elecciones? */
export function valueExists(
  f: Family,
  sel: Record<string, string>,
  key: string,
  value: string,
): boolean {
  return f.variants.some(
    (v) =>
      v.options[key] === value &&
      f.optionAxes.every(
        (a) => a.key === key || !sel[a.key] || v.options[a.key] === sel[a.key],
      ),
  )
}

/** Selección inicial: la primera variante con stock, si hay */
export function initialSelection(f: Family): Record<string, string> {
  const v = f.variants.find((x) => x.stock > 0) ?? f.variants[0]
  return v ? { ...v.options } : {}
}

export function searchFamilies(list: Family[], q: string): Family[] {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const terms = norm(q).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return list
  return list.filter((f) => {
    const hay = norm(
      [
        f.name,
        f.category,
        f.description ?? '',
        ...f.variants.flatMap((v) => [v.name, ...Object.values(v.options)]),
      ].join(' '),
    )
    return terms.every((t) => hay.includes(t))
  })
}

import { type Availability, familyAvailability, familyImage } from './catalog'
import type { Family, Variant } from './types'

/** Una tarjeta del listado: una familia entera o una variante puntual */
export interface CatalogCard {
  key: string
  family: Family
  /** null = tarjeta de la familia completa */
  variant: Variant | null
  /** Ej. "650 ml · River" (vacío en tarjetas de familia) */
  label: string
  image: string | null
  availability: Availability
  inStock: boolean
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Valores de las opciones de la variante, en el orden de optionAxes */
export function variantLabel(f: Family, v: Variant): string {
  const ordered = f.optionAxes.map((a) => v.options[a.key]).filter(Boolean)
  const rest = Object.entries(v.options)
    .filter(([k]) => !f.optionAxes.some((a) => a.key === k))
    .map(([, val]) => val)
  const parts = [...ordered, ...rest].filter(Boolean)
  return (parts.length ? parts : [v.name]).join(' · ')
}

function variantAvailability(f: Family, v: Variant): Availability {
  if (f.saleMode === 'cotizacion') return { kind: 'cotizar' }
  return v.stock > 0
    ? { kind: 'stock', units: v.stock }
    : { kind: 'pedido', days: f.leadDays }
}

/** Una tarjeta por variante si hay 2+; si no, una sola por familia */
export function familyCards(f: Family): CatalogCard[] {
  if (f.variants.length < 2) {
    return [
      {
        key: f.slug,
        family: f,
        variant: null,
        label: '',
        image: familyImage(f),
        availability: familyAvailability(f),
        inStock: f.variants.some((v) => v.stock > 0),
      },
    ]
  }
  return f.variants.map((v) => ({
    key: `${f.slug}:${v.id}`,
    family: f,
    variant: v,
    label: variantLabel(f, v),
    image: v.images[0] ?? familyImage(f),
    availability: variantAvailability(f, v),
    inStock: v.stock > 0,
  }))
}

export interface CardFilters {
  onlyStock?: boolean
  query?: string
}

/** Texto donde busca el cliente: familia, categoría y (si hay) la variante */
function haystack(c: CatalogCard): string {
  const f = c.family
  const base = [f.name, f.category, f.description ?? '']
  // Tarjeta de familia: también matchea por cualquier variante
  const vars = c.variant
    ? [c.variant.name, ...Object.values(c.variant.options)]
    : f.variants.flatMap((v) => [v.name, ...Object.values(v.options)])
  return norm([...base, ...vars].join(' '))
}

export function buildCards(
  families: Family[],
  { onlyStock = false, query = '' }: CardFilters = {},
): CatalogCard[] {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  return families
    .flatMap(familyCards)
    .filter((c) => !onlyStock || c.inStock)
    .filter((c) => {
      if (terms.length === 0) return true
      const hay = haystack(c)
      return terms.every((t) => hay.includes(t))
    })
}

/** Opciones que corresponden a un ?v=<variantId> (o null si no existe) */
export function selectionForVariant(
  f: Family,
  variantId: string | null,
): Record<string, string> | null {
  if (!variantId) return null
  const v = f.variants.find((x) => x.id === variantId)
  return v ? { ...v.options } : null
}

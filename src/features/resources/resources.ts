import type { Database } from '@/lib/database.types'

type Tables = Database['public']['Tables']
export type Resource = Tables['resources']['Row']
export type SavedSearch = Tables['saved_searches']['Row']
export type Category =
  'modelos' | 'ia' | 'personalizar' | 'reparar' | 'proveedores' | 'guias'
export type Price = 'gratis' | 'mixto' | 'pago'
export type SectionKey = 'modelos' | 'crear' | 'proveedores' | 'guias'

export interface Section {
  key: SectionKey
  title: string
  categories: Category[]
  // Empty-slot card for sections the team fills by hand.
  add?: { label: string; hint: string; category: Category }
}

export const CATEGORIES: Category[] = [
  'modelos',
  'ia',
  'personalizar',
  'reparar',
  'proveedores',
  'guias',
]
export const CATEGORY_LABEL: Record<Category, string> = {
  modelos: 'Modelos para descargar',
  ia: 'Crear con IA',
  personalizar: 'Personalizar y generar',
  reparar: 'Reparar y convertir',
  proveedores: 'Proveedores',
  guias: 'Guías y ayuda',
}
export const PRICES: Price[] = ['gratis', 'mixto', 'pago']
export const PRICE_LABEL: Record<Price, string> = {
  gratis: 'Gratis',
  mixto: 'Gratis y pago',
  pago: 'Pago',
}
export const SECTIONS: Section[] = [
  { key: 'modelos', title: 'Modelos para descargar', categories: ['modelos'] },
  {
    key: 'crear',
    title: 'Crear, personalizar y reparar',
    categories: ['ia', 'personalizar', 'reparar'],
  },
  {
    key: 'proveedores',
    title: 'Proveedores',
    categories: ['proveedores'],
    add: {
      label: 'Agregar proveedor',
      hint: 'Tiendas de filamento e insumos.',
      category: 'proveedores',
    },
  },
  {
    key: 'guias',
    title: 'Guías y ayuda',
    categories: ['guias'],
    add: {
      label: 'Agregar guía',
      hint: 'Tutoriales, perfiles de impresión o "cómo hacemos" algo en el taller.',
      category: 'guias',
    },
  },
]

const DAY = 86_400_000

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

export function buildSearchUrl(template: string, query: string): string {
  return template.split('{q}').join(encodeURIComponent(query.trim()))
}

export function isSearchTemplate(text: string): boolean {
  const t = text.trim()
  return /^https?:\/\//i.test(t) && t.includes('{q}')
}

function byOrder(a: Resource, b: Resource): number {
  return a.position - b.position || a.name.localeCompare(b.name, 'es')
}

export function searchSites(rs: readonly Resource[]): Resource[] {
  return rs.filter((r) => r.search_url).sort(byOrder)
}

export function pinnedResources(rs: readonly Resource[]): Resource[] {
  return rs.filter((r) => r.pinned).sort(byOrder)
}

function matches(r: Resource, q: string): boolean {
  return `${r.name} ${domainOf(r.url)} ${r.description ?? ''}`
    .toLowerCase()
    .includes(q)
}

// The four sections in screen order. Filtering hides sections with no match;
// without a filter, sections with an "add" card always show.
export function sections(rs: readonly Resource[], query: string) {
  const q = query.trim().toLowerCase()
  return SECTIONS.map((section) => ({
    section,
    items: rs
      .filter(
        (r) =>
          section.categories.includes(r.category as Category) &&
          (!q || matches(r, q)),
      )
      .sort(
        (a, b) =>
          section.categories.indexOf(a.category as Category) -
            section.categories.indexOf(b.category as Category) || byOrder(a, b),
      ),
  })).filter((s) => s.items.length > 0 || (!q && s.section.add))
}

export function accessTags(r: Resource): string[] {
  return [
    PRICE_LABEL[r.price as Price],
    r.needs_account ? 'Con cuenta' : 'Sin cuenta',
  ]
}

const SHORT = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
})

// "nunca", "hoy", "ayer", "hace 3 días", "hace 2 sem", "1 ago".
export function lastUsedLabel(stamp: string | null, now = new Date()): string {
  if (!stamp) return 'nunca'
  const d = new Date(stamp)
  const start = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(now) - start(d)) / DAY)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 28) return `hace ${Math.floor(days / 7)} sem`
  return SHORT.format(d).replace('.', '')
}

// One tab per url. Browsers let only the first through unless pop-ups are
// allowed; the ones that came back null are returned so the screen can offer
// plain links. `noopener` is not passed because it makes open() return null
// even on success; the opener is cut by hand instead.
export function openSearch(
  urls: readonly string[],
  open: (url: string, target: string) => Window | null = (u, t) =>
    window.open(u, t),
): string[] {
  const blocked: string[] = []
  for (const url of urls) {
    const win = open(url, '_blank')
    if (!win) {
      blocked.push(url)
      continue
    }
    try {
      win.opener = null
    } catch {
      // Some browsers forbid it cross-origin; the tab is open anyway.
    }
  }
  return blocked
}

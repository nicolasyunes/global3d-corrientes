// Pure product list filtering/sorting. Config-aware: category/subcat matching
// goes through navigation.ts so aliases (e.g. 'filamentos' -> 'impresion-3d')
// and memberCats sub-links resolve correctly.
import type { Product } from './data/products'
import { findNav } from './navigation'

export type PriceBucket = 'all' | 'low' | 'mid' | 'high'
export type SortValue = 'relevance' | 'price-asc' | 'price-desc'
export type CapacityValue = 'all' | '500ml' | '650ml' | '1L'

export type ProductFilters = {
  search: string
  category: string // 'all' or a category slug (canonical or alias)
  subcat: string // 'all' or a sub-link slug
  capacity: CapacityValue
  themes: string[] // empty = no theme filter; OR semantics
  priceBucket: PriceBucket
  brand: string // 'all' or a filament brand slug
  personalizableOnly: boolean
  sort: SortValue
}

export const PRICE_BUCKETS: { key: PriceBucket; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'low', label: 'Hasta $5.000' },
  { key: 'mid', label: '$5.000 - $20.000' },
  { key: 'high', label: 'Más de $20.000' },
]

function canonical(slug: string): string {
  return findNav(slug)?.slug ?? slug
}

function matchesSubcat(prod: Product, category: string, subcat: string): boolean {
  if (subcat === 'all') return true
  const link = findNav(category)?.subLinks.find((s) => s.slug === subcat)
  if (link?.memberCats) {
    if (!link.memberCats.includes(prod.cat)) return false
    if (link.unit && prod.unit !== link.unit) return false
    return true
  }
  return prod.subcat === subcat
}

export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  let list = products.slice()

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  } else {
    if (filters.category !== 'all') {
      const target = canonical(filters.category)
      list = list.filter((p) => canonical(p.cat) === target)
      list = list.filter((p) => matchesSubcat(p, filters.category, filters.subcat))
      if (filters.capacity !== 'all') list = list.filter((p) => p.capacity === filters.capacity)
    }
    if (filters.themes.length > 0) {
      list = list.filter((p) => (p.themes ?? []).some((t) => filters.themes.includes(t)))
    }
  }

  if (filters.priceBucket === 'low') list = list.filter((p) => p.price <= 5000)
  if (filters.priceBucket === 'mid') list = list.filter((p) => p.price > 5000 && p.price <= 20000)
  if (filters.priceBucket === 'high') list = list.filter((p) => p.price > 20000)

  if (filters.personalizableOnly) list = list.filter((p) => p.personalizable)

  if (canonical(filters.category) === 'impresion-3d' && filters.brand !== 'all') {
    list = list.filter((p) => p.brand === filters.brand)
  }

  if (filters.sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price)
  if (filters.sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price)

  return list
}

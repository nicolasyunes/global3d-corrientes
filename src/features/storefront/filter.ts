// Pure product list filtering/sorting — ported from the "Global3D Tienda" design.
import type { Product } from './data/products'

export type PriceBucket = 'all' | 'low' | 'mid' | 'high'
export type SortValue = 'relevance' | 'price-asc' | 'price-desc'

export type ProductFilters = {
  search: string
  category: string // 'all' or a category slug
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

export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  let list = products.slice()

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  } else if (filters.category !== 'all') {
    list = list.filter((p) => p.cat === filters.category)
  }

  if (filters.priceBucket === 'low') list = list.filter((p) => p.price <= 5000)
  if (filters.priceBucket === 'mid') list = list.filter((p) => p.price > 5000 && p.price <= 20000)
  if (filters.priceBucket === 'high') list = list.filter((p) => p.price > 20000)

  if (filters.personalizableOnly) list = list.filter((p) => p.personalizable)

  if (filters.category === 'filamentos' && filters.brand !== 'all') {
    list = list.filter((p) => p.brand === filters.brand)
  }

  if (filters.sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price)
  if (filters.sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price)

  return list
}

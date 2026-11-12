import { matchesQuery } from '@/lib/search'
import type { ProductRow } from './products.api'

// Below this quantity a product reads as "low stock" rather than plain OK —
// gives the operator a heads-up before it actually runs out. Zero is always
// its own tier ("out"), checked first below.
export const LOW_STOCK_THRESHOLD = 5

export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(
  product: Pick<ProductRow, 'stock_quantity'>,
): StockLevel {
  if (product.stock_quantity <= 0) return 'out'
  if (product.stock_quantity < LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}

export interface ProductFilter {
  query: string
  activeOnly: boolean
}

export function emptyProductFilter(): ProductFilter {
  return { query: '', activeOnly: false }
}

// Client-side filter over the already-loaded list — a workshop's own products
// are few enough that a server-side search isn't worth the round trip.
// Búsqueda por palabras (ver matchesQuery) sobre nombre y descripción: los
// productos no tienen SKU, categoría ni variante propios.
export function productMatchesQuery(
  product: Pick<ProductRow, 'name' | 'description'>,
  query: string,
): boolean {
  return matchesQuery([product.name, product.description], query)
}

export function filterProducts(
  products: readonly ProductRow[],
  filter: ProductFilter,
): ProductRow[] {
  return products.filter((product) => {
    if (filter.activeOnly && !product.active) return false
    return productMatchesQuery(product, filter.query)
  })
}

import type { ProductRow } from './products.api'

// Below this quantity a product reads as "low stock" rather than plain OK —
// gives the operator a heads-up before it actually runs out. Zero is always
// its own tier ("out"), checked first below.
export const LOW_STOCK_THRESHOLD = 5

export type StockLevel = 'out' | 'low' | 'ok'

export function stockLevel(product: Pick<ProductRow, 'stock_quantity'>): StockLevel {
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

// Client-side filter over the already-loaded catalog — the list is small
// enough (a workshop's own products) that a server-side search isn't worth
// the round trip. Matches name/description case-insensitively.
export function filterProducts(
  products: readonly ProductRow[],
  filter: ProductFilter,
): ProductRow[] {
  const query = filter.query.trim().toLowerCase()

  return products.filter((product) => {
    if (filter.activeOnly && !product.active) return false
    if (query === '') return true
    return (
      product.name.toLowerCase().includes(query) ||
      (product.description ?? '').toLowerCase().includes(query)
    )
  })
}

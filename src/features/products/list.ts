import { matchesQuery } from '@/lib/search'
import type { ProductCatalogInfo, ProductRow } from './products.api'

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

// Cómo se vende hoy, con la misma regla que usa la sincronización con ML:
// - familia a pedido / a cotizar → siempre "a pedido" (se fabrica)
// - sin stock pero la familia tiene plazo de fabricación → "a pedido"
// - con stock → "con stock"; lo demás → "sin stock".
export type StockStatus = 'con_stock' | 'sin_stock' | 'a_pedido'

export function stockStatus(
  product: Pick<ProductRow, 'stock_quantity'>,
  info: ProductCatalogInfo | undefined,
): StockStatus {
  const family = info?.family
  if (family && family.saleMode !== 'stock') return 'a_pedido'
  if (product.stock_quantity > 0) return 'con_stock'
  if (family && (family.leadDays ?? 0) > 0) return 'a_pedido'
  return 'sin_stock'
}

export type ActiveFilter = 'all' | 'active' | 'inactive'
export type StockFilter = 'all' | StockStatus
export type MlFilter = 'all' | 'published' | 'active' | 'paused' | 'none'
export const NO_FAMILY = '__none__'

export interface ProductFilter {
  query: string
  /** Categoría de la familia; '' = todas, NO_FAMILY = sin familia. */
  category: string
  /** Subcategoría de la familia; '' = todas, NO_FAMILY = sin subcategoría. */
  subcategory: string
  /** id de la familia; '' = todas, NO_FAMILY = sin familia. */
  family: string
  active: ActiveFilter
  stock: StockFilter
  ml: MlFilter
  /** sale_mode de la familia; '' = todos, NO_FAMILY = sin familia. */
  saleMode: string
}

export function emptyProductFilter(): ProductFilter {
  return {
    query: '',
    category: '',
    subcategory: '',
    family: '',
    active: 'all',
    stock: 'all',
    ml: 'all',
    saleMode: '',
  }
}

/** Cuántos filtros (sin contar la búsqueda) están puestos. */
export function activeFilterCount(filter: ProductFilter): number {
  const empty = emptyProductFilter()
  return (Object.keys(empty) as (keyof ProductFilter)[]).filter(
    (k) => k !== 'query' && filter[k] !== empty[k],
  ).length
}

// Búsqueda por palabras (ver matchesQuery): cada palabra tiene que aparecer
// en el nombre o la descripción del producto, o en el nombre, slug,
// categoría o subcategoría de su familia. Sin mayúsculas ni acentos, en cualquier orden.
export function productMatchesQuery(
  product: Pick<ProductRow, 'name' | 'description'>,
  query: string,
  info?: ProductCatalogInfo,
): boolean {
  const f = info?.family
  return matchesQuery(
    [
      product.name,
      product.description,
      f?.name,
      f?.slug,
      f?.slug.replace(/-/g, ' '),
      f?.category,
      f?.subcategory,
    ],
    query,
  )
}

function matchesMl(info: ProductCatalogInfo | undefined, ml: MlFilter) {
  const status = info?.mlStatus ?? null
  switch (ml) {
    case 'all':
      return true
    case 'published':
      return status !== null
    case 'active':
      return status === 'active'
    case 'paused':
      return status !== null && status !== 'active'
    case 'none':
      return status === null
  }
}

function matchesGroup(value: string | undefined, wanted: string) {
  if (!wanted) return true
  if (wanted === NO_FAMILY) return value === undefined
  return value === wanted
}

// Client-side filter over the already-loaded list — el catálogo son ~100
// productos, no vale la pena ir a la base en cada tecla.
export function filterProducts(
  products: readonly ProductRow[],
  filter: ProductFilter,
  catalog: Readonly<Record<string, ProductCatalogInfo>> = {},
): ProductRow[] {
  return products.filter((product) => {
    const info = catalog[product.id]
    const family = info?.family
    if (filter.active === 'active' && !product.active) return false
    if (filter.active === 'inactive' && product.active) return false
    if (!matchesGroup(family?.category, filter.category)) return false
    if (!matchesGroup(family?.subcategory ?? undefined, filter.subcategory))
      return false
    if (!matchesGroup(family?.id, filter.family)) return false
    if (!matchesGroup(family?.saleMode, filter.saleMode)) return false
    if (filter.stock !== 'all' && stockStatus(product, info) !== filter.stock)
      return false
    if (!matchesMl(info, filter.ml)) return false
    return productMatchesQuery(product, filter.query, info)
  })
}

// Los filtros viven en la URL (?q=…&cat=…) para que se puedan recargar,
// compartir y volver atrás desde la ficha sin perderlos.
const PARAM: Record<keyof ProductFilter, string> = {
  query: 'q',
  category: 'cat',
  subcategory: 'sub',
  family: 'fam',
  active: 'estado',
  stock: 'stock',
  ml: 'ml',
  saleMode: 'modo',
}

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

export function filterFromParams(params: URLSearchParams): ProductFilter {
  return {
    query: params.get(PARAM.query) ?? '',
    category: params.get(PARAM.category) ?? '',
    subcategory: params.get(PARAM.subcategory) ?? '',
    family: params.get(PARAM.family) ?? '',
    saleMode: params.get(PARAM.saleMode) ?? '',
    active: pick(
      params.get(PARAM.active),
      ['all', 'active', 'inactive'],
      'all',
    ),
    stock: pick(
      params.get(PARAM.stock),
      ['all', 'con_stock', 'sin_stock', 'a_pedido'],
      'all',
    ),
    ml: pick(
      params.get(PARAM.ml),
      ['all', 'published', 'active', 'paused', 'none'],
      'all',
    ),
  }
}

export function filterToParams(filter: ProductFilter): URLSearchParams {
  const empty = emptyProductFilter()
  const params = new URLSearchParams()
  for (const key of Object.keys(PARAM) as (keyof ProductFilter)[]) {
    const value = filter[key]
    if (value && value !== empty[key]) params.set(PARAM[key], value)
  }
  return params
}

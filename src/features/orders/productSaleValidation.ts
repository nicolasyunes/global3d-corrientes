// Pure validation for the direct product-sale form on /admin/ventas-pedidos.
// Mirrors sales/validation.ts (validateSale / remainingAfterSale): no DB, no
// DOM, shared between the component and its unit tests.

import type { ProductRow } from '@/features/products/products.api'

// Sentinel `productId` for "not in the catalog" — reveals the free-text name
// field. A real product id is a uuid, so there's no collision.
export const FREE_TEXT_PRODUCT = '__free__'

export interface ProductSaleDraft {
  productId: string // '' , FREE_TEXT_PRODUCT, or a products.id
  productName: string // free-text name, only used when productId === FREE_TEXT_PRODUCT
  quantity: string // positive integer, defaults to '1'
  amount: string // decimal or ''
  method: string // '' or a PaymentMethod
  customerName: string // '' (optional) or a name to upsert
}

export type ProductSaleFieldErrors = Partial<
  Record<keyof ProductSaleDraft, string>
>

export function emptyProductSaleDraft(): ProductSaleDraft {
  return {
    productId: '',
    productName: '',
    quantity: '1',
    amount: '',
    method: '',
    customerName: '',
  }
}

export function parsePositiveDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

// The catalog row behind `draft.productId`, or undefined for the empty
// placeholder / free-text option.
export function selectedCatalogProduct(
  draft: Pick<ProductSaleDraft, 'productId'>,
  products: readonly ProductRow[],
): ProductRow | undefined {
  if (draft.productId === '' || draft.productId === FREE_TEXT_PRODUCT) {
    return undefined
  }
  return products.find((p) => p.id === draft.productId)
}

// Prefill for the Total field when a catalog product is picked: its base
// price times quantity. Null when there's nothing to suggest (free text, no
// price on file, or an unparseable quantity) — the operator types it then.
export function suggestedAmount(
  product: ProductRow | undefined,
  quantity: number | null,
): number | null {
  if (!product || product.base_price === null || quantity === null) return null
  return product.base_price * quantity
}

// Live "quedan X en stock" confirmation as the operator types, ahead of the
// submit pre-check. Null when there's no catalog product or no quantity yet.
export function remainingStockAfterSale(
  product: ProductRow | undefined,
  quantity: number | null,
): number | null {
  if (!product || quantity === null) return null
  return product.stock_quantity - quantity
}

// Client-side pre-check for fast feedback; the DB trigger + `stock_quantity >= 0`
// CHECK remain the source of truth (a concurrent sale can still make the stock
// check stale by the time this insert lands).
export function validateProductSale(
  draft: ProductSaleDraft,
  products: readonly ProductRow[],
): ProductSaleFieldErrors {
  const errors: ProductSaleFieldErrors = {}

  const isFreeText = draft.productId === FREE_TEXT_PRODUCT
  if (draft.productId === '') {
    errors.productId = 'Elegí un producto del catálogo o cargá uno.'
  } else if (isFreeText && draft.productName.trim() === '') {
    errors.productName = 'Escribí el nombre del producto.'
  }

  const quantity = parsePositiveInt(draft.quantity)
  if (quantity === null) {
    errors.quantity = 'Cantidad inválida (entero mayor a 0).'
  } else {
    const catalog = selectedCatalogProduct(draft, products)
    if (catalog && quantity > catalog.stock_quantity) {
      errors.quantity = `Solo hay ${catalog.stock_quantity} en stock.`
    }
  }

  const amount = parsePositiveDecimal(draft.amount)
  if (amount === null) {
    errors.amount = 'Ingresá un monto válido y positivo.'
  }

  return errors
}

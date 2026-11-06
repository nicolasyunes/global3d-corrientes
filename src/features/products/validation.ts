// Validación pura del form de producto. Sin DB, sin DOM: compartida entre el
// componente y sus tests unitarios.
import { parseMoney } from '@/features/orders/orderDraft'

export interface ProductDraft {
  name: string
  description: string
  basePrice: string // "12.500", "12500,50" o ''
  stockQuantity: string // entero o ''
  active: boolean
}

export type FieldErrors = Partial<Record<keyof ProductDraft, string>>

export function emptyProductDraft(): ProductDraft {
  return {
    name: '',
    description: '',
    basePrice: '',
    stockQuantity: '0',
    active: true,
  }
}

export function parseNonNegativeDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

export interface ProductPatch {
  name: string
  description: string | null
  base_price: number | null
  active: boolean
  stock_quantity?: number
}

/**
 * Lo que manda la ficha al guardar. `loadedStock` es el stock que tenía el
 * producto al abrir la ficha (null si es nuevo): si no se tocó el campo, el
 * stock no se manda. Así guardar un precio no pisa el stock que cambió
 * mientras la ficha estaba abierta (una venta lo descuenta por trigger, o se
 * ajustó desde la lista), ni deja un "ajuste" falso en el historial.
 */
export function buildProductPatch(
  draft: ProductDraft,
  loadedStock: number | null,
): ProductPatch {
  const patch: ProductPatch = {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    base_price: parseMoney(draft.basePrice),
    active: draft.active,
  }
  const stock = parseNonNegativeInt(draft.stockQuantity) ?? 0
  if (loadedStock === null || stock !== loadedStock)
    patch.stock_quantity = stock
  return patch
}

export function validateProduct(draft: ProductDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.name.trim() === '') errors.name = 'Ingresá un nombre.'

  const price = parseMoney(draft.basePrice)
  if (price !== null && (Number.isNaN(price) || price < 0)) {
    errors.basePrice = 'Ingresá un precio válido (0 o más).'
  }

  if (parseNonNegativeInt(draft.stockQuantity) === null) {
    errors.stockQuantity = 'Ingresá un stock válido (entero, 0 o más).'
  }

  return errors
}

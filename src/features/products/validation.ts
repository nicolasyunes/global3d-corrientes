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

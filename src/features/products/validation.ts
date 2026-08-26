// Pure validation for the product form. Mirrors orders/validation.ts and
// sales/validation.ts: no DB, no DOM, shared between the component and its
// unit tests.

export interface ProductDraft {
  name: string
  description: string
  basePrice: string // decimal or ''
  stockQuantity: string // integer or ''
  active: boolean
}

export type FieldErrors = Partial<Record<keyof ProductDraft, string>>

export function emptyProductDraft(): ProductDraft {
  return { name: '', description: '', basePrice: '', stockQuantity: '0', active: true }
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

  if (draft.name.trim() === '') {
    errors.name = 'Ingresá un nombre.'
  }

  if (draft.basePrice.trim() !== '' && parseNonNegativeDecimal(draft.basePrice) === null) {
    errors.basePrice = 'Ingresá un precio válido (0 o más).'
  }

  if (parseNonNegativeInt(draft.stockQuantity) === null) {
    errors.stockQuantity = 'Ingresá un stock válido (entero, 0 o más).'
  }

  return errors
}

// Validación pura del form de producto. Sin DB, sin DOM: compartida entre el
// componente y sus tests unitarios.

export interface ProductDraft {
  name: string
  description: string
  basePrice: string // decimal o ''
  compareAtPrice: string // decimal o ''
  stockQuantity: string // entero o ''
  sku: string
  weightGrams: string // entero o ''
  slug: string
  categoryId: string // uuid o ''
  subcategory: string // slug o ''
  personalizable: boolean
  customOnRequest: boolean
  active: boolean
}

export type FieldErrors = Partial<Record<keyof ProductDraft, string>>

export function emptyProductDraft(): ProductDraft {
  return {
    name: '',
    description: '',
    basePrice: '',
    compareAtPrice: '',
    stockQuantity: '0',
    sku: '',
    weightGrams: '',
    slug: '',
    categoryId: '',
    subcategory: '',
    personalizable: false,
    customOnRequest: false,
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

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateProduct(draft: ProductDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.name.trim() === '') errors.name = 'Ingresá un nombre.'

  if (
    draft.basePrice.trim() !== '' &&
    parseNonNegativeDecimal(draft.basePrice) === null
  ) {
    errors.basePrice = 'Ingresá un precio válido (0 o más).'
  }

  if (draft.compareAtPrice.trim() !== '') {
    const cmp = parseNonNegativeDecimal(draft.compareAtPrice)
    const base = parseNonNegativeDecimal(draft.basePrice)
    if (cmp === null)
      errors.compareAtPrice = 'Ingresá un precio comparativo válido.'
    else if (base !== null && cmp <= base)
      errors.compareAtPrice =
        'El precio comparativo debe ser mayor al precio base.'
  }

  if (parseNonNegativeInt(draft.stockQuantity) === null) {
    errors.stockQuantity = 'Ingresá un stock válido (entero, 0 o más).'
  }

  if (
    draft.weightGrams.trim() !== '' &&
    parseNonNegativeInt(draft.weightGrams) === null
  ) {
    errors.weightGrams = 'Ingresá un peso válido en gramos (entero).'
  }

  if (draft.sku.trim() !== '' && /\s/.test(draft.sku.trim())) {
    errors.sku = 'El SKU no puede tener espacios.'
  }

  if (draft.slug.trim() !== '' && !SLUG_RE.test(draft.slug.trim())) {
    errors.slug = 'El slug solo admite minúsculas, números y guiones.'
  }

  return errors
}

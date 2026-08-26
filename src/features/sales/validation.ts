// Pure validation for the supplies-sale form. Mirrors orders/validation.ts:
// no DB, no DOM, shared between the component and its unit tests.

import type { InventoryRow } from './sales.api'

export interface SaleDraft {
  inventoryId: string // '' or an inventory row id
  quantityGrams: string // decimal or ''
  amount: string // decimal or ''
  method: string // '' or a PaymentMethod
}

export type FieldErrors = Partial<Record<keyof SaleDraft, string>>

export function emptySaleDraft(): SaleDraft {
  return { inventoryId: '', quantityGrams: '', amount: '', method: '' }
}

export function parsePositiveDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

// Live "quedan Xg" confirmation as the operator types, ahead of submit — the
// same spool.remaining_grams the pre-check below reads, surfaced positively
// instead of only as an error once it's exceeded. Null when there's nothing
// meaningful to show yet (no spool chosen, unknown stock, or no grams typed).
export function remainingAfterSale(
  spool: InventoryRow | undefined,
  grams: number | null,
): number | null {
  if (!spool || spool.remaining_grams === null || grams === null) return null
  return spool.remaining_grams - grams
}

// Client-side pre-check so the operator gets fast feedback ahead of the DB
// round trip; the DB trigger + CHECK constraint remain the source of truth
// (a concurrent sale could still make this check stale by the time it lands).
export function validateSale(
  draft: SaleDraft,
  spools: InventoryRow[],
): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.inventoryId === '') {
    errors.inventoryId = 'Elegí un spool.'
  }

  const grams = parsePositiveDecimal(draft.quantityGrams)
  if (draft.quantityGrams.trim() === '' || grams === null) {
    errors.quantityGrams = 'Ingresá los gramos vendidos (> 0).'
  } else {
    const spool = spools.find((s) => s.id === draft.inventoryId)
    if (
      spool &&
      spool.remaining_grams !== null &&
      grams > spool.remaining_grams
    ) {
      errors.quantityGrams = `Solo quedan ${spool.remaining_grams}g de este spool.`
    }
  }

  const amount = parsePositiveDecimal(draft.amount)
  if (draft.amount.trim() === '' || amount === null) {
    errors.amount = 'Ingresá un monto válido y positivo.'
  }

  return errors
}

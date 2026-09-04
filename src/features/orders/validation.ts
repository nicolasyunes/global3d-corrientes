// Pure, dependency-free validation and smart-default logic for the order form.
// Kept out of the React component so the form and the unit tests share one
// source of truth. No DB, no DOM — every function is deterministic.

import {
  ORIGIN_CHANNEL,
  PAYMENT_METHOD,
  PRODUCT_TYPE,
  type ProductType,
} from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'

// Raw form state. Numeric and multi-select fields stay as strings so the form
// can hold an empty (unset) value without coercing to 0 or ''; parsing happens
// at validation/save time.
export interface OrderDraft {
  customerName: string
  customerPhone: string // single "Phone / WhatsApp" contact, stored to `phone`
  productType: string // '' or a ProductType
  dueDate: string // 'YYYY-MM-DD' or ''
  totalAmount: string // decimal or ''
  deposit: string // decimal or ''
  pendingBalance: string // explicit override or '' (auto = total − deposit)
  paymentMethod: string // '' or a PaymentMethod
  originChannel: string // '' or an OriginChannel
  referenceLink: string
  personalization: string
  measurements: string
  observations: string
}

export type FieldErrors = Partial<Record<keyof OrderDraft, string>>

// --- smart defaults ---------------------------------------------------------

// A business lead time: weekdays only, so an order captured on a weekend never
// lands on a Saturday/Sunday due date.
export const DEFAULT_LEAD_TIME_DAYS = 3

export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const weekday = result.getDay() // 0 = Sunday, 6 = Saturday
    if (weekday !== 0 && weekday !== 6) added += 1
  }
  return result
}

export function toISODate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultDueDate(now: Date = new Date()): string {
  return toISODate(addBusinessDays(now, DEFAULT_LEAD_TIME_DAYS))
}

// --- numeric parsing --------------------------------------------------------

// Parses a decimal string to a non-negative number, or null when the field is
// empty OR the value is not a valid non-negative amount. Callers distinguish
// "empty" (allowed, optional) from "invalid" (blocked by validation) by
// checking the raw string separately.
export function parseMoney(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

// The stored pending_balance: the explicit override when present, otherwise
// total − deposit (nulls treated as 0), otherwise null when nothing is set.
export function resolvedPendingBalance(draft: OrderDraft): number | null {
  if (draft.pendingBalance.trim() !== '') {
    return parseMoney(draft.pendingBalance)
  }
  const total = parseMoney(draft.totalAmount)
  const deposit = parseMoney(draft.deposit)
  if (total === null && deposit === null) return null
  return (total ?? 0) - (deposit ?? 0)
}

// --- validation -------------------------------------------------------------

function includes<T extends string>(
  value: string,
  list: readonly T[],
): boolean {
  return (list as readonly string[]).includes(value)
}

export function validateOrder(draft: OrderDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.customerName.trim() === '') {
    errors.customerName = 'Ingresá el nombre del cliente.'
  }

  if (!includes(draft.productType, PRODUCT_TYPE)) {
    errors.productType = 'Elegí un tipo de producto.'
  }

  if (draft.dueDate === '') {
    errors.dueDate = 'Elegí una fecha de entrega.'
  } else if (Number.isNaN(Date.parse(draft.dueDate))) {
    errors.dueDate = 'Ingresá una fecha de entrega válida.'
  }

  const total = parseMoney(draft.totalAmount)
  if (draft.totalAmount.trim() !== '' && total === null) {
    errors.totalAmount = 'Ingresá un monto válido (no negativo).'
  }

  const deposit = parseMoney(draft.deposit)
  if (draft.deposit.trim() !== '' && deposit === null) {
    errors.deposit = 'Ingresá una seña válida (no negativa).'
  }

  if (deposit !== null && total === null) {
    errors.deposit = 'Ingresá el monto total antes de la seña.'
  } else if (deposit !== null && total !== null && deposit > total) {
    errors.deposit = 'La seña no puede superar el monto total.'
  }

  if (
    draft.pendingBalance.trim() !== '' &&
    parseMoney(draft.pendingBalance) === null
  ) {
    errors.pendingBalance = 'Ingresá un saldo válido (no negativo).'
  }

  if (
    draft.paymentMethod !== '' &&
    !includes(draft.paymentMethod, PAYMENT_METHOD)
  ) {
    errors.paymentMethod = 'Elegí un método de pago válido.'
  }

  if (
    draft.originChannel !== '' &&
    !includes(draft.originChannel, ORIGIN_CHANNEL)
  ) {
    errors.originChannel = 'Elegí un canal de origen válido.'
  }

  if (draft.referenceLink.trim() !== '') {
    let isValidUrl = false
    try {
      const parsed = new URL(draft.referenceLink.trim())
      isValidUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      isValidUrl = false
    }
    if (!isValidUrl) {
      errors.referenceLink = 'Ingresá un link válido (con https://).'
    }
  }

  return errors
}

export function emptyDraft(): OrderDraft {
  return {
    customerName: '',
    customerPhone: '',
    productType: '',
    dueDate: defaultDueDate(),
    totalAmount: '',
    deposit: '',
    pendingBalance: '',
    paymentMethod: '',
    originChannel: '',
    referenceLink: '',
    personalization: '',
    measurements: '',
    observations: '',
  }
}

// --- color spec (per-part) --------------------------------------------------

export interface ColorPart {
  key: string
  value: string
}

// Collapses the per-part rows into the stored `color_spec` map, dropping blank
// part names. Pure so create and edit share one serialization path.
export function buildColorSpec(parts: ColorPart[]): Record<string, string> {
  const spec: Record<string, string> = {}
  for (const part of parts) {
    const key = part.key.trim()
    if (key !== '') spec[key] = part.value.trim()
  }
  return spec
}

// Expands a stored `color_spec` back into editable rows. Tolerates null, a
// non-object, or non-string values defensively; an empty spec yields one blank
// row so the operator always has somewhere to type.
export function colorPartsFromSpec(spec: unknown): ColorPart[] {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return [{ key: '', value: '' }]
  }
  const parts = Object.entries(spec as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => ({ key, value }))
  return parts.length > 0 ? parts : [{ key: '', value: '' }]
}

// --- order items (multi-item capture) ---------------------------------------

// One repeatable item row in the form. Numeric fields stay as strings for the
// same reason as OrderDraft's — an empty field isn't coerced to a number
// until submit/validation time.
export interface OrderItemDraft {
  productType: string
  description: string
  personalization: string
  quantity: string
  unitPrice: string
}

export function emptyItemDraft(): OrderItemDraft {
  return {
    productType: '',
    description: '',
    personalization: '',
    quantity: '1',
    unitPrice: '',
  }
}

// Positive-integer parsing for item quantity (distinct from parseMoney, which
// allows a fractional, non-negative amount).
export function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export interface BuiltOrderItem {
  product_type: string
  description: string
  personalization: string | null
  quantity: number
  unit_price: number | null
  line_total: number | null
  position: number
}

// Drops rows with no description (a row added, then left blank) and derives
// `line_total` as unit_price × quantity when a price is set. Zero surviving
// rows means "no items" — the caller falls back to the single-product fields
// untouched, so an abandoned "+ agregar ítem" tap never blocks submit.
export function buildOrderItems(drafts: OrderItemDraft[]): BuiltOrderItem[] {
  return drafts
    .filter((item) => item.description.trim() !== '')
    .map((item, index) => {
      const quantity = parseQuantity(item.quantity) ?? 1
      const unitPrice = parseMoney(item.unitPrice)
      return {
        product_type: item.productType || 'other',
        description: item.description.trim(),
        personalization: item.personalization.trim() || null,
        quantity,
        unit_price: unitPrice,
        line_total: unitPrice === null ? null : unitPrice * quantity,
        position: index,
      }
    })
}

// Sum of each item's line_total (unit_price × quantity), for items that carry
// a price. Null when no item has a price yet, so the caller can hide the
// suggestion instead of offering "$0.00". Mirrors resolvedPendingBalance's
// "derive a suggestion, never silently overwrite the stored field" pattern.
export function itemsSubtotal(items: BuiltOrderItem[]): number | null {
  const priced = items.filter((item) => item.line_total !== null)
  if (priced.length === 0) return null
  return priced.reduce((sum, item) => sum + (item.line_total ?? 0), 0)
}

// --- edit-mode prefill ------------------------------------------------------

// Maps a persisted order back into raw form state. Numeric columns become
// strings so the form renders them without coercing null to 0. `pending_balance`
// is copied verbatim from the stored row — the stored value is the source of
// truth and is never recomputed from total − deposit here.
export function draftFromOrder(order: OrderWithCustomer): OrderDraft {
  return {
    customerName: order.customers?.name ?? '',
    customerPhone: order.customers?.phone ?? '',
    productType: order.product_type,
    dueDate: order.due_date,
    totalAmount: order.total_amount === null ? '' : String(order.total_amount),
    deposit: order.deposit === null ? '' : String(order.deposit),
    pendingBalance:
      order.pending_balance === null ? '' : String(order.pending_balance),
    paymentMethod: order.payment_method ?? '',
    originChannel: order.origin_channel ?? '',
    referenceLink: order.reference_link ?? '',
    personalization: order.personalization ?? '',
    measurements: order.measurements ?? '',
    observations: order.observations ?? '',
  }
}

// --- quick capture (spreadsheet-speed order entry) ---------------------------

// Substring match on the free-text detail — catches singular and plural
// ("taza"/"tazas") in one keyword, same as a human skimming the same text
// would. Order matters only in that the first match wins; the three keywords
// are mutually exclusive words so that never comes up in practice.
const PRODUCT_TYPE_KEYWORDS: readonly (readonly [string, ProductType])[] = [
  ['taza', 'cup'],
  ['trofeo', 'trophy'],
  ['llavero', 'keychain'],
]

// Infers the required `orders.product_type` from the free-text detail typed
// in quick capture, so the operator never has to stop and pick a chip for the
// common cases. Falls back to 'other' — the same bucket the full form's chip
// picker offers for anything that doesn't fit the other three.
export function inferProductType(detail: string): ProductType {
  const lower = detail.toLowerCase()
  for (const [keyword, type] of PRODUCT_TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return type
  }
  return 'other'
}

// Raw state for the one-row/one-sheet quick-capture flow: six fields, no
// more — phone, payment method, colors, etc. are added later by editing the
// order, never blocking the initial capture. `detail` is free text; it seeds
// both the inferred product_type and (when non-blank) a single order_item.
// `productType` is optional; if not set, it's inferred from detail.
export interface QuickOrderDraft {
  customerName: string
  productType: string // optional product type, inferred from detail if blank
  detail: string
  dueDate: string // 'YYYY-MM-DD', pre-filled with the default lead time
  totalAmount: string // decimal or ''
  deposit: string // decimal or ''
  originChannel: string // '' or an OriginChannel
}

export type QuickOrderFieldErrors = Partial<Record<keyof QuickOrderDraft, string>>

export function emptyQuickOrderDraft(now: Date = new Date()): QuickOrderDraft {
  return {
    customerName: '',
    productType: '',
    detail: '',
    dueDate: defaultDueDate(now),
    totalAmount: '',
    deposit: '',
    originChannel: '',
  }
}

// Only the customer name blocks a save — matching the spreadsheet, where an
// incomplete row is still a row. The money checks below aren't "required
// field" friction, they reject combinations that can't be true (a deposit
// bigger than a total, or a deposit with no total to draw down).
export function validateQuickOrder(draft: QuickOrderDraft): QuickOrderFieldErrors {
  const errors: QuickOrderFieldErrors = {}

  if (draft.customerName.trim() === '') {
    errors.customerName = 'Ingresá el nombre del cliente.'
  }

  if (draft.dueDate !== '' && Number.isNaN(Date.parse(draft.dueDate))) {
    errors.dueDate = 'Ingresá una fecha de entrega válida.'
  }

  const total = parseMoney(draft.totalAmount)
  if (draft.totalAmount.trim() !== '' && total === null) {
    errors.totalAmount = 'Ingresá un monto válido (no negativo).'
  }

  const deposit = parseMoney(draft.deposit)
  if (draft.deposit.trim() !== '' && deposit === null) {
    errors.deposit = 'Ingresá una seña válida (no negativa).'
  }

  if (deposit !== null && total === null) {
    errors.deposit = 'Ingresá el monto total antes de la seña.'
  } else if (deposit !== null && total !== null && deposit > total) {
    errors.deposit = 'La seña no puede superar el monto total.'
  }

  if (
    draft.originChannel !== '' &&
    !includes(draft.originChannel, ORIGIN_CHANNEL)
  ) {
    errors.originChannel = 'Elegí un canal de origen válido.'
  }

  return errors
}

// total − deposit (nulls treated as 0), or null when neither is set. Unlike
// the full form's resolvedPendingBalance, quick capture has no explicit
// override field — there's nowhere in a 5-field row to put one.
export function quickOrderPendingBalance(draft: QuickOrderDraft): number | null {
  const total = parseMoney(draft.totalAmount)
  const deposit = parseMoney(draft.deposit)
  if (total === null && deposit === null) return null
  return (total ?? 0) - (deposit ?? 0)
}

// Builds the single order_item quick capture writes (via replaceOrderItems),
// carrying the operator's exact words forward instead of collapsing them into
// just the inferred category. Null on a blank detail — nothing to attach, the
// order is created from its own fields alone.
export function quickOrderItem(detail: string): BuiltOrderItem | null {
  const description = detail.trim()
  if (description === '') return null
  return {
    product_type: inferProductType(description),
    description,
    personalization: null,
    quantity: 1,
    unit_price: null,
    line_total: null,
    position: 0,
  }
}

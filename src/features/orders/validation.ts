// Pure, dependency-free validation and smart-default logic for the order form.
// Kept out of the React component so the form and the unit tests share one
// source of truth. No DB, no DOM — every function is deterministic.

import {
  ORIGIN_CHANNEL,
  PAYMENT_METHOD,
  PRODUCT_TYPE,
} from '@/lib/domain-constants'

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
    errors.customerName = 'Enter the customer name.'
  }

  if (!includes(draft.productType, PRODUCT_TYPE)) {
    errors.productType = 'Choose a product type.'
  }

  if (draft.dueDate === '') {
    errors.dueDate = 'Choose a due date.'
  } else if (Number.isNaN(Date.parse(draft.dueDate))) {
    errors.dueDate = 'Enter a valid due date.'
  }

  const total = parseMoney(draft.totalAmount)
  if (draft.totalAmount.trim() !== '' && total === null) {
    errors.totalAmount = 'Enter a valid, non-negative amount.'
  }

  const deposit = parseMoney(draft.deposit)
  if (draft.deposit.trim() !== '' && deposit === null) {
    errors.deposit = 'Enter a valid, non-negative deposit.'
  }

  if (deposit !== null && total === null) {
    errors.deposit = 'Enter a total amount before a deposit.'
  } else if (deposit !== null && total !== null && deposit > total) {
    errors.deposit = 'Deposit cannot exceed the total amount.'
  }

  if (
    draft.pendingBalance.trim() !== '' &&
    parseMoney(draft.pendingBalance) === null
  ) {
    errors.pendingBalance = 'Enter a valid, non-negative balance.'
  }

  if (
    draft.paymentMethod !== '' &&
    !includes(draft.paymentMethod, PAYMENT_METHOD)
  ) {
    errors.paymentMethod = 'Choose a valid payment method.'
  }

  if (
    draft.originChannel !== '' &&
    !includes(draft.originChannel, ORIGIN_CHANNEL)
  ) {
    errors.originChannel = 'Choose a valid origin.'
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
    personalization: '',
    measurements: '',
    observations: '',
  }
}

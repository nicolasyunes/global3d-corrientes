import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/domain-constants'
import type { Database } from '@/lib/database.types'
import { parseMoney } from './orderDraft'

export type PaymentRow = Database['public']['Tables']['transactions']['Row']
export type PaymentKind = 'deposit' | 'balance' | 'full'

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: 'Seña',
  balance: 'Saldo',
  full: 'Pago total',
}

// Same rule as register_order_payment in the database.
export function paymentKindFor(
  total: number,
  alreadyPaid: number,
  amount: number,
): PaymentKind {
  if (alreadyPaid === 0 && amount >= total) return 'full'
  if (alreadyPaid === 0) return 'deposit'
  return 'balance'
}

export function activePayments(rows: readonly PaymentRow[]): PaymentRow[] {
  return rows.filter((r) => r.voided_at === null)
}

export function paidTotal(rows: readonly PaymentRow[]): number {
  return activePayments(rows).reduce((sum, r) => sum + r.amount, 0)
}

export function methodLabel(method: string | null): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? 'Sin medio'
}

export function validatePayment({
  amount,
  method,
  balance,
}: {
  amount: string
  method: PaymentMethod | null
  balance: number
}): string | null {
  const value = parseMoney(amount)
  if (value === null || value === 0) return 'Escribí el monto que pagó.'
  if (Number.isNaN(value) || value < 0) return 'Revisá el monto.'
  if (!method) return 'Elegí cómo pagó.'
  if (value > balance) return 'El cobro supera el saldo.'
  return null
}

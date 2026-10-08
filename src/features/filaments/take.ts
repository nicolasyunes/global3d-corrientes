import { money } from './filaments'

// Why a spool leaves (or, for an admin adjust, enters) the shelf.
export type TakeReason = 'sale' | 'used' | 'transfer' | 'personal' | 'adjust'
export type Payment = 'cash' | 'transfer'

export const TAKE_REASONS: {
  value: TakeReason
  label: string
  adminOnly?: boolean
}[] = [
  { value: 'sale', label: 'Venta' },
  { value: 'used', label: 'A producción' },
  { value: 'transfer', label: 'A la otra sede' },
  { value: 'personal', label: 'Uso personal' },
  { value: 'adjust', label: 'Ajuste', adminOnly: true },
]

export const PAYMENT_LABEL: Record<Payment, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia MP',
}

export interface TakeDraft {
  reason: TakeReason
  qty: number
  payment: Payment | null
  customer: string
  note: string
}

export function emptyTake(reason: TakeReason): TakeDraft {
  return { reason, qty: 1, payment: null, customer: '', note: '' }
}

// `available` is Infinity when adding stock; `price` is the list price.
export function takeError(
  d: TakeDraft,
  available: number,
  price: number | null,
): string | null {
  if (!Number.isInteger(d.qty) || d.qty < 1)
    return 'La cantidad tiene que ser 1 o más.'
  if (d.qty > available)
    return available === 0
      ? 'No hay stock de este color.'
      : `Solo quedan ${available}.`
  if (d.reason === 'sale') {
    if (price == null)
      return 'Este filamento no tiene precio de lista. Pedile al admin que lo cargue.'
    if (!d.payment) return 'Elegí cómo te pagaron.'
  }
  if ((d.reason === 'personal' || d.reason === 'adjust') && d.note.trim() === '')
    return 'Escribí el motivo.'
  return null
}

const LABEL = Object.fromEntries(TAKE_REASONS.map((r) => [r.value, r.label]))

export function takeToast(
  d: TakeDraft,
  colorLabel: string,
  price: number | null,
): string {
  const base = `${LABEL[d.reason]} · ${d.qty} × ${colorLabel}`
  if (d.reason !== 'sale' || price == null || !d.payment) return base
  const how = d.payment === 'cash' ? 'efectivo' : 'transferencia MP'
  return `${base} · ${money(price * d.qty)} ${how}`
}

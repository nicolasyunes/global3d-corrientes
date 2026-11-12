import { money } from './filaments'

// Why a spool leaves (or, for an admin adjust, enters) the shelf.
export type TakeReason = 'sale' | 'used' | 'transfer' | 'personal' | 'adjust'
export type Payment = 'cash' | 'transfer' | 'mixed'

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
  mixed: 'Mixto',
}

/** Cuánto de una venta entró en efectivo y cuánto por transferencia. */
export function paymentSplit(sale: {
  payment: string
  total: number | null
  cash_amount?: number | null
}): { cash: number; transfer: number } {
  const total = Number(sale.total ?? 0)
  if (sale.payment === 'cash') return { cash: total, transfer: 0 }
  if (sale.payment === 'mixed') {
    const cash = Number(sale.cash_amount ?? 0)
    return { cash, transfer: total - cash }
  }
  return { cash: 0, transfer: total }
}

/** "Efectivo", "Transferencia MP" o "Mixto: $X efectivo + $Y transf.". */
export function paymentText(sale: {
  payment: string
  total: number | null
  cash_amount?: number | null
}): string {
  if (sale.payment !== 'mixed')
    return PAYMENT_LABEL[sale.payment as Payment] ?? sale.payment
  const { cash, transfer } = paymentSplit(sale)
  return `Mixto: ${money(cash)} efectivo + ${money(transfer)} transf.`
}

// "20.000", "20000" o "20000,50" → 20000 / 20000.5; null si no es un monto.
export function parseAmount(text: string): number | null {
  const clean = text.replace(/[$\s.]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Number(clean)
}

export interface TakeDraft {
  reason: TakeReason
  qty: number
  payment: Payment | null
  /** Pago mixto: lo que entró en efectivo, tal como se escribió. */
  cash: string
  customer: string
  note: string
}

export function emptyTake(reason: TakeReason): TakeDraft {
  return { reason, qty: 1, payment: null, cash: '', customer: '', note: '' }
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
    if (d.payment === 'mixed') {
      const cash = parseAmount(d.cash)
      if (cash == null || cash <= 0) return 'Escribí cuánto te dieron en efectivo.'
      if (cash >= price * d.qty)
        return `El efectivo tiene que ser menos que el total (${money(price * d.qty)}).`
    }
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
  const total = price * d.qty
  if (d.payment === 'mixed') {
    const cash = parseAmount(d.cash) ?? 0
    return `${base} · ${money(cash)} efectivo + ${money(total - cash)} transferencia MP`
  }
  const how = d.payment === 'cash' ? 'efectivo' : 'transferencia MP'
  return `${base} · ${money(total)} ${how}`
}

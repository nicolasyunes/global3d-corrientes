import { parseMoney } from '@/features/orders/orderDraft'
import type { OriginChannel, PaymentMethod } from '@/lib/domain-constants'

// Pure ticket math for "Nueva venta". Inputs stay as typed text; everything
// numeric goes through parseMoney so "13.200" means 13200.

export interface TicketLine {
  key: string
  productId: string | null
  description: string
  quantity: string
  listUnitPrice: number
  unitPrice: string
}
export type DiscountMode = 'amount' | 'percent'
export interface TicketDraft {
  lines: TicketLine[]
  discountMode: DiscountMode
  discount: string
  method: PaymentMethod | null
  channel: OriginChannel
  customerId: string | null
  note: string
}
export interface TicketTotals {
  listTotal: number
  subtotal: number
  discount: number
  amount: number
}
export interface SalePayload {
  channel: OriginChannel | null
  customer_id: string | null
  method: PaymentMethod | null
  discount: number
  note: string | null
  items: {
    product_id: string | null
    description: string
    quantity: number
    list_unit_price: number
    unit_price: number
  }[]
}

let seq = 0
const nextKey = () => `l${++seq}`

export function emptyTicket(): TicketDraft {
  return {
    lines: [],
    discountMode: 'amount',
    discount: '',
    method: null,
    channel: 'local',
    customerId: null,
    note: '',
  }
}

export function lineFromProduct(p: {
  id: string
  name: string
  base_price: number | null
}): TicketLine {
  const price = p.base_price ?? 0
  return {
    key: nextKey(),
    productId: p.id,
    description: p.name,
    quantity: '1',
    listUnitPrice: price,
    unitPrice: String(price),
  }
}

export function freeLine(description: string): TicketLine {
  return {
    key: nextKey(),
    productId: null,
    description: description.trim(),
    quantity: '1',
    listUnitPrice: 0,
    unitPrice: '',
  }
}

export function lineQty(l: TicketLine): number {
  const n = Number(l.quantity.trim())
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function lineUnitPrice(l: TicketLine): number {
  const n = parseMoney(l.unitPrice)
  return n == null || Number.isNaN(n) || n < 0 ? Number.NaN : n
}

// A free-text line has no catalog price: its list price is what was charged.
function listUnit(l: TicketLine): number {
  return l.productId ? l.listUnitPrice : lineUnitPrice(l)
}

function discountAmount(d: TicketDraft, subtotal: number): number {
  const raw =
    d.discountMode === 'percent'
      ? Number(d.discount.replace(',', '.'))
      : parseMoney(d.discount)
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 0
  return d.discountMode === 'percent' ? Math.round((subtotal * raw) / 100) : raw
}

export function ticketTotals(d: TicketDraft): TicketTotals {
  let listTotal = 0
  let subtotal = 0
  for (const l of d.lines) {
    const q = lineQty(l)
    const u = lineUnitPrice(l)
    if (!q || Number.isNaN(u)) continue
    listTotal += q * listUnit(l)
    subtotal += q * u
  }
  const discount = discountAmount(d, subtotal)
  return { listTotal, subtotal, discount, amount: subtotal - discount }
}

export function ticketErrors(d: TicketDraft): string[] {
  const errs: string[] = []
  if (d.lines.length === 0) errs.push('Agregá al menos un producto')
  for (const l of d.lines) {
    if (!lineQty(l)) errs.push(`Revisá la cantidad de ${l.description}`)
    if (Number.isNaN(lineUnitPrice(l)))
      errs.push(`Revisá el precio de ${l.description}`)
  }
  if (!d.method) errs.push('Elegí el medio de pago')
  const t = ticketTotals(d)
  if (t.amount < 0) errs.push('El descuento es mayor que el total')
  return errs
}

export function toPayload(d: TicketDraft): SalePayload {
  const t = ticketTotals(d)
  return {
    channel: d.channel,
    customer_id: d.customerId,
    method: d.method,
    discount: t.discount,
    note: d.note.trim() || null,
    items: d.lines.map((l) => ({
      product_id: l.productId,
      description: l.description,
      quantity: lineQty(l),
      list_unit_price: listUnit(l),
      unit_price: lineUnitPrice(l),
    })),
  }
}

import { toISODate } from '@/features/orders/validation'
import { ORIGIN_CHANNEL_LABELS, type OriginChannel } from '@/lib/domain-constants'
import { inRange, type Range } from './stats'

export { pctChange } from './stats'

// What the Resumen needs of an order; `quantity` is the sum of its items.
export interface SummaryOrder {
  id: string
  customer_id: string
  created_at: string
  due_date: string
  status: string
  total_amount: number | null
  pending_balance: number | null
  flexible: boolean
  origin_channel: string | null
  quantity: number
}

// Money that came in: an order payment, a direct product sale or a spool sale.
export interface SummaryPayment {
  id: string
  amount: number
  method: string | null
  at: string
  source: 'order' | 'direct' | 'filament'
}

const live = (o: SummaryOrder) => o.status !== 'cancelled'

export function sold(orders: readonly SummaryOrder[], range: Range) {
  let amount = 0
  let count = 0
  let units = 0
  let withAmount = 0
  for (const o of orders) {
    if (!live(o) || !inRange(o.created_at, range)) continue
    count++
    units += o.quantity
    if (o.total_amount != null) {
      amount += o.total_amount
      withAmount++
    }
  }
  return { amount, orders: count, units, withAmount, withoutAmount: count - withAmount }
}

export function ticketAverage(s: ReturnType<typeof sold>): number | null {
  return s.withAmount > 0 ? s.amount / s.withAmount : null
}

export function collected(payments: readonly SummaryPayment[], range: Range) {
  const out = { total: 0, count: 0, orders: 0, direct: 0, filament: 0 }
  for (const p of payments) {
    if (!inRange(p.at, range)) continue
    out.total += p.amount
    out.count++
    if (p.source === 'order') out.orders += p.amount
    else if (p.source === 'direct') out.direct += p.amount
    else out.filament += p.amount
  }
  return out
}

// A snapshot of today. Orders loaded before the cut keep an unconfirmed
// balance (the spreadsheet never said if it was paid): counted apart.
export function receivable(orders: readonly SummaryOrder[], cutoff: Date) {
  const out = { amount: 0, orders: 0, legacyOrders: 0, legacyAmount: 0 }
  for (const o of orders) {
    const balance = o.pending_balance ?? 0
    if (!live(o) || balance <= 0) continue
    if (new Date(o.created_at).getTime() >= cutoff.getTime()) {
      out.amount += balance
      out.orders++
    } else {
      out.legacyAmount += balance
      out.legacyOrders++
    }
  }
  return out
}

// Delivered in the period (by the real delivery event), not "sin apuro".
export function onTimeRate(
  orders: readonly SummaryOrder[],
  deliveredAt: ReadonlyMap<string, string>,
  range: Range,
) {
  let total = 0
  let late = 0
  for (const o of orders) {
    const at = deliveredAt.get(o.id)
    if (!at || !live(o) || o.flexible || !inRange(at, range)) continue
    total++
    if (toISODate(new Date(at)) > o.due_date) late++
  }
  return { total, late, rate: total > 0 ? Math.round(((total - late) / total) * 100) : null }
}

// New = the customer's first (non-cancelled) order falls in the period.
export function newCustomers(orders: readonly SummaryOrder[], range: Range) {
  const first = new Map<string, number>()
  for (const o of orders) {
    if (!live(o)) continue
    const t = new Date(o.created_at).getTime()
    const prev = first.get(o.customer_id)
    if (prev === undefined || t < prev) first.set(o.customer_id, t)
  }
  let fresh = 0
  let total = 0
  for (const t of first.values()) {
    if (t < range.to.getTime()) total++
    if (t >= range.from.getTime() && t < range.to.getTime()) fresh++
  }
  return { fresh, total }
}

export interface WeekBar {
  start: Date
  label: string
  count: number
  partial: boolean
}

function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
}

// `weeks` Monday-to-Sunday weeks ending in the week of the period's last day
// (or today if the period is still open).
export function ordersByWeek(
  orders: readonly SummaryOrder[],
  range: Range,
  now: Date,
  weeks = 8,
): WeekBar[] {
  const lastMoment = new Date(Math.min(range.to.getTime() - 1, now.getTime()))
  const last = mondayOf(lastMoment)
  const bars: WeekBar[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(last.getFullYear(), last.getMonth(), last.getDate() - 7 * i)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    const count = orders.filter(
      (o) => live(o) && inRange(o.created_at, { from: start, to: end }),
    ).length
    bars.push({
      start,
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      count,
      partial: end.getTime() > now.getTime(),
    })
  }
  return bars
}

export interface ShareRow {
  key: string
  label: string
  value: number
  pct: number
}

function shares(map: Map<string, ShareRow>): ShareRow[] {
  const rows = [...map.values()]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return rows
    .map((r) => ({ ...r, pct: total > 0 ? Math.round((r.value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export function byChannel(orders: readonly SummaryOrder[], range: Range): ShareRow[] {
  const map = new Map<string, ShareRow>()
  for (const o of orders) {
    if (!live(o) || !inRange(o.created_at, range)) continue
    const raw = o.origin_channel
    const key = raw === 'whatsapp' || raw === 'whatsapp_personal' ? 'whatsapp' : (raw ?? 'none')
    const label =
      key === 'whatsapp'
        ? 'WhatsApp'
        : key === 'none'
          ? 'Sin canal'
          : (ORIGIN_CHANNEL_LABELS[key as OriginChannel] ?? 'Otro')
    const row = map.get(key) ?? { key, label, value: 0, pct: 0 }
    row.value++
    map.set(key, row)
  }
  return shares(map)
}

const METHOD_GROUP: Record<string, { key: string; label: string }> = {
  cash: { key: 'cash', label: 'Efectivo' },
  transfer: { key: 'transfer', label: 'Transferencia' },
  mercadopago: { key: 'mercadopago', label: 'Mercado Pago' },
}

export function collectedByMethod(payments: readonly SummaryPayment[], range: Range): ShareRow[] {
  const map = new Map<string, ShareRow>()
  for (const p of payments) {
    if (!inRange(p.at, range)) continue
    const group =
      p.method === null
        ? { key: 'none', label: 'Sin medio' }
        : (METHOD_GROUP[p.method] ?? { key: 'other', label: 'Otros' })
    const row = map.get(group.key) ?? { ...group, value: 0, pct: 0 }
    row.value += p.amount
    map.set(group.key, row)
  }
  return shares(map)
}

export function pointsDiff(curr: number | null, prev: number | null): number | null {
  return curr === null || prev === null ? null : curr - prev
}

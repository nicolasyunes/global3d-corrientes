import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import {
  orderToVentaRow,
  productSaleToVentaRow,
} from '@/features/orders/deliveredOrders'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import type { ProductSaleRow } from '@/features/orders/productSales.api'

export type PeriodKind = 'today' | 'week' | 'month' | 'custom'

// Half-open interval [from, to) in local time.
export interface Range {
  from: Date
  to: Date
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// 'YYYY-MM-DD' → local midnight (Date parses bare dates as UTC).
function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function periodRange(
  kind: PeriodKind,
  now: Date,
  custom?: { from: string; to: string },
): Range {
  const today = startOfDay(now)
  if (kind === 'today') return { from: today, to: addDays(today, 1) }
  if (kind === 'week') {
    // Monday-based: getDay() is 0 on Sunday.
    const from = addDays(today, -((today.getDay() + 6) % 7))
    return { from, to: addDays(from, 7) }
  }
  if (kind === 'month') {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 1),
    }
  }
  const from = custom ? parseDay(custom.from) : today
  const to = custom ? addDays(parseDay(custom.to), 1) : addDays(today, 1)
  return { from, to }
}

export function previousRange(kind: PeriodKind, r: Range): Range {
  if (kind === 'month') {
    return {
      from: new Date(r.from.getFullYear(), r.from.getMonth() - 1, 1),
      to: r.from,
    }
  }
  const days = Math.round((r.to.getTime() - r.from.getTime()) / DAY)
  return { from: addDays(r.from, -days), to: r.from }
}

function toDate(stamp: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? parseDay(stamp) : new Date(stamp)
}

export function inRange(stamp: string, r: Range): boolean {
  const t = toDate(stamp).getTime()
  return t >= r.from.getTime() && t < r.to.getTime()
}

export interface DeliveredRow {
  id: string
  kind: 'order' | 'product'
  // ISO timestamp when `exact`, otherwise the promised 'YYYY-MM-DD'.
  at: string
  exact: boolean
  customerName: string | null
  productLabel: string
  amount: number | null
  method: 'cash' | 'transfer' | null
  href: string | null
}

// Orders count on the day they really moved to "Entregado" when that was
// recorded; older ones fall back to their promised date.
export function toDeliveredRows(
  orders: readonly OrderWithCustomer[],
  productSales: readonly ProductSaleRow[],
  deliveredAt: ReadonlyMap<string, string>,
): DeliveredRow[] {
  const rows: DeliveredRow[] = [
    ...orders.map((o): DeliveredRow => {
      const v = orderToVentaRow(o)
      const at = deliveredAt.get(o.id)
      return {
        id: v.id,
        kind: 'order',
        at: at ?? o.due_date,
        exact: at != null,
        customerName: v.customerName,
        productLabel: v.productLabel,
        amount: v.amount,
        method: null,
        href: v.href,
      }
    }),
    ...productSales.map((s): DeliveredRow => {
      const v = productSaleToVentaRow(s)
      const method = s.method === 'cash' || s.method === 'transfer' ? s.method : null
      return {
        id: v.id,
        kind: 'product',
        at: s.transacted_at,
        exact: true,
        customerName: v.customerName,
        productLabel: v.productLabel,
        amount: v.amount,
        method,
        href: null,
      }
    }),
  ]
  return rows.sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime())
}

export function salesSummary(sales: readonly FilamentSale[]) {
  const s = { count: 0, units: 0, total: 0, cash: 0, transfer: 0, voided: 0 }
  for (const x of sales) {
    if (x.voided_at) {
      s.voided++
      continue
    }
    s.count++
    s.units += x.quantity
    s.total += x.total ?? 0
    if (x.payment === 'cash') s.cash += x.total ?? 0
    else s.transfer += x.total ?? 0
  }
  return s
}

export function deliveredSummary(rows: readonly DeliveredRow[]) {
  const s = { orders: 0, ordersAmount: 0, direct: 0, directAmount: 0, cash: 0, transfer: 0 }
  for (const r of rows) {
    const amount = r.amount ?? 0
    if (r.kind === 'order') {
      s.orders++
      s.ordersAmount += amount
    } else {
      s.direct++
      s.directAmount += amount
    }
    if (r.method === 'cash') s.cash += amount
    if (r.method === 'transfer') s.transfer += amount
  }
  return s
}

export type ExitReason = 'used' | 'transfer' | 'personal' | 'adjust' | 'count'
const EXIT_REASONS: readonly ExitReason[] = ['used', 'transfer', 'personal', 'adjust', 'count']

// Spools out per reason; adjustments and counts report the net (absolute).
export function exitsByReason(
  log: readonly FilamentLogRow[],
): Record<ExitReason, { moves: number; units: number }> {
  const out = Object.fromEntries(
    EXIT_REASONS.map((k) => [k, { moves: 0, units: 0, net: 0 }]),
  ) as Record<ExitReason, { moves: number; units: number; net: number }>
  for (const r of log) {
    const k = r.kind as ExitReason
    if (!EXIT_REASONS.includes(k)) continue
    out[k].moves++
    out[k].net += r.delta ?? 0
  }
  return Object.fromEntries(
    EXIT_REASONS.map((k) => [k, { moves: out[k].moves, units: Math.abs(out[k].net) }]),
  ) as Record<ExitReason, { moves: number; units: number }>
}

export interface PersonRow {
  operatorId: string | null
  sale: number
  used: number
  transfer: number
  personal: number
  adjust: number
}

const PERSON_KINDS = ['sale', 'used', 'transfer', 'personal', 'adjust'] as const

// Spools each person moved, by reason (adjustments as net absolute).
export function exitsByPerson(log: readonly FilamentLogRow[]): PersonRow[] {
  const byOp = new Map<string | null, PersonRow>()
  for (const r of log) {
    const k = r.kind as (typeof PERSON_KINDS)[number]
    if (!PERSON_KINDS.includes(k)) continue
    const row =
      byOp.get(r.operator_id) ??
      { operatorId: r.operator_id, sale: 0, used: 0, transfer: 0, personal: 0, adjust: 0 }
    // Adjustments accumulate signed (net); other reasons are plain exits.
    row[k] += k === 'adjust' ? (r.delta ?? 0) : Math.abs(r.delta ?? 0)
    byOp.set(r.operator_id, row)
  }
  for (const row of byOp.values()) row.adjust = Math.abs(row.adjust)
  const total = (p: PersonRow) => p.sale + p.used + p.transfer + p.personal + p.adjust
  return [...byOp.values()].sort((a, b) => total(b) - total(a))
}

export function topColors(sales: readonly FilamentSale[], n = 5) {
  const map = new Map<string, { label: string; units: number; total: number }>()
  for (const s of sales) {
    if (s.voided_at) continue
    const label = `${s.color_label} · ${s.line_label}`
    const row = map.get(label) ?? { label, units: 0, total: 0 }
    row.units += s.quantity
    row.total += s.total ?? 0
    map.set(label, row)
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.total - a.total).slice(0, n)
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

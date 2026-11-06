import type { OriginChannel, PaymentMethod } from '@/lib/domain-constants'
import type { SaleLogRow, SaleWithRefs } from './sales.api'

export interface SaleFilters {
  channel: OriginChannel | 'all' | 'none'
  method: PaymentMethod | 'all'
  wholesale: boolean
  operatorId: string | 'all'
  showVoided: boolean
}

export const DEFAULT_FILTERS: SaleFilters = {
  channel: 'all',
  method: 'all',
  wholesale: false,
  operatorId: 'all',
  showVoided: false,
}

export function filterSales(
  rows: readonly SaleWithRefs[],
  f: SaleFilters,
): SaleWithRefs[] {
  return rows.filter((r) => {
    if (!f.showVoided && r.voided_at) return false
    if (f.channel === 'none' && r.channel != null) return false
    if (f.channel !== 'all' && f.channel !== 'none' && r.channel !== f.channel)
      return false
    if (f.method !== 'all' && r.method !== f.method) return false
    if (f.wholesale && !r.customers?.wholesale) return false
    if (f.operatorId !== 'all' && r.operator_id !== f.operatorId) return false
    return true
  })
}

// Voided rows can be listed but never count.
export function salesTotals(rows: readonly SaleWithRefs[]) {
  const t = { amount: 0, count: 0, discounts: 0 }
  for (const r of rows) {
    if (r.voided_at) continue
    t.count++
    t.amount += Number(r.amount)
    t.discounts += Math.max(0, Number(r.list_total) - Number(r.amount))
  }
  return t
}

export function itemsSummary(
  items: readonly { description: string; quantity: number; position: number }[],
): string {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return '—'
  const first = `${sorted[0].description}${sorted[0].quantity > 1 ? ` ×${sorted[0].quantity}` : ''}`
  return sorted.length > 1 ? `${first} + ${sorted.length - 1} más` : first
}

const KIND_LABEL: Record<string, string> = {
  created: 'Creada',
  edited: 'Corregida',
  voided: 'Anulada',
  restored: 'Reactivada',
}

export function logLabel(
  row: SaleLogRow,
  operatorName: (id: string | null) => string,
): string {
  const base = `${KIND_LABEL[row.kind] ?? row.kind} por ${operatorName(row.operator_id)}`
  return row.reason ? `${base}: ${row.reason}` : base
}

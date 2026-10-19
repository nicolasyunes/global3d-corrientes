import { logDayKey, logDayLabel } from '@/features/filaments/filaments'
import type { ProductLogKind, ProductLogRow } from './products.api'

export type MovementFilter = 'all' | 'in' | 'out' | 'other'

// Cómo se lee cada tipo en el registro.
export const KIND_TEXT: Record<ProductLogKind, string> = {
  created: 'Producto nuevo',
  in: 'Entró stock',
  out: 'Salió stock',
  adjust: 'Corrección',
  sale: 'Venta directa',
  edited: 'Cambio en la ficha',
}

// "Entran" suma stock, "Salen" lo resta; lo demás (altas, ediciones) va aparte.
export function movementGroup(
  row: ProductLogRow,
): Exclude<MovementFilter, 'all'> {
  if (row.kind === 'created' || row.kind === 'edited') return 'other'
  if (row.kind === 'sale' || row.kind === 'out') return 'out'
  if (row.kind === 'in') return 'in'
  return (row.delta ?? 0) >= 0 ? 'in' : 'out'
}

export function filterMovements(
  rows: readonly ProductLogRow[],
  {
    kind,
    person,
    query,
  }: { kind: MovementFilter; person: string; query: string },
): ProductLogRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (kind !== 'all' && movementGroup(r) !== kind) return false
    if (person !== 'all' && r.operator_id !== person) return false
    if (q && !`${r.product_label} ${r.note ?? ''}`.toLowerCase().includes(q))
      return false
    return true
  })
}

export interface MovementDay {
  key: string
  label: string
  rows: ProductLogRow[]
}

// Agrupa por día manteniendo el orden (más nuevo primero).
export function groupByDay(rows: readonly ProductLogRow[]): MovementDay[] {
  const days: MovementDay[] = []
  for (const r of rows) {
    const key = logDayKey(r.created_at)
    const last = days[days.length - 1]
    if (last?.key === key) last.rows.push(r)
    else days.push({ key, label: logDayLabel(r.created_at), rows: [r] })
  }
  return days
}

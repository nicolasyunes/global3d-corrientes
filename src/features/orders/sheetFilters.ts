import type { PendingSheetOrder } from './pendingSheet.api'

// Client-side filters for the "Planilla" tab. Unlike list.ts's filterOrders
// (which works on the app's own `orders` rows), these run over the
// sheet-sourced PendingSheetOrder shape — a separate data source read from
// the "Pedidos" Google Sheet. Kept pure so the view and the unit tests
// exercise the exact same logic.

export type SheetEstado = 'pendiente' | 'listo' | 'entregado' | 'cancelado'

export interface SheetFilters {
  month: string // 'YYYY-MM' taken from the delivery date; '' = any month
  estado: SheetEstado | '' // '' = any estado
}

export function emptySheetFilters(): SheetFilters {
  return { month: '', estado: '' }
}

// A blank/whitespace ESTADO cell reads as "pendiente" — the same rule the
// Planilla's semaphore already uses (see getSheetSemaphore). Anything the
// sheet types that isn't one of the three terminal states is treated as
// pendiente too, so the filter never silently drops a row.
export function normalizeEstado(raw: string): SheetEstado {
  const estado = raw.trim().toLowerCase()
  if (estado === 'listo' || estado === 'entregado' || estado === 'cancelado') {
    return estado
  }
  return 'pendiente'
}

// 'YYYY-MM' of a row's delivery date, or '' when it has no parseable date
// (fechaEntregaSortKey is '9999-99-99' in that case — see dateSortKey in
// read-pending-orders/parse.ts).
export function sheetOrderMonth(order: PendingSheetOrder): string {
  const key = order.fechaEntregaSortKey
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key === '9999-99-99') return ''
  return key.slice(0, 7)
}

export function filterSheetOrders(
  orders: readonly PendingSheetOrder[],
  filters: SheetFilters,
): PendingSheetOrder[] {
  return orders.filter((order) => {
    if (filters.month && sheetOrderMonth(order) !== filters.month) return false
    if (filters.estado && normalizeEstado(order.estado) !== filters.estado)
      return false
    return true
  })
}

// The distinct 'YYYY-MM' present across the given rows, newest first — feeds
// the month <select> so it only ever offers months that actually have orders.
export function availableMonths(orders: readonly PendingSheetOrder[]): string[] {
  const months = new Set<string>()
  for (const order of orders) {
    const month = sheetOrderMonth(order)
    if (month) months.add(month)
  }
  return [...months].sort((a, b) => b.localeCompare(a))
}

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// 'YYYY-MM' -> 'Agosto 2026' for the <select> option labels.
export function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/)
  if (!match) return month
  const [, year, mm] = match
  const name = MONTH_NAMES_ES[Number(mm) - 1]
  if (!name) return month
  return `${name[0].toUpperCase()}${name.slice(1)} ${year}`
}

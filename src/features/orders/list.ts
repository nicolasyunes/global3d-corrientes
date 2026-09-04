import type { OrderSemaphore, OrderStatus } from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'

export type ListTab = 'pending' | 'upcoming'

export interface OrderPartition {
  pending: OrderWithCustomer[]
  upcoming: OrderWithCustomer[]
}

// Adds `days` (may be negative) to an ISO 'YYYY-MM-DD' date string, done in
// UTC so the arithmetic never shifts across a local-timezone DST boundary.
export function addDaysISO(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day))
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

// The single source of truth for shaping the landing list: drop cancelled,
// finished and delivered orders (nothing left to do on them — a delivered
// order lives only in Ventas de Pedidos from here on), sort by order_date
// descending — the most recently anotated order first, tiebroken by
// created_at — then split into "pending" (every active order, the full
// open-work queue) and "upcoming" (the same active set narrowed to a
// due_date within the next 7 days, so it reads as "what's landing soon"
// without re-sorting by urgency). Kept pure so the view and the unit tests
// exercise the exact same filtering/ordering logic.
const INACTIVE_STATUSES: readonly OrderStatus[] = [
  'cancelled',
  'finished',
  'delivered',
]

export function shapeOrders(
  orders: readonly OrderWithCustomer[],
  today: string,
): OrderPartition {
  const active = orders
    .filter((order) => !INACTIVE_STATUSES.includes(order.status))
    .sort(
      (a, b) =>
        b.order_date.localeCompare(a.order_date) ||
        b.created_at.localeCompare(a.created_at),
    )

  const horizon = addDaysISO(today, 7)

  return {
    pending: active,
    upcoming: active.filter(
      (order) => order.due_date >= today && order.due_date <= horizon,
    ),
  }
}

// Client-side filters for the Pendientes/Próximos tables — applied on top of
// the already-partitioned `pending`/`upcoming` rows, never on the Planilla
// tab (a different data source/shape with its own read-only card view).
export interface OrderFilters {
  dueFrom: string // '' = no lower bound
  dueTo: string // '' = no upper bound
  productType: string // '' = any ProductType
  customerSearch: string // '' = any
}

export function emptyFilters(): OrderFilters {
  return { dueFrom: '', dueTo: '', productType: '', customerSearch: '' }
}

export function filterOrders(
  orders: readonly OrderWithCustomer[],
  filters: OrderFilters,
): OrderWithCustomer[] {
  const search = filters.customerSearch.trim().toLowerCase()
  return orders.filter((order) => {
    if (filters.dueFrom && order.due_date < filters.dueFrom) return false
    if (filters.dueTo && order.due_date > filters.dueTo) return false
    if (filters.productType && order.product_type !== filters.productType)
      return false
    if (
      search &&
      !(order.customers?.name ?? '').toLowerCase().includes(search)
    )
      return false
    return true
  })
}

// Within the "today" bucket, an order already past its due_date reads
// differently from one due exactly today — surfaced as urgency color, never
// a new badge or icon, so the existing scan pattern (customer → due → status)
// stays unchanged.
export function isOverdue(order: OrderWithCustomer, today: string): boolean {
  return order.due_date < today
}

// How many days remain until due_date (negative once overdue). Pure date-math
// on the ISO strings, no Date arithmetic needed since both are 'YYYY-MM-DD'.
function daysUntil(dueDate: string, today: string): number {
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = dueDate.split('-').map(Number)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / msPerDay,
  )
}

// The delivery semaphore shown in Pendientes/Próximos and the Planilla tab:
// status always wins over date-based urgency (a delivered/ready order reads
// calm even if its due_date was close), so this is checked in strict order —
// delivered > ready > urgent (due_date within 3 days, overdue included) > ok.
export function getOrderSemaphore(
  order: Pick<OrderWithCustomer, 'status' | 'due_date'>,
  today: string,
): OrderSemaphore {
  if (order.status === 'delivered') return 'delivered'
  if (order.status === 'finished') return 'ready'
  if (daysUntil(order.due_date, today) <= 3) return 'urgent'
  return 'ok'
}

// Groups every order (cancelled included — the board shows the full
// lifecycle) into its status column, each sorted ascending by order_date
// (entry order — oldest first, the same FIFO order the shop floor works
// through) with created_at as a same-day tiebreaker. This is deliberately
// NOT due_date: the Kanban answers "what came in, what's next to work on",
// the separate date queue (Lista tab) already covers delivery urgency.
// `statuses` fixes the column order/set so an empty column still renders.
export function groupOrdersByStatus(
  orders: readonly OrderWithCustomer[],
  statuses: readonly OrderStatus[],
): Record<OrderStatus, OrderWithCustomer[]> {
  const groups = Object.fromEntries(
    statuses.map((status) => [status, [] as OrderWithCustomer[]]),
  ) as Record<OrderStatus, OrderWithCustomer[]>

  for (const order of orders) {
    groups[order.status]?.push(order)
  }

  for (const status of statuses) {
    groups[status].sort(
      (a, b) =>
        a.order_date.localeCompare(b.order_date) ||
        a.created_at.localeCompare(b.created_at),
    )
  }

  return groups
}

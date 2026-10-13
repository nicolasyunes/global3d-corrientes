import type { OrderSemaphore, OrderStatus } from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'

// Adds `days` (may be negative) to an ISO 'YYYY-MM-DD' date string, done in
// UTC so the arithmetic never shifts across a local-timezone DST boundary.
export function addDaysISO(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day))
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
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

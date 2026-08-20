import type { OrderWithCustomer } from './orders.api'

export type ListTab = 'today' | 'upcoming'

export interface OrderPartition {
  today: OrderWithCustomer[]
  upcoming: OrderWithCustomer[]
}

// The single source of truth for shaping the landing list: drop cancelled
// orders, sort ascending by due_date, then split into "today" (due now or
// overdue) and "upcoming" (future). Kept pure so the view and the unit tests
// exercise the exact same filtering/ordering logic.
export function shapeOrders(
  orders: readonly OrderWithCustomer[],
  today: string,
): OrderPartition {
  const active = orders
    .filter((order) => order.status !== 'cancelled')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return {
    today: active.filter((order) => order.due_date <= today),
    upcoming: active.filter((order) => order.due_date > today),
  }
}

import type { OrderStatus } from '@/lib/domain-constants'

// The forward production flow. `cancelled` is a side action, not a step, so it
// is deliberately excluded — an order never "advances" into cancelled, and a
// delivered order has no next step. `in_queue` is a retired step — the shop's
// real flow goes straight from `new` to `printing` — kept only as a valid
// enum value (and label, for any historical order) but never assigned or
// advanced into. `delivered` is the final step, reached once the customer has
// actually picked up/received the order (distinct from `finished`, which only
// means it's ready).
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  'new',
  'printing',
  'post_processing',
  'finished',
  'delivered',
]

// The next step in the production flow, or null when the status is terminal
// (`delivered`) or off-flow (`cancelled`). Pure so the unit tests can walk the
// whole enum without touching a database or component.
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUS_FLOW.indexOf(status)
  if (index === -1 || index === ORDER_STATUS_FLOW.length - 1) return null
  return ORDER_STATUS_FLOW[index + 1]
}

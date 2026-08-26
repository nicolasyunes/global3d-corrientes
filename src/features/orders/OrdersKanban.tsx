import { Link } from 'react-router-dom'
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PRODUCT_TYPE_LABELS,
  type OrderStatus,
  type ProductType,
} from '@/lib/domain-constants'
import { groupOrdersByStatus, isOverdue } from './list'
import { nextOrderStatus, ORDER_STATUS_FLOW } from './status'
import { formatDueDate, formatMoney } from './format'
import type { OrderWithCustomer } from './orders.api'

// Every column the board can show, in production order, with the off-flow
// terminal state pinned last so it never breaks the left-to-right flow read.
const KANBAN_STATUSES: readonly OrderStatus[] = [
  ...ORDER_STATUS_FLOW,
  'cancelled',
]

interface OrdersKanbanProps {
  orders: readonly OrderWithCustomer[]
  today: string
  advancingId: string | null
  onAdvance: (order: OrderWithCustomer) => void
}

// Status board for `/admin/orders`: one column per production stage so the
// whole shop floor is visible at a glance, not just today's due-date slice.
// Cards within a column read oldest-entry-first (see groupOrdersByStatus) —
// this is a production queue, not a delivery-urgency view — and keep the
// due-date urgency cue from the list view plus the observation line the flat
// list has no room for. No horizontal scroll: columns stack full-width on a
// phone (the page scrolls, each column capping its own overflow) and lay out
// as a wrapping grid from ~900px. Advancing a card's status is a single
// button, not drag-and-drop — the flow is linear and this keeps the action
// keyboard- and screen-reader-reachable without a pointer.
export default function OrdersKanban({
  orders,
  today,
  advancingId,
  onAdvance,
}: OrdersKanbanProps) {
  const columns = groupOrdersByStatus(orders, KANBAN_STATUSES)

  return (
    <div className="kanban" role="group" aria-label="Pedidos por estado">
      {KANBAN_STATUSES.map((status) => {
        const rows = columns[status]
        const color = ORDER_STATUS_COLORS[status]
        return (
          <section
            key={status}
            className="kanban-column"
            aria-label={`${ORDER_STATUS_LABELS[status]} (${rows.length})`}
          >
            <header
              className="kanban-column__header"
              style={{ borderTopColor: color }}
            >
              <span className="kanban-column__title">
                {ORDER_STATUS_LABELS[status]}
              </span>
              <span className="kanban-column__count">{rows.length}</span>
            </header>

            {rows.length === 0 ? (
              <p className="kanban-column__empty">Sin pedidos</p>
            ) : (
              <ul className="kanban-column__cards">
                {rows.map((order) => {
                  const next = nextOrderStatus(order.status)
                  const overdue = isOverdue(order, today)
                  return (
                    <li key={order.id} className="kanban-card">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="kanban-card__link"
                      >
                        <span className="kanban-card__customer">
                          {order.customers?.name ?? 'Desconocido'}
                        </span>
                        <span className="kanban-card__product">
                          {PRODUCT_TYPE_LABELS[
                            order.product_type as ProductType
                          ] ?? order.product_type}
                        </span>
                        <span className="kanban-card__row">
                          <span
                            className={`kanban-card__due${
                              overdue ? ' kanban-card__due--overdue' : ''
                            }`}
                          >
                            {formatDueDate(order.due_date, today)}
                          </span>
                          <span className="kanban-card__pending">
                            {formatMoney(order.pending_balance)}
                          </span>
                        </span>
                        {order.observations && (
                          <span className="kanban-card__note">
                            {order.observations}
                          </span>
                        )}
                      </Link>

                      {next && (
                        <button
                          type="button"
                          className="kanban-card__advance"
                          disabled={advancingId === order.id}
                          onClick={() => onAdvance(order)}
                        >
                          {advancingId === order.id
                            ? 'Actualizando…'
                            : `Avanzar a ${ORDER_STATUS_LABELS[next]} →`}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

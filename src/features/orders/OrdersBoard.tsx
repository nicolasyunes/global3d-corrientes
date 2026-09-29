import { Link } from 'react-router-dom'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/domain-constants'
import { useOperator } from '@/features/operators/operator-context'
import { dueInfo } from '@/features/production/due'
import { orderTitle } from '@/features/production/OrderRow'
import type { OrderProgress } from '@/features/production/production.api'
import { formatMoney } from './format'
import { groupOrdersByStatus } from './list'
import type { OrderWithCustomer } from './orders.api'
import { nextOrderStatus } from './status'

const LANES: readonly OrderStatus[] = [
  'new',
  'printing',
  'post_processing',
  'finished',
]
const CLOSED: readonly OrderStatus[] = ['delivered', 'cancelled']

const LANE_TITLE: Partial<Record<OrderStatus, string>> = {
  new: 'Nuevo / diseño',
  finished: 'Listo para avisar',
}

const LANE_COLOR: Record<string, string> = {
  new: 'var(--status-amber)',
  printing: 'var(--color-orange)',
  post_processing: 'var(--status-violet)',
  finished: 'var(--color-teal)',
}

const SEGMENTS = 8

function Segments({
  progress,
  done,
}: {
  progress?: OrderProgress
  done: boolean
}) {
  const filled =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * SEGMENTS)
      : 0
  return (
    <div className={`segs${done ? ' segs--done' : ''}`} aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <i
          key={i}
          className={i < (done ? SEGMENTS : filled) ? 'is-on' : undefined}
        />
      ))}
    </div>
  )
}

interface OrdersBoardProps {
  orders: readonly OrderWithCustomer[]
  today: string
  progress: Record<string, OrderProgress>
  itemCounts: Record<string, number>
  advancingId: string | null
  onAdvance: (order: OrderWithCustomer) => void
}

export default function OrdersBoard({
  orders,
  today,
  progress,
  itemCounts,
  advancingId,
  onAdvance,
}: OrdersBoardProps) {
  const { byId } = useOperator()
  const normalized = orders.map((o) =>
    o.status === 'in_queue' ? { ...o, status: 'new' as const } : o,
  )
  const columns = groupOrdersByStatus(normalized, [...LANES, ...CLOSED])
  const closedCount = CLOSED.reduce((n, s) => n + columns[s].length, 0)

  function card(order: OrderWithCustomer) {
    const due = dueInfo(order.due_date, today)
    const prog = progress[order.id]
    const who = byId(prog?.lastOperatorId)
    const next = nextOrderStatus(order.status)
    const done = order.status === 'finished' || order.status === 'delivered'
    return (
      <li key={order.id} className="bcard">
        <Link to={`/admin/orders/${order.id}`} className="bcard__link">
          <p className="bcard__title">
            {orderTitle(order, itemCounts[order.id])}
          </p>
          <p className="bcard__sub">
            {order.customers?.name ?? 'Sin cliente'}
            {prog ? ` · ${prog.done}/${prog.total} piezas` : ''}
            {order.status === 'finished' && (order.pending_balance ?? 0) > 0
              ? ` · saldo ${formatMoney(order.pending_balance)}`
              : ''}
          </p>
          <Segments progress={prog} done={done} />
          <div className="bcard__meta">
            <span className={`due due--${done ? 'ok' : due.tone}`}>
              {due.label}
            </span>
            {who && (
              <span
                className="avatar avatar--sm"
                style={{ background: who.color }}
                title={who.name}
              >
                {who.initials}
              </span>
            )}
          </div>
        </Link>
        {next && (
          <button
            type="button"
            className="btn btn--ghost btn--sm bcard__advance"
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
  }

  return (
    <>
      <div className="board" role="group" aria-label="Tablero de pedidos">
        {LANES.map((status) => (
          <section
            key={status}
            className="lane"
            aria-label={ORDER_STATUS_LABELS[status]}
          >
            <h2 className="lane__head">
              <span
                className="lane__dot"
                style={{ background: LANE_COLOR[status] }}
              />
              {LANE_TITLE[status] ?? ORDER_STATUS_LABELS[status]}
              <span className="lane__count num">{columns[status].length}</span>
            </h2>
            {columns[status].length === 0 ? (
              <p className="lane__empty">Sin pedidos</p>
            ) : (
              <ul style={{ listStyle: 'none' }}>{columns[status].map(card)}</ul>
            )}
          </section>
        ))}
      </div>
      {closedCount > 0 && (
        <details className="board-closed">
          <summary>Entregados y cancelados ({closedCount})</summary>
          <div className="board" style={{ marginTop: 12 }}>
            {CLOSED.map((status) => (
              <section
                key={status}
                className="lane"
                aria-label={ORDER_STATUS_LABELS[status]}
              >
                <h2 className="lane__head">
                  {ORDER_STATUS_LABELS[status]}
                  <span className="lane__count num">
                    {columns[status].length}
                  </span>
                </h2>
                <ul style={{ listStyle: 'none' }}>
                  {columns[status].slice(-20).map(card)}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
    </>
  )
}

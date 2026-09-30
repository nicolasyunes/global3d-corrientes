import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { orderTitle } from '@/features/production/OrderRow'
import type { OrderProgress } from '@/features/production/production.api'
import { formatMoney } from './format'
import type { OrderUpdate, OrderWithCustomer } from './orders.api'
import { whatsappLink } from './OrderSummary'
import { urgentFirst } from './orderFlow'
import { stageOf, type Stage } from './stage'
import { dueText, PartsBar, PostMarks, UrgentBadge } from './stage-ui'

type Lane = 'on_hold' | 'printing' | 'post_processing' | 'finished'

const LANES: { key: Lane; title: string }[] = [
  { key: 'on_hold', title: 'En espera' },
  { key: 'printing', title: 'Imprimiendo' },
  { key: 'post_processing', title: 'Posprocesado' },
  { key: 'finished', title: 'Listo para avisar' },
]

// Orders that haven't started printing wait in the same lane as the ones
// that have: both are "in the printers' hands". Delivered orders live in
// "Entregados".
const laneOf = (stage: Stage): Lane | null =>
  stage === 'new'
    ? 'printing'
    : stage === 'cancelled' || stage === 'delivered'
      ? null
      : stage

const READY_TEXT = encodeURIComponent(
  '¡Hola! Tu pedido de Global3D ya está listo para retirar.',
)

interface OrdersBoardProps {
  orders: readonly OrderWithCustomer[]
  today: string
  progress: Record<string, OrderProgress>
  itemCounts: Record<string, number>
  busyId: string | null
  onPatch: (
    order: OrderWithCustomer,
    fields: OrderUpdate,
    event: string,
  ) => void
}

// The board is read-mostly: cards sit in the lane their pieces put them in
// and are never dragged. Each lane offers the one thing you do there.
export default function OrdersBoard({
  orders,
  today,
  progress,
  itemCounts,
  busyId,
  onPatch,
}: OrdersBoardProps) {
  const lanes: Record<Lane, OrderWithCustomer[]> = {
    on_hold: [],
    printing: [],
    post_processing: [],
    finished: [],
  }
  const sorted = [...orders].sort(
    urgentFirst((a, b) => a.due_date.localeCompare(b.due_date)),
  )
  for (const order of sorted) {
    const lane = laneOf(stageOf(order))
    if (!lane) continue
    lanes[lane].push(order)
  }

  function card(order: OrderWithCustomer, lane: Lane) {
    const prog = progress[order.id]
    const busy = busyId === order.id
    const due = dueText(order, today, {
      short: true,
      closed: lane === 'on_hold',
    })
    const wa = whatsappLink(order.customers?.phone)
    const balance = order.pending_balance ?? 0
    return (
      <li key={order.id} className="wk-card">
        <div className="wk-card__top">
          {order.urgent && <UrgentBadge />}
          <span className={`wk-due${due.late ? ' is-late' : ''}`}>
            {due.label}
          </span>
        </div>
        <Link to={`/admin/orders/${order.id}`} className="wk-card__title">
          {order.customers?.name ?? 'Sin cliente'}
        </Link>
        <p className="wk-card__sub">
          {orderTitle(order, itemCounts[order.id])}
        </p>
        {lane === 'on_hold' && (
          <p className="wk-card__note">{order.waiting_reason}</p>
        )}
        {lane === 'printing' && (
          <>
            {(order.pp_sand || order.pp_paint) && <PostMarks order={order} />}
            <PartsBar printed={prog?.done ?? 0} total={prog?.total ?? 0} />
          </>
        )}
        {lane === 'post_processing' && (
          <div className="wk-card__actions">
            {order.pp_sand && (
              <button
                type="button"
                className="wk-toggle"
                aria-pressed={order.sand_done}
                disabled={busy}
                onClick={() =>
                  onPatch(
                    order,
                    { sand_done: !order.sand_done },
                    order.sand_done ? 'Lijado (desmarcado)' : 'Lijado',
                  )
                }
              >
                <Icon name={order.sand_done ? 'check' : 'sand'} size={16} />
                Lijado
              </button>
            )}
            {order.pp_paint && (
              <button
                type="button"
                className="wk-toggle"
                aria-pressed={order.paint_done}
                disabled={busy}
                onClick={() =>
                  onPatch(
                    order,
                    { paint_done: !order.paint_done },
                    order.paint_done ? 'Pintado (desmarcado)' : 'Pintado',
                  )
                }
              >
                <Icon name={order.paint_done ? 'check' : 'brush'} size={16} />
                Pintado
              </button>
            )}
          </div>
        )}
        {lane === 'finished' && (
          <>
            <p className="wk-card__money num">
              {balance > 0 ? `Saldo ${formatMoney(balance)}` : 'Pagado'}
            </p>
            <div className="wk-card__actions">
              {wa && (
                <a
                  className="wk-toggle"
                  href={`${wa}?text=${READY_TEXT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="chat" size={16} />
                  Avisar
                </a>
              )}
              <button
                type="button"
                className="wk-act wk-act--finish"
                disabled={busy}
                onClick={() =>
                  onPatch(order, { status: 'delivered' }, 'delivered')
                }
              >
                <Icon name="check" size={16} />
                Entregado
              </button>
            </div>
          </>
        )}
      </li>
    )
  }

  return (
    <div className="wk-board" role="group" aria-label="Tablero">
      {LANES.map(({ key, title }) => (
        <section key={key} className="wk-col" aria-label={title}>
          <h2 className="wk-col__head">
            <i className={`stage-dot stage-dot--${key}`} aria-hidden="true" />
            {title}
            <span className="num">{lanes[key].length}</span>
          </h2>
          {lanes[key].length === 0 ? (
            <p className="wk-col__empty">Sin pedidos</p>
          ) : (
            <ul className="wk-cards">{lanes[key].map((o) => card(o, key))}</ul>
          )}
        </section>
      ))}
    </div>
  )
}

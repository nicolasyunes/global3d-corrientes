import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { formatDueDate, formatMoney } from './format'
import { followUpFrom, needsReview } from './orderFlow'
import { updateOrder, type OrderWithCustomer } from './orders.api'

// "En espera" orders with the two decisions that get them out of limbo:
// confirm (into production) or look again later.
export default function WaitingOrders({
  orders,
  today,
  onChanged,
}: {
  orders: OrderWithCustomer[]
  today: string
  onChanged: (order: OrderWithCustomer) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patch(
    order: OrderWithCustomer,
    fields: Partial<Pick<OrderWithCustomer, 'waiting_reason' | 'follow_up_on'>>,
  ) {
    setBusyId(order.id)
    setError(null)
    try {
      const updated = await updateOrder(order.id, fields)
      onChanged({ ...order, ...updated })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      <ul className="wlist">
        {orders.map((order) => {
          const due = needsReview(order, today)
          return (
            <li key={order.id} className={`wrow${due ? ' wrow--due' : ''}`}>
              <Link to={`/admin/orders/${order.id}`} className="wrow__main">
                <span className="wrow__title">
                  {order.title?.trim() || 'Pedido'}
                </span>
                <span className="wrow__sub">
                  {order.customers?.name ?? 'Sin cliente'}
                  {order.total_amount !== null &&
                    ` · ${formatMoney(order.total_amount)}`}
                </span>
                <span className="wrow__meta">
                  <span className="badge badge--post">
                    {order.waiting_reason}
                  </span>
                  <span
                    className={due ? 'wrow__review is-due' : 'wrow__review'}
                  >
                    {due
                      ? 'Para revisar hoy'
                      : `Revisar ${formatDueDate(order.follow_up_on ?? today)}`}
                  </span>
                </span>
              </Link>
              <div className="wrow__actions">
                <button
                  type="button"
                  className="btn btn--teal btn--sm"
                  disabled={busyId === order.id}
                  onClick={() =>
                    void patch(order, {
                      waiting_reason: null,
                      follow_up_on: null,
                    })
                  }
                >
                  <Icon name="check" size={16} />
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busyId === order.id}
                  title="Volver a revisarlo en una semana"
                  onClick={() =>
                    void patch(order, { follow_up_on: followUpFrom(today) })
                  }
                >
                  Más tarde
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

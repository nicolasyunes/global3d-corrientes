import { useEffect, useState } from 'react'
import { listPendingSheetOrders, type PendingSheetOrder } from './pendingSheet.api'
import { formatMoney } from './format'
import { toISODate } from './validation'

// "Planilla" tab in /admin/orders — a read-only mirror of the "Pedidos"
// Google Sheet (see supabase/functions/read-pending-orders/), the full
// business panorama: consultas and orders the shop still needs to take on
// or follow up, independent of the real `orders` table. Fetched lazily: only
// mounted once the operator opens this tab, so the sheet is never hit on
// every visit to the orders list.
export default function PendingSheetOrders() {
  const [orders, setOrders] = useState<PendingSheetOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPendingSheetOrders()
      .then((rows) => {
        if (!cancelled) setOrders(rows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la planilla de pendientes.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = toISODate(new Date())

  if (loading) {
    return <p className="orders-list__status">Cargando…</p>
  }

  if (error) {
    return (
      <p className="form-banner form-banner--error orders-list__status" role="alert">
        {error}
      </p>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">No hay pedidos en la planilla</p>
        <p className="empty-state__hint">
          Acá vas a ver las consultas y pedidos que todavía hay que tomar o
          seguir de cerca.
        </p>
      </div>
    )
  }

  return (
    <ul className="pending-sheet">
      {orders.map((order, index) => {
        const overdue = order.fechaEntregaSortKey < today
        return (
          <li key={`${order.nombre}-${index}`} className="pending-card">
            <div className="pending-card__top">
              <span className="pending-card__customer">{order.nombre}</span>
              {order.canal && (
                <span className="pending-card__channel">{order.canal}</span>
              )}
            </div>

            <div className="pending-card__product">{order.producto}</div>
            {order.detalles && (
              <p className="pending-card__details">{order.detalles}</p>
            )}

            <div className="pending-card__footer">
              <span
                className={`pending-card__due${overdue ? ' pending-card__due--overdue' : ''}`}
              >
                {order.fechaEntrega ?? 'Sin fecha'}
              </span>
              <span className="pending-card__amounts">
                <span className="pending-card__total">
                  Total {formatMoney(order.total)}
                </span>
                <span className="pending-card__balance">
                  Saldo {formatMoney(order.saldo)}
                </span>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

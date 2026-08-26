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
type SheetView = 'cards' | 'list'

export default function PendingSheetOrders() {
  const [orders, setOrders] = useState<PendingSheetOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<SheetView>('cards')

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
    <>
      <div className="sheet-controls">
        <nav className="sheet-view-toggle" aria-label="Vista de planilla">
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
            title="Vista de cards"
          >
            ⊞
          </button>
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            title="Vista de lista"
          >
            ≡
          </button>
        </nav>
      </div>

      {view === 'cards' && (
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
      )}

      {view === 'list' && (
        <div className="sheet-table-wrap">
          <table className="sheet-table">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Canal</th>
                <th scope="col">Producto</th>
                <th scope="col">Detalles</th>
                <th scope="col">Entrega</th>
                <th scope="col" className="sheet-table__num">
                  Total
                </th>
                <th scope="col" className="sheet-table__num">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => {
                const overdue = order.fechaEntregaSortKey < today
                return (
                  <tr
                    key={`${order.nombre}-${index}`}
                    className={`sheet-table__row${index % 2 === 1 ? ' sheet-table__row--alt' : ''}${overdue ? ' sheet-table__row--overdue' : ''}`}
                  >
                    <td className="sheet-table__customer">{order.nombre}</td>
                    <td className="sheet-table__muted">{order.canal || '—'}</td>
                    <td className="sheet-table__muted">{order.producto}</td>
                    <td className="sheet-table__muted sheet-table__details">
                      {order.detalles || '—'}
                    </td>
                    <td
                      className={`sheet-table__due${overdue ? ' sheet-table__due--overdue' : ''}`}
                    >
                      {order.fechaEntrega ?? 'Sin fecha'}
                    </td>
                    <td className="sheet-table__num">
                      {formatMoney(order.total)}
                    </td>
                    <td className="sheet-table__num">
                      {formatMoney(order.saldo)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

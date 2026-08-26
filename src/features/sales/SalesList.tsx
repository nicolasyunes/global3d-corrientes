import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/lib/domain-constants'
import { formatMoney } from '@/features/orders/format'
import { listSales, type SaleWithInventory } from './sales.api'
import { groupSalesByDay, totalAmount } from './list'
import '@/features/orders/orders.css'
import './sales.css'

// `/admin/ventas`: supplies sales grouped by day (newest first), each day
// carrying its own revenue subtotal, with a grand total across the loaded
// range up top — reads like a daily cash-out sheet rather than an
// undifferentiated stream of rows. Reuses OrdersList's row/empty-state visual
// pattern; capture stays a separate flow (SalesForm).
export default function SalesList() {
  const [sales, setSales] = useState<SaleWithInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listSales()
      .then((rows) => {
        if (!cancelled) setSales(rows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las ventas.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => groupSalesByDay(sales), [sales])
  const total = useMemo(() => totalAmount(sales), [sales])

  return (
    <main className="orders-list">
      {!loading && !error && sales.length > 0 && (
        <div className="orders-list__toolbar sales-toolbar">
          <span className="sales-toolbar__label">Total</span>
          <span className="sales-toolbar__total">{formatMoney(total)}</span>
        </div>
      )}

      {loading && <p className="orders-list__status">Cargando…</p>}

      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {!loading && !error && sales.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Todavía no hay ventas</p>
          <p className="empty-state__hint">
            Tocá Nueva venta para agregar una.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        groups.map((group) => (
          <section key={group.day} className="sales-day">
            <header className="sales-day__header">
              <span className="sales-day__label">{group.label}</span>
              <span className="sales-day__total">
                {formatMoney(group.total)}
              </span>
            </header>
            <ul className="orders-list__rows">
              {group.sales.map((sale) => (
                <li key={sale.id}>
                  <div className="order-row">
                    <div className="order-row__main">
                      <span className="order-row__customer">
                        {sale.inventory
                          ? [
                              sale.inventory.material,
                              sale.inventory.color,
                              sale.inventory.brand,
                            ]
                              .filter(Boolean)
                              .join(' / ')
                          : 'Sin spool asociado'}
                      </span>
                      <span className="order-row__product">
                        {sale.quantity_grams === null
                          ? '—'
                          : `${sale.quantity_grams}g`}
                      </span>
                    </div>
                    <div className="order-row__meta">
                      {sale.method && (
                        <span className="badge">
                          {PAYMENT_METHOD_LABELS[
                            sale.method as PaymentMethod
                          ] ?? sale.method}
                        </span>
                      )}
                      <span className="order-row__pending">
                        {formatMoney(sale.amount)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <div className="sticky-cta">
        <div className="sticky-cta__inner">
          <Link to="/admin/ventas/new" className="primary-btn">
            Nueva venta
          </Link>
        </div>
      </div>
    </main>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_TYPE_LABELS, type ProductType } from '@/lib/domain-constants'
import { listOrders, type OrderWithCustomer } from './orders.api'
import { shapeOrders, type ListTab } from './list'
import { formatDueDate, formatMoney } from './format'
import { toISODate } from './validation'
import StatusBadge from './StatusBadge'
import './orders.css'

// The `/admin/orders` landing view: a flat due-date queue split into Today /
// Upcoming tabs, sorted by due_date ascending, hiding cancelled orders. Rows are
// full-width tap targets that open the order detail.
export default function OrdersList() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [tab, setTab] = useState<ListTab>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listOrders()
      .then((rows) => {
        if (!cancelled) setOrders(rows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not load orders.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = useMemo(() => toISODate(new Date()), [])
  const partition = useMemo(() => shapeOrders(orders, today), [orders, today])
  const rows = tab === 'today' ? partition.today : partition.upcoming

  return (
    <main className="orders-list">
      <header className="orders-list__header">
        <h1 className="orders-list__wordmark">
          Global<span className="orders-list__wordmark-accent">3D</span>
        </h1>
      </header>

      <nav className="tabs" aria-label="Due date">
        <button
          type="button"
          className={`tab${tab === 'today' ? ' tab--selected' : ''}`}
          aria-pressed={tab === 'today'}
          onClick={() => setTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`tab${tab === 'upcoming' ? ' tab--selected' : ''}`}
          aria-pressed={tab === 'upcoming'}
          onClick={() => setTab('upcoming')}
        >
          Upcoming
        </button>
      </nav>

      {loading && <p className="orders-list__status">Loading…</p>}

      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">
            {tab === 'today' ? 'No orders due today' : 'No upcoming orders'}
          </p>
          <p className="empty-state__hint">Tap Quick order to add one.</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="orders-list__rows">
          {rows.map((order) => (
            <li key={order.id}>
              <Link to={`/admin/orders/${order.id}`} className="order-row">
                <div className="order-row__main">
                  <span className="order-row__customer">
                    {order.customers?.name ?? 'Unknown'}
                  </span>
                  <span className="order-row__product">
                    {PRODUCT_TYPE_LABELS[order.product_type as ProductType] ??
                      order.product_type}
                  </span>
                </div>
                <div className="order-row__meta">
                  <span className="order-row__due">
                    {formatDueDate(order.due_date, today)}
                  </span>
                  <StatusBadge status={order.status} />
                  <span className="order-row__pending">
                    {formatMoney(order.pending_balance)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="sticky-cta">
        <div className="sticky-cta__inner">
          <Link to="/admin/orders/new" className="primary-btn">
            Quick order
          </Link>
        </div>
      </div>
    </main>
  )
}

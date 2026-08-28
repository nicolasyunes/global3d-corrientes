import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/domain-constants'
import {
  getOrder,
  listOrderItems,
  updateOrder,
  type OrderItemRow,
  type OrderWithCustomer,
} from './orders.api'
import { nextOrderStatus } from './status'
import { colorSpecEntries, swatchFor } from './colorSpec'
import { formatDueDate, formatMoney } from './format'
import { isOverdue } from './list'
import { toISODate } from './validation'
import OrderImages from './OrderImages'
import ProductionChecklist from './ProductionChecklist'
import StatusBadge from './StatusBadge'
import './orders.css'

// `/admin/orders/:id` — the shop-floor view. Everything needed to *make* the
// order (colours, measurements, engraving text, reference photos, checklist)
// with exactly one write path that matters here: advancing the production
// stage. Commercial data (money, payment method, channel, customer contact)
// lives on the sibling `/editar` screen (OrderEdit). Replaces the former
// OrderDetail, which mixed both concerns on one page.
export default function OrderProduction() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getOrder(id), listOrderItems(id)])
      .then(([row, itemRows]) => {
        if (cancelled) return
        setOrder(row)
        setItems(itemRows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el pedido.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const today = toISODate(new Date())

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateOrder(order.id, { status })
      // Merge the persisted row over the loaded one, keeping the customer
      // relation that updateOrder (order-only select) does not return.
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="order-production">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-production">
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error ?? 'Pedido no encontrado.'}
        </p>
        <Link to="/admin/orders" className="link-btn back-link">
          Volver a pedidos
        </Link>
      </main>
    )
  }

  const next = nextOrderStatus(order.status)
  const isFinished = order.status === 'finished'
  const isCancelled = order.status === 'cancelled'
  const overdue = isOverdue(order, today)
  const colors = colorSpecEntries(order.color_spec)
  const hasSpec =
    colors.length > 0 ||
    Boolean(order.measurements) ||
    Boolean(order.personalization) ||
    items.length > 0

  return (
    <main className="order-production">
      <header className="order-production__header">
        <div className="order-production__nav">
          <Link to="/admin/orders" className="link-btn back-link">
            Volver a pedidos
          </Link>
          <Link
            to={`/admin/orders/${order.id}/editar`}
            className="link-btn"
          >
            Datos y edición ↗
          </Link>
        </div>
        <p className="order-production__customer">
          {order.customers?.name ?? 'Desconocido'}
        </p>
        <div className="order-production__meta">
          <StatusBadge status={order.status} />
          <span
            className={`order-production__due${
              overdue ? ' order-production__due--overdue' : ''
            }`}
          >
            Entrega: {formatDueDate(order.due_date, today)}
          </span>
        </div>
      </header>

      <section className="status-actions">
        {next && (
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void setStatus(next)}
          >
            {busy ? 'Actualizando…' : `Avanzar a ${ORDER_STATUS_LABELS[next]}`}
          </button>
        )}
        {!isFinished && !isCancelled && (
          <button
            type="button"
            className="danger-btn"
            disabled={busy}
            onClick={() => void setStatus('cancelled')}
          >
            Cancelar pedido
          </button>
        )}
        {isFinished && (
          <p className="status-actions__done">
            Listo para entregar. Saldo pendiente:{' '}
            {formatMoney(order.pending_balance)}
          </p>
        )}
        {isCancelled && (
          <p className="status-actions__done">Este pedido fue cancelado.</p>
        )}
        {actionError && (
          <p className="form-banner form-banner--error" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="production-spec">
        <h2 className="form-section__heading">Qué hay que hacer</h2>

        {hasSpec ? (
          <>
            <dl className="production-spec__list">
              {colors.length > 0 && (
                <div className="production-spec__row">
                  <dt>Colores</dt>
                  <dd>
                    <ul className="production-spec__colors">
                      {colors.map(({ part, color }) => {
                        const hex = swatchFor(color)
                        return (
                          <li key={part}>
                            {hex && (
                              <span
                                className="production-spec__swatch"
                                style={{ backgroundColor: hex }}
                                aria-hidden="true"
                              />
                            )}
                            <span className="production-spec__part">
                              {part}:
                            </span>{' '}
                            {color}
                          </li>
                        )
                      })}
                    </ul>
                  </dd>
                </div>
              )}
              {order.measurements && (
                <div className="production-spec__row">
                  <dt>Medidas</dt>
                  <dd>{order.measurements}</dd>
                </div>
              )}
              {order.personalization && (
                <div className="production-spec__row">
                  <dt>Personalización</dt>
                  <dd className="production-spec__engraving">
                    {order.personalization}
                  </dd>
                </div>
              )}
            </dl>

            {items.length > 0 && (
              <ul className="production-spec__items">
                {items.map((item) => (
                  <li key={item.id} className="production-spec__item">
                    <span className="production-spec__item-qty">
                      {item.quantity}×
                    </span>{' '}
                    {item.description}
                    {item.personalization && (
                      <span className="production-spec__engraving">
                        {' '}
                        — {item.personalization}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="field__hint">
            Sin especificaciones cargadas. Completá los detalles en{' '}
            <Link
              to={`/admin/orders/${order.id}/editar`}
              className="link-btn link-btn--inline"
            >
              Datos y edición
            </Link>
            .
          </p>
        )}
      </section>

      {order.reference_link && (
        <a
          href={order.reference_link}
          target="_blank"
          rel="noopener noreferrer"
          className="link-btn"
        >
          Ver modelo ↗
        </a>
      )}

      <OrderImages orderId={order.id} />

      <ProductionChecklist orderId={order.id} />

      {order.observations && (
        <section className="production-observations">
          <h2 className="form-section__heading">Observaciones</h2>
          <p>{order.observations}</p>
        </section>
      )}
    </main>
  )
}

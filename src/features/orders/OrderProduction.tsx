import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '@/components/Icon'
import {
  ORDER_STATUS_LABELS,
  ORIGIN_CHANNEL_LABELS,
  type OrderStatus,
  type OriginChannel,
} from '@/lib/domain-constants'
import ActivityFeed from '@/features/production/ActivityFeed'
import OrderPieces from '@/features/production/OrderPieces'
import { dueInfo } from '@/features/production/due'
import '@/features/production/production.css'
import {
  getOrder,
  listOrderItems,
  updateOrder,
  type OrderItemRow,
  type OrderWithCustomer,
} from './orders.api'
import { nextOrderStatus, ORDER_STATUS_FLOW } from './status'
import { colorSpecEntries, swatchFor } from './colorSpec'
import { formatMoney } from './format'
import { toISODate } from './validation'
import OrderImages from './OrderImages'
import { useOrderModal } from './order-modal-context'
import { STATUS_BADGE_CLASS } from './StatusBadge'

// `/admin/orders/:id` — the shop-floor view: stage line + advance, items with
// their pieces (color, counter, status, who), references and activity.
// Commercial data lives on `/editar`.
export default function OrderProduction() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activityKey, setActivityKey] = useState(0)
  const [piecesKey, setPiecesKey] = useState(0)
  const { openEdit } = useOrderModal()

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

  // After editing in the modal: items may have been added/removed (and their
  // pieces with them), so reload everything below the header too.
  async function reload() {
    if (!id) return
    const [row, itemRows] = await Promise.all([
      getOrder(id),
      listOrderItems(id),
    ])
    setOrder(row)
    setItems(itemRows)
    setPiecesKey((k) => k + 1)
    setActivityKey((k) => k + 1)
  }

  // Pieces can move the order to "Imprimiendo" server-side; refresh the header.
  function handlePiecesChanged() {
    setActivityKey((k) => k + 1)
    if (!id) return
    void getOrder(id).then((row) => row && setOrder(row))
  }

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateOrder(order.id, { status })
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Cargando…</p>

  if (error || !order) {
    return (
      <main>
        <p className="banner banner--error" role="alert">
          {error ?? 'Pedido no encontrado.'}
        </p>
        <Link to="/admin/orders" className="back">
          <Icon name="back" size={18} />
          Volver a pedidos
        </Link>
      </main>
    )
  }

  const today = toISODate(new Date())
  const next = nextOrderStatus(order.status)
  const isFinished = order.status === 'finished'
  const isCancelled = order.status === 'cancelled'
  const due = dueInfo(order.due_date, today)
  const colors = colorSpecEntries(order.color_spec)
  const stageIndex = ORDER_STATUS_FLOW.indexOf(order.status)
  const title = order.title?.trim()
    ? order.title
    : items.length === 1
      ? items[0].description
      : items.length > 1
        ? `${items.length} ítems`
        : (order.personalization ?? 'Pedido')
  const channel = order.origin_channel
    ? (ORIGIN_CHANNEL_LABELS[order.origin_channel as OriginChannel] ??
      order.origin_channel)
    : null

  return (
    <main>
      <header className="page-head">
        <div className="page-head__main">
          <Link to="/admin/orders" className="back">
            <Icon name="back" size={18} />
            Pedidos
          </Link>
          <p className="eyebrow">
            {order.customers?.name ?? 'Sin cliente'}
            {channel ? ` · ${channel}` : ''}
          </p>
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="page-head__actions">
          <span
            className={`badge ${due.tone === 'late' ? 'badge--late' : 'badge--printing'}`}
          >
            {due.tone === 'late' ? due.label : `Entrega: ${due.label}`}
          </span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => openEdit(order.id, () => void reload())}
          >
            <Icon name="edit" size={18} />
            Editar datos
          </button>
        </div>
      </header>

      {!isCancelled && (
        <div className="stages" aria-label="Etapas del pedido">
          {ORDER_STATUS_FLOW.map((status, i) => (
            <span
              key={status}
              className={
                i < stageIndex
                  ? 'is-done'
                  : i === stageIndex
                    ? 'is-current'
                    : undefined
              }
              aria-current={i === stageIndex ? 'step' : undefined}
            >
              {ORDER_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      )}

      <div className="stage-actions">
        {isCancelled && (
          <span className={STATUS_BADGE_CLASS.cancelled}>Pedido cancelado</span>
        )}
        {next && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void setStatus(next)}
          >
            {busy ? 'Actualizando…' : `Avanzar a ${ORDER_STATUS_LABELS[next]}`}
          </button>
        )}
        {!isFinished && !isCancelled && order.status !== 'delivered' && (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm('¿Cancelar este pedido?'))
                void setStatus('cancelled')
            }}
          >
            Cancelar pedido
          </button>
        )}
        {isFinished && (
          <p className="stage-actions__hint num">
            Listo para entregar. Saldo pendiente:{' '}
            {formatMoney(order.pending_balance)}
          </p>
        )}
        {actionError && (
          <p className="banner banner--error" role="alert">
            {actionError}
          </p>
        )}
      </div>

      <div className="detail-grid">
        <OrderPieces
          key={piecesKey}
          orderId={order.id}
          items={items}
          onChanged={handlePiecesChanged}
        />

        <div className="detail-side">
          {(colors.length > 0 ||
            order.measurements ||
            order.personalization ||
            order.observations) && (
            <section className="card">
              <div className="card__head">
                <h2 className="card__title">Qué hay que hacer</h2>
              </div>
              <dl className="spec">
                {colors.length > 0 && (
                  <div>
                    <dt>Colores</dt>
                    <dd>
                      <ul className="spec__colors">
                        {colors.map(({ part, color }) => {
                          const hex = swatchFor(color)
                          return (
                            <li key={part}>
                              <span
                                className="swatch"
                                style={hex ? { background: hex } : undefined}
                              />
                              {part}: {color}
                            </li>
                          )
                        })}
                      </ul>
                    </dd>
                  </div>
                )}
                {order.measurements && (
                  <div>
                    <dt>Medidas</dt>
                    <dd>{order.measurements}</dd>
                  </div>
                )}
                {order.personalization && (
                  <div>
                    <dt>Texto / personalización</dt>
                    <dd className="spec__engraving">{order.personalization}</dd>
                  </div>
                )}
                {order.observations && (
                  <div>
                    <dt>Observaciones</dt>
                    <dd>{order.observations}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Archivos y referencias</h2>
              <span className="spacer" />
              {order.reference_link && (
                <a
                  href={order.reference_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--ghost btn--sm"
                >
                  Ver modelo
                  <Icon name="external" size={16} />
                </a>
              )}
            </div>
            <OrderImages orderId={order.id} />
          </section>

          <ActivityFeed orderId={order.id} refreshKey={activityKey} />
        </div>
      </div>
    </main>
  )
}

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
  type OrderUpdate,
  type OrderWithCustomer,
} from './orders.api'
import { nextOrderStatus, ORDER_STATUS_FLOW } from './status'
import { formatDueDate, formatMoney } from './format'
import { DEFAULT_WAITING_REASON, followUpFrom, isWaiting } from './orderFlow'
import OrderSummary, { type PieceStats } from './OrderSummary'
import { listPieces } from '@/features/production/production.api'
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
  const [stats, setStats] = useState<PieceStats | null>(null)

  // Summary numbers; refreshed whenever pieces or the order change.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    listPieces(id)
      .then((rows) => {
        if (cancelled) return
        setStats(
          rows.length === 0
            ? null
            : {
                pieces: rows.length,
                piecesDone: rows.filter((p) => p.status === 'done').length,
                units: rows.reduce((s, p) => s + p.quantity_total, 0),
                unitsDone: rows.reduce((s, p) => s + p.quantity_done, 0),
              },
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id, activityKey, piecesKey])

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

  const setStatus = (status: OrderStatus) => patchOrder({ status })

  async function patchOrder(fields: OrderUpdate) {
    if (!order) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateOrder(order.id, fields)
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
  const waiting = isWaiting(order) && !isCancelled
  const due = dueInfo(order.due_date, today)
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
          {order.urgent && !waiting && !isFinished && (
            <span className="badge badge--late">Urgente</span>
          )}
          {waiting ? (
            <span className="badge badge--post">En espera</span>
          ) : order.flexible ? (
            <span className="badge">
              Sin apuro · {formatDueDate(order.due_date)}
            </span>
          ) : (
            <span
              className={`badge ${due.tone === 'late' ? 'badge--late' : 'badge--printing'}`}
            >
              {due.tone === 'late' ? due.label : `Entrega: ${due.label}`}
            </span>
          )}
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

      {waiting && (
        <div className="waiting-banner" role="status">
          <Icon name="alert" />
          <div>
            <strong>En espera: {order.waiting_reason}</strong>
            <p>
              No entra a producción hasta que lo confirmes.{' '}
              {order.follow_up_on && order.follow_up_on > today
                ? `Vuelve a aparecer para revisar el ${formatDueDate(order.follow_up_on)}.`
                : 'Hoy toca revisarlo.'}
            </p>
          </div>
          <div className="waiting-banner__actions">
            <button
              type="button"
              className="btn btn--teal"
              disabled={busy}
              onClick={() =>
                void patchOrder({ waiting_reason: null, follow_up_on: null })
              }
            >
              <Icon name="check" size={18} />
              Confirmar pedido
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() =>
                void patchOrder({ follow_up_on: followUpFrom(today) })
              }
            >
              Revisar en una semana
            </button>
          </div>
        </div>
      )}

      <div className="stage-actions">
        {isCancelled && (
          <span className={STATUS_BADGE_CLASS.cancelled}>Pedido cancelado</span>
        )}
        {next && !waiting && (
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
        {!waiting && order.status === 'new' && (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            title="Sacarlo de producción hasta que se confirme"
            onClick={() =>
              void patchOrder({
                waiting_reason: DEFAULT_WAITING_REASON,
                follow_up_on: followUpFrom(today),
              })
            }
          >
            Poner en espera
          </button>
        )}
        {!waiting &&
          !isFinished &&
          !isCancelled &&
          order.status !== 'delivered' && (
            <button
              type="button"
              className="chip"
              aria-pressed={order.flexible}
              disabled={busy}
              title="La fecha es orientativa: no cuenta como atrasado"
              onClick={() =>
                void patchOrder({
                  flexible: !order.flexible,
                  ...(!order.flexible && { urgent: false }),
                })
              }
            >
              Sin apuro
            </button>
          )}
        {!waiting &&
          !isFinished &&
          !isCancelled &&
          order.status !== 'delivered' && (
            <button
              type="button"
              className="chip chip--urgent"
              aria-pressed={order.urgent}
              disabled={busy}
              title="Aparece primero en Pedidos, arriba de todo"
              onClick={() =>
                void patchOrder({
                  urgent: !order.urgent,
                  ...(!order.urgent && { flexible: false }),
                })
              }
            >
              Urgente
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
          <OrderSummary
            order={order}
            items={items}
            stats={stats}
            today={today}
            channel={channel}
          />

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

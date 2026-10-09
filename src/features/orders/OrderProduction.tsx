import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '@/components/Icon'
import {
  ORDER_STATUS_LABELS,
  type PaymentMethod,
  ORIGIN_CHANNEL_LABELS,
  type OrderStatus,
  type OriginChannel,
} from '@/lib/domain-constants'
import { useOperator } from '@/features/operators/operator-context'
import ActivityFeed from '@/features/production/ActivityFeed'
import OrderPieces from '@/features/production/OrderPieces'
import { colorSwatch } from '@/features/production/pieces'
import '@/features/production/production.css'
import {
  listEvents,
  listPieces,
  type PieceRow,
} from '@/features/production/production.api'
import { logOrderEvent } from '@/features/production/workshop.api'
import { formatDueDate } from './format'
import OrderImages from './OrderImages'
import OrderDesigns from '@/features/designs/OrderDesigns'
import { useOrderModal } from './order-modal-context'
import { DEFAULT_WAITING_REASON, followUpFrom, isWaiting } from './orderFlow'
import {
  getOrder,
  listOrderItems,
  updateOrder,
  type OrderItemRow,
  type OrderUpdate,
  type OrderWithCustomer,
} from './orders.api'
import { createOrderFromDraft, loadDraft } from './orderSave.api'
import { registerOrderPayment } from './payments.api'
import OrderSummary from './OrderSummary'
import { nextStepHint, type PostFields } from './stage'
import { nextOrderStatus, ORDER_STATUS_FLOW } from './status'
import { toISODate } from './validation'
import './taller.css'

function stamp(iso: string, today: string): string {
  const date = new Date(iso)
  const day = toISODate(date)
  const time = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  if (day === today) return `hoy ${time}`
  return date
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

// Compact "how far is it": one square per piece in its own color. Filled =
// printed, striped = printing, outline = still to do.
function PartsChip({ parts }: { parts: PieceRow[] }) {
  if (parts.length === 0) return null
  const done = parts.filter((p) => p.status === 'done').length
  return (
    <span className="parts-chip" title="Partes impresas">
      <span className="parts-chip__squares" aria-hidden="true">
        {parts.slice(0, 14).map((p) => {
          const bg = colorSwatch(p.color) ?? '#8a8178'
          const solid = bg.startsWith('#') ? bg : '#8a8178'
          return (
            <i
              key={p.id}
              data-status={p.status}
              style={
                p.status === 'done'
                  ? { background: bg }
                  : p.status === 'printing'
                    ? {
                        background: `repeating-linear-gradient(135deg, ${solid} 0 3px, #fff 3px 5px)`,
                      }
                    : { boxShadow: `inset 0 0 0 1.5px ${solid}` }
              }
            />
          )
        })}
      </span>
      <span className="num">
        {done}/{parts.length} {parts.length === 1 ? 'parte' : 'partes'}
      </span>
    </span>
  )
}

// `/admin/orders/:id` — the order from the workshop's side: the stage (which
// follows the pieces by itself), the pieces edited in place, and a summary of
// who, when and how much.
export default function OrderProduction() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { current } = useOperator()
  const operatorId = current?.id ?? null
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [parts, setParts] = useState<PieceRow[]>([])
  const [stageDates, setStageDates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activityKey, setActivityKey] = useState(0)
  const [piecesKey, setPiecesKey] = useState(0)
  const [paymentsKey, setPaymentsKey] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { openEdit } = useOrderModal()

  // Pieces (for the header chip and the stage hint) and when each stage was
  // reached; refreshed whenever something changes below.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([listPieces(id), listEvents(id, 80)])
      .then(([rows, events]) => {
        if (cancelled) return
        setParts(rows)
        const dates: Record<string, string> = {}
        // Newest first: keep the latest time each stage was entered.
        for (const e of events)
          if (e.kind === 'stage' && e.to_status && !dates[e.to_status])
            dates[e.to_status] = e.created_at
        setStageDates(dates)
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

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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

  // Pieces move the order's stage in the database; refresh the header.
  function handlePiecesChanged() {
    setActivityKey((k) => k + 1)
    if (!id) return
    void getOrder(id).then((row) => row && setOrder(row))
  }

  // Saves, then re-reads the order: the database may have recomputed its
  // stage. `event` goes to the order's activity.
  async function patchOrder(
    fields: OrderUpdate,
    event?: {
      kind: 'priority' | 'postprocess' | 'payment'
      label: string
      delta?: number
    },
  ): Promise<boolean> {
    if (!order) return false
    setBusy(true)
    setActionError(null)
    try {
      await updateOrder(order.id, fields)
      if (event)
        await logOrderEvent(
          order.id,
          operatorId,
          event.kind,
          event.label,
          event.delta,
        )
      const fresh = await getOrder(order.id)
      if (fresh) setOrder(fresh)
      setActivityKey((k) => k + 1)
      return true
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo guardar el cambio.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  // The stepper sets the stage by hand: it stays there (stage_manual) until
  // "volver a automático".
  function goToStatus(status: OrderStatus) {
    if (!order || status === order.status) return
    const from = ORDER_STATUS_FLOW.indexOf(order.status)
    const to = ORDER_STATUS_FLOW.indexOf(status)
    const verb = to < from ? 'Volver a' : 'Pasar a'
    if (
      !window.confirm(
        `${verb} "${ORDER_STATUS_LABELS[status]}"? La etapa queda fijada a mano hasta que vuelvas a automático.`,
      )
    )
      return
    void patchOrder({ status, stage_manual: status !== 'delivered' })
  }

  async function duplicate() {
    if (!order) return
    setMenuOpen(false)
    setBusy(true)
    setActionError(null)
    try {
      const draft = await loadDraft(order.id)
      const copy = await createOrderFromDraft(
        { ...draft, deposit: '', urgent: false },
        operatorId,
      )
      navigate(`/admin/orders/${copy.id}`)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo duplicar el pedido.',
      )
    } finally {
      setBusy(false)
    }
  }

  // The database function checks the balance, keeps deposit / pending balance
  // in step and logs the payment; here we only re-read the order.
  async function refreshAfterPayment() {
    if (!order) return
    const fresh = await getOrder(order.id)
    if (fresh) setOrder(fresh)
    setPaymentsKey((k) => k + 1)
    setActivityKey((k) => k + 1)
  }

  async function registerPayment(
    amount: number,
    method: PaymentMethod,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!order) return { ok: false, message: 'Pedido no cargado.' }
    if (busy) return { ok: false, message: 'Hay otra acción en curso.' }
    setBusy(true)
    setActionError(null)
    try {
      await registerOrderPayment(order.id, amount, method, operatorId)
    } catch (err) {
      setBusy(false)
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : 'No se pudo registrar el pago.',
      }
    }
    // The cobro is saved: a failed refresh must not read as a failed payment.
    try {
      await refreshAfterPayment()
    } catch {
      setPaymentsKey((k) => k + 1)
      setActivityKey((k) => k + 1)
      setActionError(
        'El cobro se registró pero no se pudo actualizar la pantalla. Recargá.',
      )
    } finally {
      setBusy(false)
    }
    return { ok: true }
  }

  function handlePaymentVoided() {
    void refreshAfterPayment().catch((err) =>
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el pedido.',
      ),
    )
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
  // An order without sanding or painting skips the postprocess step.
  const following = nextOrderStatus(order.status)
  const next =
    following === 'post_processing' && !order.pp_sand && !order.pp_paint
      ? 'finished'
      : following
  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const open = !isCancelled && !isDelivered
  const waiting = isWaiting(order) && open
  const stageIndex = ORDER_STATUS_FLOW.indexOf(
    order.status === 'in_queue' ? 'new' : order.status,
  )
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
  const post: PostFields = {
    pp_sand: order.pp_sand,
    pp_paint: order.pp_paint,
    sand_done: order.sand_done,
    paint_done: order.paint_done,
  }
  const progressPct =
    stageIndex <= 0 ? 0 : (stageIndex / (ORDER_STATUS_FLOW.length - 1)) * 100

  return (
    <main className="od">
      <Link to="/admin/orders" className="back">
        <Icon name="back" size={18} />
        Pedidos
      </Link>
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">
            {order.customers?.name ?? 'Sin cliente'}
            {channel ? ` · ${channel}` : ''}
          </p>
          <div className="od-title">
            <h1 className="page-title">{title}</h1>
            <PartsChip parts={parts} />
          </div>
        </div>
        <div className="page-head__actions">
          {order.urgent && open && !waiting && (
            <span className="badge badge--late">Urgente</span>
          )}
          {waiting && <span className="badge badge--post">En espera</span>}
          {order.flexible && open && !waiting && (
            <span className="badge">
              Sin apuro · {formatDueDate(order.due_date)}
            </span>
          )}
          {isCancelled && <span className="badge">Pedido cancelado</span>}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => openEdit(order.id, () => void reload())}
          >
            <Icon name="edit" size={18} />
            Editar datos
          </button>
          <div className="od-menu" ref={menuRef}>
            <button
              type="button"
              className="sem-nav"
              aria-label="Más acciones: cancelar pedido, duplicar"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="more" size={22} />
            </button>
            {menuOpen && (
              <div className="od-menu__panel">
                <button type="button" disabled={busy} onClick={duplicate}>
                  <Icon name="copy" size={16} />
                  Duplicar pedido
                </button>
                {open && !waiting && order.status === 'new' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false)
                      void patchOrder({
                        waiting_reason: DEFAULT_WAITING_REASON,
                        follow_up_on: followUpFrom(today),
                      })
                    }}
                  >
                    <Icon name="alert" size={16} />
                    Poner en espera
                  </button>
                )}
                {open && (
                  <button
                    type="button"
                    className="is-danger"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false)
                      if (window.confirm('¿Cancelar este pedido?'))
                        void patchOrder({ status: 'cancelled' })
                    }}
                  >
                    <Icon name="trash" size={16} />
                    Cancelar pedido
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {waiting && (
        <div className="waiting-banner" role="status">
          <Icon name="alert" />
          <div>
            <strong>En espera: {order.waiting_reason}</strong>
            <p>
              No entra al taller hasta que lo confirmes.{' '}
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

      {!isCancelled && (
        <section className="od-stepper">
          <div className="od-stepper__rail">
            <div className="od-stepper__line" aria-hidden="true">
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <ol aria-label="Etapas del pedido">
              {ORDER_STATUS_FLOW.map((status, i) => {
                const reached = i <= stageIndex
                const date =
                  i === 0
                    ? order.created_at
                    : reached
                      ? stageDates[status]
                      : undefined
                return (
                  <li
                    key={status}
                    className={
                      i < stageIndex
                        ? 'is-done'
                        : i === stageIndex
                          ? 'is-current'
                          : undefined
                    }
                  >
                    <button
                      type="button"
                      disabled={busy || waiting}
                      aria-current={i === stageIndex ? 'step' : undefined}
                      aria-label={
                        i === stageIndex
                          ? `${ORDER_STATUS_LABELS[status]}, etapa actual`
                          : `Cambiar estado a ${ORDER_STATUS_LABELS[status]}`
                      }
                      onClick={() => goToStatus(status)}
                    >
                      <span className="od-stepper__dot num">
                        {i < stageIndex ? (
                          <Icon name="check" size={14} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="od-stepper__label">
                        {ORDER_STATUS_LABELS[status]}
                      </span>
                      <span className="od-stepper__date">
                        {date ? stamp(date, today) : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="od-stepper__bar">
            <Icon name={order.stage_manual ? 'wrench' : 'auto'} size={18} />
            <p className="od-stepper__hint">
              {nextStepHint(order, parts)}
              {!order.stage_manual && open && !waiting && (
                <> Podés cambiar el estado tocando un paso.</>
              )}
              {order.stage_manual && open && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="osum2__link"
                    disabled={busy}
                    onClick={() => void patchOrder({ stage_manual: false })}
                  >
                    Volver a automático
                  </button>
                </>
              )}
            </p>
            {open && !waiting && (
              <>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={order.flexible}
                  disabled={busy}
                  title="La fecha es orientativa: no cuenta como atrasado"
                  onClick={() =>
                    void patchOrder(
                      {
                        flexible: !order.flexible,
                        ...(!order.flexible && { urgent: false }),
                      },
                      {
                        kind: 'priority',
                        label: order.flexible ? 'Normal' : 'Sin apuro',
                      },
                    )
                  }
                >
                  Sin apuro
                </button>
                <button
                  type="button"
                  className="chip chip--urgent"
                  aria-pressed={order.urgent}
                  disabled={busy}
                  title="Aparece primero en Pedidos y en Taller"
                  onClick={() =>
                    void patchOrder(
                      {
                        urgent: !order.urgent,
                        ...(!order.urgent && { flexible: false }),
                      },
                      {
                        kind: 'priority',
                        label: order.urgent ? 'Normal' : 'Urgente',
                      },
                    )
                  }
                >
                  Urgente
                </button>
              </>
            )}
            {next && !waiting && (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() =>
                  void patchOrder({
                    status: next,
                    stage_manual: next !== 'delivered',
                  })
                }
              >
                <Icon name="next" size={18} />
                {busy
                  ? 'Actualizando…'
                  : `Avanzar a ${ORDER_STATUS_LABELS[next]}`}
              </button>
            )}
          </div>
        </section>
      )}

      {actionError && (
        <p className="banner banner--error" role="alert">
          {actionError}
        </p>
      )}

      <div className="detail-grid">
        <OrderPieces
          key={piecesKey}
          orderId={order.id}
          items={items}
          post={post}
          busy={busy}
          onPost={(fields, label) =>
            void patchOrder(fields, { kind: 'postprocess', label })
          }
          onEditItems={() => openEdit(order.id, () => void reload())}
          onChanged={handlePiecesChanged}
        />

        <div className="detail-side">
          <OrderSummary
            order={order}
            items={items}
            today={today}
            channel={channel}
            onPay={registerPayment}
            paymentsKey={paymentsKey}
            onPaymentVoided={handlePaymentVoided}
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

          <OrderDesigns orderId={order.id} />

          <ActivityFeed orderId={order.id} refreshKey={activityKey} />
        </div>
      </div>
    </main>
  )
}

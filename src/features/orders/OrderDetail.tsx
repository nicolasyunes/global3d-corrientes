import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/domain-constants'
import { getOrder, updateOrder, type OrderWithCustomer } from './orders.api'
import { nextOrderStatus } from './status'
import { formatMoney } from './format'
import OrderForm from './OrderForm'
import OrderImages from './OrderImages'
import ProductionChecklist from './ProductionChecklist'
import StatusBadge from './StatusBadge'
import './orders.css'

// Order detail: view/edit through the shared OrderForm plus status progression
// (advance to the next enum step or cancel). The stored `pending_balance` is
// shown verbatim as the source of truth — never recomputed from total − deposit.
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getOrder(id)
      .then((row) => {
        if (!cancelled) setOrder(row)
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

  const refresh = useCallback(async () => {
    if (!id) return
    const row = await getOrder(id)
    setOrder(row)
  }, [id])

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateOrder(order.id, { status })
      // Merge the persisted row over the loaded one, preserving the customer
      // relation that `updateOrder` (which selects the order alone) does not
      // return.
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }

  function handleSaved() {
    // Re-read the row with its customer relation after an edit persists.
    void refresh()
  }

  if (loading) {
    return (
      <main className="order-detail">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-detail">
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

  return (
    <main className="order-detail">
      <header className="order-detail__header">
        <Link to="/admin/orders" className="link-btn back-link">
          Volver a pedidos
        </Link>
        <h1 className="order-detail__title">
          {order.customers?.name ?? 'Desconocido'}
        </h1>
        <div className="order-detail__status-row">
          <StatusBadge status={order.status} />
          <span className="order-detail__pending">
            Saldo pendiente: {formatMoney(order.pending_balance)}
          </span>
        </div>
        {order.reference_link && (
          <a
            href={order.reference_link}
            target="_blank"
            rel="noopener noreferrer"
            className="link-btn"
          >
            Ver producto ↗
          </a>
        )}
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
          <p className="status-actions__done">Este pedido está completo.</p>
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

      <ProductionChecklist orderId={order.id} />

      <OrderImages orderId={order.id} />

      <OrderForm key={order.id} initialOrder={order} onSaved={handleSaved} />
    </main>
  )
}

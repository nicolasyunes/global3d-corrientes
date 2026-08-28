import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, type OrderWithCustomer } from './orders.api'
import OrderForm from './OrderForm'
import StatusBadge from './StatusBadge'
import './orders.css'

// `/admin/orders/:id/editar` — the commercial/data screen. A thin loader
// around the shared OrderForm (edit mode): customer contact, money, payment
// method, channel, reference link, colours, items, measurements, notes.
// Production stage is deliberately NOT editable here — OrderProduction owns
// stage progression.
export default function OrderEdit() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setOrder(await getOrder(id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el pedido.',
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <main className="order-edit">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-edit">
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

  return (
    <main className="order-edit">
      <header className="order-edit__header">
        <Link to={`/admin/orders/${order.id}`} className="link-btn back-link">
          Volver a producción
        </Link>
        <p className="order-edit__customer">
          {order.customers?.name ?? 'Desconocido'}
        </p>
        <StatusBadge status={order.status} />
      </header>

      <OrderForm
        key={order.id}
        initialOrder={order}
        onSaved={() => void load()}
      />
    </main>
  )
}

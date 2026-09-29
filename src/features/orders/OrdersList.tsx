import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import OrderRow from '@/features/production/OrderRow'
import {
  listOrderProgress,
  type OrderProgress,
} from '@/features/production/production.api'
import '@/features/production/production.css'
import { addDaysISO } from './list'
import { useOrderModal } from './order-modal-context'
import {
  listOrderItemCounts,
  listOrders,
  updateOrder,
  type OrderWithCustomer,
} from './orders.api'
import OrdersBoard from './OrdersBoard'
import { nextOrderStatus } from './status'
import { toISODate } from './validation'

type View = 'list' | 'board'
type Filter = 'active' | 'week' | 'ready'

const VIEW_KEY = 'g3d.ordersView'
const CLOSED = ['finished', 'delivered', 'cancelled']

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list'
  } catch {
    return 'list'
  }
}

export function matchesSearch(
  order: OrderWithCustomer,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    order.customers?.name,
    order.title,
    order.description,
    order.personalization,
    order.customers?.phone,
  ]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q))
}

export default function OrdersList() {
  const { openNew } = useOrderModal()
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, OrderProgress>>({})
  const [view, setViewState] = useState<View>(readView)
  const [filter, setFilter] = useState<Filter>('active')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const today = useMemo(() => toISODate(new Date()), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrders(), listOrderItemCounts(), listOrderProgress()])
      .then(([rows, counts, prog]) => {
        if (cancelled) return
        setOrders(rows)
        setItemCounts(counts)
        setProgress(prog)
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los pedidos.',
          ),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  function setView(next: View) {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Storage blocked: the choice just isn't remembered.
    }
  }

  async function handleAdvance(order: OrderWithCustomer) {
    const next = nextOrderStatus(order.status)
    if (!next) return
    setAdvancingId(order.id)
    setError(null)
    try {
      const updated = await updateOrder(order.id, { status: next })
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setAdvancingId(null)
    }
  }

  const searched = useMemo(
    () => orders.filter((o) => matchesSearch(o, query)),
    [orders, query],
  )

  const rows = useMemo(() => {
    const byDue = (a: OrderWithCustomer, b: OrderWithCustomer) =>
      a.due_date.localeCompare(b.due_date)
    const active = searched.filter((o) => !CLOSED.includes(o.status))
    if (filter === 'ready')
      return searched.filter((o) => o.status === 'finished').sort(byDue)
    if (filter === 'week') {
      const horizon = addDaysISO(today, 7)
      return active.filter((o) => o.due_date <= horizon).sort(byDue)
    }
    return active.sort(byDue)
  }, [searched, filter, today])

  const counts = useMemo(() => {
    const horizon = addDaysISO(today, 7)
    const active = orders.filter((o) => !CLOSED.includes(o.status))
    return {
      active: active.length,
      week: active.filter((o) => o.due_date <= horizon).length,
      ready: orders.filter((o) => o.status === 'finished').length,
    }
  }, [orders, today])

  return (
    <main>
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Pedidos</h1>
        </div>
        <div className="page-head__actions">
          <div className="segmented" role="group" aria-label="Vista de pedidos">
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <Icon name="list" size={16} />
              Lista
            </button>
            <button
              type="button"
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              <Icon name="kanban" size={16} />
              Tablero
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary orders-list__new"
            onClick={openNew}
          >
            <Icon name="plus" />
            Nuevo pedido
          </button>
        </div>
      </header>

      <div className="orders-tools">
        <label className="orders-search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Buscar</span>
          <input
            type="search"
            placeholder="Buscar cliente, producto, detalle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {view === 'list' && (
          <div className="segmented" role="group" aria-label="Filtro">
            <button
              type="button"
              aria-pressed={filter === 'active'}
              onClick={() => setFilter('active')}
            >
              En curso <span className="count num">{counts.active}</span>
            </button>
            <button
              type="button"
              aria-pressed={filter === 'week'}
              onClick={() => setFilter('week')}
            >
              Esta semana <span className="count num">{counts.week}</span>
            </button>
            <button
              type="button"
              aria-pressed={filter === 'ready'}
              onClick={() => setFilter('ready')}
            >
              Listos <span className="count num">{counts.ready}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : view === 'board' ? (
        <OrdersBoard
          orders={searched}
          today={today}
          progress={progress}
          itemCounts={itemCounts}
          advancingId={advancingId}
          onAdvance={handleAdvance}
        />
      ) : rows.length === 0 ? (
        <div className="card empty">
          <strong>
            {query
              ? 'Ningún pedido coincide con la búsqueda'
              : 'No hay pedidos acá'}
          </strong>
          {query
            ? 'Probá con otra palabra.'
            : 'Tocá “Nuevo pedido” para cargar uno.'}
        </div>
      ) : (
        <section className="card">
          <ul className="order-rows" aria-label={`${rows.length} pedidos`}>
            {rows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                today={today}
                progress={progress[order.id]}
                itemCount={itemCounts[order.id]}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

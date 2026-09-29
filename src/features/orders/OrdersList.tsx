import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import OrderRow from '@/features/production/OrderRow'
import SortSelect, { useStoredSort } from '@/features/production/SortSelect'
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
import { isWaiting, needsReview, urgentFirst } from './orderFlow'
import WaitingOrders from './WaitingOrders'
import { nextOrderStatus } from './status'
import { toISODate } from './validation'

type View = 'list' | 'board'
type Filter = 'active' | 'week' | 'waiting' | 'ready'

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
  const [sort, setSort] = useStoredSort('g3d.ordersSort')
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

  // "En curso" = confirmed and open (flexible ones included, marked);
  // "Esta semana" = real deadlines only; "En espera" = not confirmed yet.
  const rows = useMemo(() => {
    const byDue = urgentFirst((a: OrderWithCustomer, b: OrderWithCustomer) =>
      sort === 'due'
        ? a.due_date.localeCompare(b.due_date)
        : (sort === 'newest' ? -1 : 1) *
          a.created_at.localeCompare(b.created_at),
    )
    const open = searched.filter((o) => !CLOSED.includes(o.status))
    const active = open.filter((o) => !isWaiting(o))
    if (filter === 'ready')
      return searched.filter((o) => o.status === 'finished').sort(byDue)
    if (filter === 'waiting')
      return open
        .filter(isWaiting)
        .sort(
          sort === 'due'
            ? (a, b) =>
                (a.follow_up_on ?? '').localeCompare(b.follow_up_on ?? '')
            : byDue,
        )
    if (filter === 'week') {
      const horizon = addDaysISO(today, 7)
      return active
        .filter((o) => o.urgent || (!o.flexible && o.due_date <= horizon))
        .sort(byDue)
    }
    return active.sort(byDue)
  }, [searched, filter, today, sort])

  const counts = useMemo(() => {
    const horizon = addDaysISO(today, 7)
    const open = orders.filter((o) => !CLOSED.includes(o.status))
    const active = open.filter((o) => !isWaiting(o))
    return {
      active: active.length,
      week: active.filter(
        (o) => o.urgent || (!o.flexible && o.due_date <= horizon),
      ).length,
      waiting: open.filter(isWaiting).length,
      review: open.filter((o) => needsReview(o, today)).length,
      ready: orders.filter((o) => o.status === 'finished').length,
    }
  }, [orders, today])

  function replaceOrder(updated: OrderWithCustomer) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

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
        {view === 'list' && <SortSelect value={sort} onChange={setSort} />}
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
              aria-pressed={filter === 'waiting'}
              onClick={() => setFilter('waiting')}
              title={
                counts.review
                  ? `${counts.review} para revisar hoy`
                  : 'Pedidos sin confirmar'
              }
            >
              En espera{' '}
              <span
                className={`count num${counts.review ? ' count--alert' : ''}`}
              >
                {counts.waiting}
              </span>
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
              : filter === 'waiting'
                ? 'Nada en espera'
                : 'No hay pedidos acá'}
          </strong>
          {query
            ? 'Probá con otra palabra.'
            : filter === 'waiting'
              ? 'Los pedidos sin confirmar (falta seña, diseño o respuesta) quedan acá hasta que los confirmes.'
              : 'Tocá “Nuevo pedido” para cargar uno.'}
        </div>
      ) : filter === 'waiting' ? (
        <section className="card">
          <WaitingOrders orders={rows} today={today} onChanged={replaceOrder} />
        </section>
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

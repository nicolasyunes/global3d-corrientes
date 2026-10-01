import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { orderTitle } from '@/features/production/OrderRow'
import SortSelect, { useStoredSort } from '@/features/production/SortSelect'
import {
  listOrderProgress,
  type OrderProgress,
} from '@/features/production/production.api'
import { logOrderEvent } from '@/features/production/workshop.api'
import '@/features/production/production.css'
import { formatMoney } from './format'
import { useOrderModal } from './order-modal-context'
import {
  listOrderItemCounts,
  listOrders,
  updateOrder,
  type OrderUpdate,
  type OrderWithCustomer,
} from './orders.api'
import OrdersBoard from './OrdersBoard'
import { needsReview, urgentFirst } from './orderFlow'
import { stageOf, type Stage } from './stage'
import {
  ClientAvatar,
  dueText,
  PartsBar,
  PostMarks,
  StageTag,
  UrgentBadge,
} from './stage-ui'
import WaitingOrders from './WaitingOrders'
import { toISODate } from './validation'
import './taller.css'

type View = 'list' | 'board'
type Filter = 'all' | Exclude<Stage, 'delivered' | 'cancelled'>

const VIEW_KEY = 'g3d.ordersView'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'on_hold', label: 'En espera' },
  { key: 'new', label: 'Sin empezar' },
  { key: 'printing', label: 'Imprimiendo' },
  { key: 'post_processing', label: 'Posprocesado' },
  { key: 'finished', label: 'Listo para avisar' },
]

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

// "Pedidos": the panorama. Every open order once, with the stage its pieces
// put it in. Table to scan, board to see where things pile up.
export default function OrdersList() {
  const { openNew } = useOrderModal()
  const { current } = useOperator()
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, OrderProgress>>({})
  const [view, setViewState] = useState<View>(readView)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useStoredSort('g3d.ordersSort')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
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

  function replaceOrder(updated: OrderWithCustomer) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  // Board actions (lijado, pintado, entregado). The database may move the
  // order to another stage, so the returned row replaces the local one.
  async function patchOrder(
    order: OrderWithCustomer,
    fields: OrderUpdate,
    event: string,
  ) {
    setBusyId(order.id)
    setError(null)
    try {
      await updateOrder(order.id, fields)
      // Stage changes are logged by the database itself.
      if (!fields.status)
        await logOrderEvent(order.id, current?.id ?? null, 'postprocess', event)
      const fresh = await listOrders()
      setOrders(fresh)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el cambio.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const searched = useMemo(
    () => orders.filter((o) => matchesSearch(o, query)),
    [orders, query],
  )
  const open = useMemo(
    () => searched.filter((o) => o.status !== 'delivered'),
    [searched],
  )

  const counts = useMemo(() => {
    const out: Record<Filter, number> = {
      all: 0,
      on_hold: 0,
      new: 0,
      printing: 0,
      post_processing: 0,
      finished: 0,
    }
    for (const o of orders) {
      if (o.status === 'delivered') continue
      out.all += 1
      out[stageOf(o) as Filter] += 1
    }
    return out
  }, [orders])
  const toReview = useMemo(
    () => orders.filter((o) => needsReview(o, today)).length,
    [orders, today],
  )

  const rows = useMemo(() => {
    const compare = urgentFirst((a: OrderWithCustomer, b: OrderWithCustomer) =>
      sort === 'due'
        ? a.due_date.localeCompare(b.due_date)
        : (sort === 'newest' ? -1 : 1) *
          a.created_at.localeCompare(b.created_at),
    )
    return open
      .filter((o) => filter === 'all' || stageOf(o) === filter)
      .sort(compare)
  }, [open, filter, sort])

  return (
    <main className="pn">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Panorama</p>
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
              Tabla
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
      </div>

      {view === 'list' ? (
        <div className="wk-chips pn-filters" role="group" aria-label="Etapa">
          {FILTERS.filter(
            (f) => f.key !== 'new' || counts.new > 0 || filter === 'new',
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              className="wk-chip"
              aria-pressed={filter === f.key}
              title={
                f.key === 'on_hold' && toReview
                  ? `${toReview} para revisar hoy`
                  : undefined
              }
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span
                className={`num${f.key === 'on_hold' && toReview ? ' is-alert' : ''}`}
              >
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="pn-note">
          Las tarjetas se mueven solas según el avance de sus partes.
        </p>
      )}

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
          busyId={busyId}
          onPatch={patchOrder}
        />
      ) : rows.length === 0 ? (
        <div className="card empty">
          <strong>
            {query
              ? 'Ningún pedido coincide con la búsqueda'
              : filter === 'on_hold'
                ? 'Nada en espera'
                : 'No hay pedidos acá'}
          </strong>
          {query
            ? 'Probá con otra palabra.'
            : filter === 'on_hold'
              ? 'Los pedidos sin confirmar (falta seña, diseño o respuesta) quedan acá hasta que los confirmes.'
              : 'Tocá “Nuevo pedido” para cargar uno.'}
        </div>
      ) : filter === 'on_hold' ? (
        <section className="card">
          <WaitingOrders orders={rows} today={today} onChanged={replaceOrder} />
        </section>
      ) : (
        <div className="pn-table" role="table" aria-label="Pedidos">
          <div className="pn-table__head" role="row">
            <span role="columnheader">Cliente y pedido</span>
            <span role="columnheader">Etapa</span>
            <span role="columnheader">Partes</span>
            <span role="columnheader">Posprocesado</span>
            <span role="columnheader">Entrega</span>
            <span role="columnheader">Total y saldo</span>
          </div>
          {rows.map((order) => {
            const stage = stageOf(order)
            const prog = progress[order.id]
            const due = dueText(order, today, {
              closed: stage === 'on_hold',
            })
            const balance = order.pending_balance ?? 0
            const total = order.total_amount ?? 0
            return (
              <Link
                key={order.id}
                to={`/admin/orders/${order.id}`}
                className={`pn-row${order.urgent ? ' pn-row--urgent' : ''}`}
                role="row"
              >
                <span className="pn-row__who">
                  <ClientAvatar name={order.customers?.name} />
                  <span className="pn-row__text">
                    <span className="pn-row__name">
                      <strong>{order.customers?.name ?? 'Sin cliente'}</strong>
                      {order.urgent && <UrgentBadge />}
                    </span>
                    <span className="pn-row__title">
                      {orderTitle(order, itemCounts[order.id])}
                    </span>
                  </span>
                </span>
                <span data-label="Etapa">
                  <StageTag stage={stage} />
                </span>
                <span data-label="Partes">
                  <PartsBar
                    printed={prog?.done ?? 0}
                    total={prog?.total ?? 0}
                  />
                </span>
                <span data-label="Posprocesado">
                  <PostMarks order={order} />
                </span>
                <span
                  data-label="Entrega"
                  className={`pn-row__due${due.late ? ' is-late' : ''}`}
                >
                  {due.label}
                </span>
                <span data-label="Total y saldo" className="pn-row__money">
                  {total > 0 ? (
                    <>
                      <strong className="num">{formatMoney(total)}</strong>
                      <small
                        className={`num ${balance > 0 ? 'is-owed' : 'is-paid'}`}
                      >
                        {balance > 0
                          ? `Debe ${formatMoney(balance)}`
                          : 'Pagado'}
                      </small>
                    </>
                  ) : (
                    <span className="num">—</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

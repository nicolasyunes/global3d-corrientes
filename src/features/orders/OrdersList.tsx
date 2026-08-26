import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_TYPE, PRODUCT_TYPE_LABELS, type ProductType } from '@/lib/domain-constants'
import {
  deleteOrder,
  listOrderItemCounts,
  listOrders,
  updateOrder,
  type OrderWithCustomer,
} from './orders.api'
import {
  emptyFilters,
  filterOrders,
  isOverdue,
  shapeOrders,
  type ListTab,
  type OrderFilters,
} from './list'
import { nextOrderStatus } from './status'
import { formatDueDate, formatMoney } from './format'
import { toISODate } from './validation'
import StatusBadge from './StatusBadge'
import OrdersKanban from './OrdersKanban'
import PendingSheetOrders from './PendingSheetOrders'
import QuickOrderRow from './QuickOrderRow'
import QuickOrderSheet from './QuickOrderSheet'
import './orders.css'

// How long the "Deshacer" toast stays up after a quick-capture save.
const UNDO_WINDOW_MS = 5000

type View = 'date' | 'kanban'
type Tab = ListTab | 'sheet'

// The `/admin/orders` landing view. Two ways to read the same queue: the
// due-date list (Pendientes/Próximos, for "what do I do right now") and a
// status Kanban board (for "what's the shop floor doing", one column per
// production stage). Both read the same fetched `orders` state — advancing a
// card in Kanban patches that state in place, so switching views never
// re-fetches or loses the change. The wordmark header lives in AdminLayout
// (single source); this view keeps only its sticky view/date tabs.
export default function OrdersList() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [view, setView] = useState<View>('date')
  const [tab, setTab] = useState<Tab>('pending')
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [justCreated, setJustCreated] = useState<OrderWithCustomer | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrders(), listOrderItemCounts()])
      .then(([rows, counts]) => {
        if (!cancelled) {
          setOrders(rows)
          setItemCounts(counts)
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los pedidos.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clears the pending undo timeout on unmount so it never fires (and calls
  // setState) after the view has gone away.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const today = useMemo(() => toISODate(new Date()), [])
  const partition = useMemo(() => shapeOrders(orders, today), [orders, today])
  const tabRows =
    tab === 'pending'
      ? partition.pending
      : tab === 'upcoming'
        ? partition.upcoming
        : []
  const rows = useMemo(
    () => (tab === 'sheet' ? tabRows : filterOrders(tabRows, filters)),
    [tab, tabRows, filters],
  )
  const filtersActive =
    filters.dueFrom !== '' ||
    filters.dueTo !== '' ||
    filters.productType !== '' ||
    filters.customerSearch !== ''

  function setFilter<K extends keyof OrderFilters>(
    field: K,
    value: OrderFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAdvance(order: OrderWithCustomer) {
    const next = nextOrderStatus(order.status)
    if (!next) return
    setAdvancingId(order.id)
    setAdvanceError(null)
    try {
      const updated = await updateOrder(order.id, { status: next })
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
      )
    } catch (err) {
      setAdvanceError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setAdvancingId(null)
    }
  }

  // Quick capture already awaited the save (see useQuickOrderDraft) — this
  // just reflects the persisted order into the list and arms the 5-second
  // undo window, matching the toolbar's existing status-advance pattern of
  // patching `orders` state in place rather than re-fetching.
  function handleQuickOrderCreated(order: OrderWithCustomer) {
    setOrders((prev) => [order, ...prev])
    setJustCreated(order)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setJustCreated(null), UNDO_WINDOW_MS)
  }

  async function handleUndoCreate() {
    if (!justCreated) return
    const id = justCreated.id
    setOrders((prev) => prev.filter((o) => o.id !== id))
    setJustCreated(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    try {
      await deleteOrder(id)
    } catch {
      // Best-effort: the row is already gone from view either way, and a
      // failed remote delete just leaves an orphaned order the operator can
      // remove from its detail page later.
    }
  }

  return (
    <main className="orders-list">
      <div className="orders-list__toolbar">
        <div className="view-toggle" aria-label="Vista de pedidos">
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'date'}
            onClick={() => setView('date')}
          >
            Lista
          </button>
          <button
            type="button"
            className="view-toggle__button"
            aria-pressed={view === 'kanban'}
            onClick={() => setView('kanban')}
          >
            Kanban
          </button>
        </div>

        {view === 'date' && (
          <nav className="tabs tabs--inline" aria-label="Fecha de entrega">
            <button
              type="button"
              className={`tab${tab === 'pending' ? ' tab--selected' : ''}`}
              aria-pressed={tab === 'pending'}
              onClick={() => setTab('pending')}
            >
              Pendientes
              <span className="tab__count">{partition.pending.length}</span>
            </button>
            <button
              type="button"
              className={`tab${tab === 'upcoming' ? ' tab--selected' : ''}`}
              aria-pressed={tab === 'upcoming'}
              onClick={() => setTab('upcoming')}
            >
              Próximos
              <span className="tab__count">{partition.upcoming.length}</span>
            </button>
            <button
              type="button"
              className={`tab${tab === 'sheet' ? ' tab--selected' : ''}`}
              aria-pressed={tab === 'sheet'}
              onClick={() => setTab('sheet')}
            >
              Planilla
            </button>
          </nav>
        )}
      </div>

      {justCreated && (
        <div className="undo-toast" role="status">
          <span className="undo-toast__text">
            Pedido guardado para {justCreated.customers?.name ?? 'el cliente'}.
          </span>
          <button
            type="button"
            className="link-btn link-btn--inline undo-toast__button"
            onClick={() => void handleUndoCreate()}
          >
            Deshacer
          </button>
        </div>
      )}

      {view === 'date' && tab !== 'sheet' && (
        <div className="orders-filters">
          <div className="field orders-filters__field">
            <label className="field__label" htmlFor="filter-due-from">
              Entrega desde
            </label>
            <input
              id="filter-due-from"
              className="field__input"
              type="date"
              value={filters.dueFrom}
              onChange={(e) => setFilter('dueFrom', e.target.value)}
            />
          </div>
          <div className="field orders-filters__field">
            <label className="field__label" htmlFor="filter-due-to">
              Entrega hasta
            </label>
            <input
              id="filter-due-to"
              className="field__input"
              type="date"
              value={filters.dueTo}
              onChange={(e) => setFilter('dueTo', e.target.value)}
            />
          </div>
          <div className="field orders-filters__field">
            <label className="field__label" htmlFor="filter-product-type">
              Producto
            </label>
            <select
              id="filter-product-type"
              className="field__input"
              value={filters.productType}
              onChange={(e) => setFilter('productType', e.target.value)}
            >
              <option value="">Todos</option>
              {PRODUCT_TYPE.map((type) => (
                <option key={type} value={type}>
                  {PRODUCT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="field orders-filters__field orders-filters__field--search">
            <label className="field__label" htmlFor="filter-customer">
              Cliente
            </label>
            <input
              id="filter-customer"
              className="field__input"
              type="text"
              placeholder="Buscar por nombre…"
              value={filters.customerSearch}
              onChange={(e) => setFilter('customerSearch', e.target.value)}
            />
          </div>
          {filtersActive && (
            <button
              type="button"
              className="link-btn orders-filters__clear"
              onClick={() => setFilters(emptyFilters())}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {view === 'date' && (
        <section className="quick-order-section">
          <h2 className="quick-order-section__title">Pedido rápido</h2>
          <QuickOrderRow onCreated={handleQuickOrderCreated} />
        </section>
      )}

      {loading && <p className="orders-list__status">Cargando…</p>}

      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {advanceError && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {advanceError}
        </p>
      )}

      {!loading &&
        !error &&
        view === 'date' &&
        tab !== 'sheet' &&
        rows.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">
              {filtersActive
                ? 'Ningún pedido coincide con los filtros'
                : tab === 'pending'
                  ? 'No hay pedidos pendientes'
                  : 'No hay pedidos próximos'}
            </p>
            <p className="empty-state__hint">
              {filtersActive
                ? 'Probá ajustar o limpiar los filtros.'
                : 'Tocá Pedido rápido para agregar uno.'}
            </p>
          </div>
        )}

      {view === 'date' && tab === 'sheet' && <PendingSheetOrders />}

      {!loading && !error && view === 'date' && tab !== 'sheet' && rows.length > 0 && (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Producto</th>
                <th scope="col">Entrega</th>
                <th scope="col">Estado</th>
                <th scope="col" className="orders-table__num">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order, index) => (
                <tr
                  key={order.id}
                  className={`orders-table__row${
                    index % 2 === 1 ? ' orders-table__row--alt' : ''
                  }${isOverdue(order, today) ? ' orders-table__row--overdue' : ''}`}
                >
                  <td>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="orders-table__link"
                    >
                      {order.customers?.name ?? 'Desconocido'}
                    </Link>
                  </td>
                  <td className="orders-table__muted">
                    {itemCounts[order.id] > 1
                      ? `${itemCounts[order.id]} ítems`
                      : PRODUCT_TYPE_LABELS[order.product_type as ProductType] ??
                        order.product_type}
                  </td>
                  <td
                    className={`orders-table__due${
                      isOverdue(order, today) ? ' orders-table__due--overdue' : ''
                    }`}
                  >
                    {formatDueDate(order.due_date, today)}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="orders-table__num orders-table__pending">
                    {formatMoney(order.pending_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && view === 'kanban' && (
        <OrdersKanban
          orders={orders}
          today={today}
          advancingId={advancingId}
          onAdvance={handleAdvance}
        />
      )}

      <div className="sticky-cta">
        <div className="sticky-cta__inner">
          {/* ≥900px: QuickOrderRow already covers capture inline, so this
              stays a direct link to the full form. <900px: QuickOrderRow is
              hidden (see orders.css), so this button opens QuickOrderSheet
              instead — CSS toggles which of the two renders. */}
          <Link
            to="/admin/orders/new"
            className="primary-btn sticky-cta__link"
          >
            Pedido rápido
          </Link>
          <button
            type="button"
            className="primary-btn sticky-cta__trigger"
            onClick={() => setSheetOpen(true)}
          >
            Pedido rápido
          </button>
        </div>
      </div>

      <QuickOrderSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleQuickOrderCreated}
      />
    </main>
  )
}

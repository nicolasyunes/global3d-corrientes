import { useEffect, useMemo, useState } from 'react'
import type { OrderSemaphore } from '@/lib/domain-constants'
import {
  appOrderToSheetRow,
  listPendingSheetOrders,
  mergeSheetOrders,
  type PendingSheetOrder,
} from './pendingSheet.api'
import { listAllOrders, type OrderWithCustomer } from './orders.api'
import {
  availableMonths,
  emptySheetFilters,
  filterSheetOrders,
  formatMonthLabel,
  type SheetFilters,
} from './sheetFilters'
import QuickOrderRow from './QuickOrderRow'
import QuickOrderSheet from './QuickOrderSheet'
import { formatMoney } from './format'
import { toISODate } from './validation'

// "Planilla" tab in /admin/orders — a mirror of the "Pedidos" Google Sheet
// (see supabase/functions/read-pending-orders/), showing every order the
// sheet knows about across its full lifecycle (pendiente, listo, entregado,
// cancelado), color-coded the same way as Pendientes/Próximos. Fetched
// lazily: only mounted once the operator opens this tab.
//
// It is also a capture surface: adding here creates a real app order (same
// path as "Pedido rápido"), which the sync-order-to-sheet trigger then pushes
// into the Google Sheet. The new row shows immediately (optimistically) and
// is replaced by the real synced row the next time the tab loads.
type SheetView = 'cards' | 'list'

// Mirrors getOrderSemaphore() in list.ts, but sourced from the sheet's own
// ESTADO text (Spanish, free-typed by the sync) instead of the app's
// OrderStatus enum — the sheet is a separate data source with its own shape.
function daysUntil(dateISO: string, today: string): number {
  const target = new Date(`${dateISO}T00:00:00Z`).getTime()
  const from = new Date(`${today}T00:00:00Z`).getTime()
  if (Number.isNaN(target)) return Infinity
  return Math.round((target - from) / 86_400_000)
}

function getSheetSemaphore(
  order: PendingSheetOrder,
  today: string,
): OrderSemaphore {
  const estado = order.estado.toLowerCase()
  if (estado === 'entregado') return 'delivered'
  if (estado === 'listo') return 'ready'
  if (daysUntil(order.fechaEntregaSortKey, today) <= 3) return 'urgent'
  return 'ok'
}

export default function PendingSheetOrders() {
  const [orders, setOrders] = useState<PendingSheetOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<SheetView>('list')
  const [filters, setFilters] = useState<SheetFilters>(emptySheetFilters)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listPendingSheetOrders(), listAllOrders()])
      .then(([sheetRows, appOrders]) => {
        if (!cancelled) setOrders(mergeSheetOrders(sheetRows, appOrders))
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la planilla de pendientes.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = toISODate(new Date())
  const months = useMemo(() => availableMonths(orders), [orders])
  const visibleOrders = useMemo(
    () => filterSheetOrders(orders, filters),
    [orders, filters],
  )

  // A quick-capture save already awaited the persisted order (see
  // useQuickOrderDraft) — prepend the sheet-shaped version so it's visible
  // right away; the sync trigger mirrors it into the actual sheet in the
  // background, and the next load folds it in from listAllOrders().
  function handleCreated(order: OrderWithCustomer) {
    setOrders((prev) => [
      appOrderToSheetRow(order),
      ...prev.filter((row) => row.id !== order.id),
    ])
  }

  return (
    <>
      <section className="quick-order-section">
        <h2 className="quick-order-section__title">Agregar a la planilla</h2>
        <QuickOrderRow onCreated={handleCreated} />
        <button
          type="button"
          className="primary-btn quick-order-section__mobile-trigger"
          onClick={() => setSheetOpen(true)}
        >
          Agregar pedido
        </button>
      </section>

      {loading && <p className="orders-list__status">Cargando…</p>}

      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="sheet-controls">
            <nav className="sheet-view-toggle" aria-label="Vista de planilla">
              <button
                type="button"
                className="view-toggle__button"
                aria-pressed={view === 'cards'}
                onClick={() => setView('cards')}
                title="Vista de cards"
              >
                ⊞
              </button>
              <button
                type="button"
                className="view-toggle__button"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                title="Vista de lista"
              >
                ≡
              </button>
            </nav>

            <div className="sheet-filters">
              <select
                className="sheet-filters__select"
                aria-label="Filtrar por mes de entrega"
                value={filters.month}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, month: e.target.value }))
                }
              >
                <option value="">Todos los meses</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
              <select
                className="sheet-filters__select"
                aria-label="Filtrar por estado"
                value={filters.estado}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    estado: e.target.value as SheetFilters['estado'],
                  }))
                }
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="listo">Listo</option>
                <option value="entregado">Entregado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">
                No hay pedidos en la planilla
              </p>
              <p className="empty-state__hint">
                Agregá uno arriba y va a aparecer acá y en la hoja de Google.
              </p>
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">
                Ningún pedido coincide con los filtros
              </p>
              <p className="empty-state__hint">
                Probá cambiar el mes o el estado.
              </p>
            </div>
          ) : (
            <>
              {view === 'cards' && (
                <ul className="pending-sheet">
                  {visibleOrders.map((order, index) => {
                    const semaphore = getSheetSemaphore(order, today)
                    return (
                      <li
                        key={`${order.nombre}-${index}`}
                        className={`pending-card pending-card--${semaphore}`}
                      >
                        <div className="pending-card__top">
                          <span className="pending-card__index">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="pending-card__customer">
                            {order.nombre}
                          </span>
                          {order.canal && (
                            <span className="pending-card__channel">
                              {order.canal}
                            </span>
                          )}
                        </div>

                        <div className="pending-card__product">
                          {order.producto}
                        </div>
                        {order.detalles && (
                          <p className="pending-card__details">
                            {order.detalles}
                          </p>
                        )}

                        <div className="pending-card__footer">
                          <span
                            className={`pending-card__due${semaphore === 'urgent' ? ' pending-card__due--urgent' : ''}`}
                          >
                            {order.fechaEntrega ?? 'Sin fecha'}
                          </span>
                          <span className="pending-card__amounts">
                            <span className="pending-card__total">
                              Total {formatMoney(order.total)}
                            </span>
                            <span className="pending-card__balance">
                              Saldo {formatMoney(order.saldo)}
                            </span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {view === 'list' && (
                <div className="sheet-table-wrap">
                  <table className="sheet-table">
                    <thead>
                      <tr>
                        <th scope="col" className="sheet-table__index-head">
                          N.º
                        </th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Canal</th>
                        <th scope="col">Producto</th>
                        <th scope="col">Detalles</th>
                        <th scope="col">Entrega</th>
                        <th scope="col" className="sheet-table__num">
                          Total
                        </th>
                        <th scope="col" className="sheet-table__num">
                          Saldo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order, index) => {
                        const semaphore = getSheetSemaphore(order, today)
                        return (
                          <tr
                            key={`${order.nombre}-${index}`}
                            className={`sheet-table__row sheet-table__row--${semaphore}${
                              semaphore === 'ok' && index % 2 === 1
                                ? ' sheet-table__row--alt'
                                : ''
                            }`}
                          >
                            <td className="sheet-table__index">
                              {String(index + 1).padStart(3, '0')}
                            </td>
                            <td className="sheet-table__customer">
                              {order.nombre}
                            </td>
                            <td className="sheet-table__muted">
                              {order.canal || '—'}
                            </td>
                            <td className="sheet-table__muted">
                              {order.producto}
                            </td>
                            <td
                              className="sheet-table__muted sheet-table__details"
                              title={order.detalles || undefined}
                            >
                              {order.detalles || '—'}
                            </td>
                            <td
                              className={`sheet-table__due${semaphore === 'urgent' ? ' sheet-table__due--urgent' : ''}`}
                            >
                              {order.fechaEntrega ?? 'Sin fecha'}
                            </td>
                            <td className="sheet-table__num">
                              {formatMoney(order.total)}
                            </td>
                            <td className="sheet-table__num">
                              {formatMoney(order.saldo)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      <QuickOrderSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </>
  )
}

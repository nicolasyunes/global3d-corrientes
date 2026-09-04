import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDeliveredOrders, type OrderWithCustomer } from './orders.api'
import {
  deleteProductSale,
  listProductSales,
  type ProductSaleRow,
} from './productSales.api'
import {
  groupVentasByMonth,
  toVentaRows,
  ventasTotal,
} from './deliveredOrders'
import ProductSaleSheet from './ProductSaleSheet'
import { formatDueDate, formatMoney } from './format'
import { toISODate } from './validation'
import './orders.css'
import './deliveredOrders.css'

// How long the "Deshacer" toast stays up after a direct-sale save (matches
// OrdersList's quick-capture undo window).
const UNDO_WINDOW_MS = 5000

// `/admin/ventas-pedidos`: the shop's realized revenue in one place —
// delivered orders plus direct product sales (something already in stock, sold
// on the spot, logged from the "Agregar venta" sheet). Separate from
// `/admin/ventas` (venta de insumos/filamento), a different revenue stream.
// Month filter mirrors OrdersList's Entrega range, one level coarser.
export default function DeliveredOrdersList() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [productSales, setProductSales] = useState<ProductSaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState('') // '' = every month
  const [sheetOpen, setSheetOpen] = useState(false)
  const [justCreated, setJustCreated] = useState<ProductSaleRow | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listDeliveredOrders(), listProductSales()])
      .then(([deliveredRows, saleRows]) => {
        if (!cancelled) {
          setOrders(deliveredRows)
          setProductSales(saleRows)
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las ventas de pedidos.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const today = useMemo(() => toISODate(new Date()), [])
  const rows = useMemo(
    () => toVentaRows(orders, productSales),
    [orders, productSales],
  )
  const groups = useMemo(() => groupVentasByMonth(rows), [rows])
  const selectedGroup = useMemo(
    () => groups.find((group) => group.month === month) ?? null,
    [groups, month],
  )
  const visibleRows = month === '' ? rows : selectedGroup?.rows ?? []
  const total = month === '' ? ventasTotal(rows) : selectedGroup?.total ?? 0

  // A just-created sale is only cleanly reversible when it isn't a catalog
  // sale — deleting the transaction won't restock, and the client can't write
  // products (admin-only). So the button only shows for free-text sales.
  const canUndo = justCreated !== null && justCreated.product_id === null

  function handleSaleCreated(sale: ProductSaleRow) {
    setProductSales((prev) => [sale, ...prev])
    setJustCreated(sale)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setJustCreated(null), UNDO_WINDOW_MS)
  }

  async function handleUndoCreate() {
    if (!justCreated) return
    const id = justCreated.id
    setProductSales((prev) => prev.filter((s) => s.id !== id))
    setJustCreated(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    try {
      await deleteProductSale(id)
    } catch {
      // Best-effort: the row is already gone from view; a failed remote delete
      // just leaves a stray transaction to remove later.
    }
  }

  return (
    <main className="orders-list">
      <div className="delivered-orders-actions">
        <button
          type="button"
          className="primary-btn delivered-orders-actions__add"
          onClick={() => setSheetOpen(true)}
        >
          Agregar venta
        </button>
      </div>

      {justCreated && (
        <div className="undo-toast" role="status">
          <span className="undo-toast__text">
            Venta de{' '}
            {justCreated.products?.name ?? justCreated.note ?? 'producto'}{' '}
            registrada.
          </span>
          {canUndo && (
            <button
              type="button"
              className="link-btn link-btn--inline undo-toast__button"
              onClick={() => void handleUndoCreate()}
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="orders-list__toolbar sales-toolbar delivered-orders-toolbar">
          <div className="field delivered-orders-toolbar__field">
            <label className="field__label" htmlFor="delivered-orders-month">
              Mes
            </label>
            <select
              id="delivered-orders-month"
              className="field__input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">Todos los meses</option>
              {groups.map((group) => (
                <option key={group.month} value={group.month}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          <div className="delivered-orders-stats">
            <span className="delivered-orders-stats__item">
              <span className="delivered-orders-stats__value">
                {visibleRows.length}
              </span>
              <span className="delivered-orders-stats__label">
                venta{visibleRows.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="delivered-orders-stats__item">
              <span className="delivered-orders-stats__value">
                {formatMoney(total)}
              </span>
              <span className="delivered-orders-stats__label">
                total vendido
              </span>
            </span>
          </div>
        </div>
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

      {!loading && !error && rows.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Todavía no hay ventas registradas</p>
          <p className="empty-state__hint">
            Una venta aparece acá cuando marcás un pedido como "Entregado" o
            cargás una venta directa con "Agregar venta".
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && visibleRows.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Ninguna venta ese mes</p>
        </div>
      )}

      {!loading && !error && visibleRows.length > 0 && (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Producto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Fecha</th>
                <th scope="col">Medio</th>
                <th scope="col" className="orders-table__num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  key={`${row.kind}-${row.id}`}
                  className={`orders-table__row${
                    index % 2 === 1 ? ' orders-table__row--alt' : ''
                  }`}
                >
                  <td>
                    {row.href ? (
                      <Link to={row.href} className="orders-table__link">
                        {row.customerName ?? 'Desconocido'}
                      </Link>
                    ) : (
                      <span className="orders-table__muted">
                        {row.customerName ?? 'Mostrador'}
                      </span>
                    )}
                  </td>
                  <td className="orders-table__muted">{row.productLabel}</td>
                  <td className="orders-table__muted">
                    {row.kind === 'order' ? 'Pedido' : 'Producto'}
                  </td>
                  <td className="orders-table__due">
                    {formatDueDate(row.date, today)}
                  </td>
                  <td className="orders-table__muted">
                    {row.channelLabel ?? '—'}
                  </td>
                  <td className="orders-table__num orders-table__pending">
                    {formatMoney(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductSaleSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleSaleCreated}
      />
    </main>
  )
}

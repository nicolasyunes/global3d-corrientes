import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
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
  type VentaRow,
} from './deliveredOrders'
import ProductSaleSheet from './ProductSaleSheet'
import { formatDueDate, formatMoney } from './format'
import { toISODate } from './validation'
import './deliveredOrders.css'

// How long the "Deshacer" option stays after a direct sale.
const UNDO_WINDOW_MS = 5000

function RowBody({
  row,
  today,
  showAmount,
}: {
  row: VentaRow
  today: string
  showAmount: boolean
}) {
  return (
    <>
      <span className={`drow__icon drow__icon--${row.kind}`} aria-hidden="true">
        <Icon name={row.kind === 'order' ? 'box' : 'receipt'} size={18} />
      </span>
      <span className="drow__main">
        <span className="drow__title">{row.productLabel}</span>
        <span className="drow__sub">
          {row.customerName ??
            (row.kind === 'order' ? 'Sin cliente' : 'Mostrador')}
          {' · '}
          {row.kind === 'order' ? 'Pedido' : 'Venta directa'}
          {row.channelLabel && ` · ${row.channelLabel}`}
        </span>
      </span>
      <span className="drow__side">
        {showAmount && (
          <span className="drow__amount num">{formatMoney(row.amount)}</span>
        )}
        <span className="drow__date">{formatDueDate(row.date, today)}</span>
      </span>
    </>
  )
}

// `/admin/ventas-pedidos`: what was actually sold — delivered orders plus
// direct sales of things already in stock ("Agregar venta"), by month.
export default function DeliveredOrdersList() {
  const { isAdmin } = useOperator()
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
        if (cancelled) return
        setOrders(deliveredRows)
        setProductSales(saleRows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las ventas.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    },
    [],
  )

  const today = useMemo(() => toISODate(new Date()), [])
  const rows = useMemo(
    () => toVentaRows(orders, productSales),
    [orders, productSales],
  )
  const groups = useMemo(() => groupVentasByMonth(rows), [rows])
  const visibleGroups =
    month === '' ? groups : groups.filter((g) => g.month === month)
  const visibleRows = visibleGroups.flatMap((g) => g.rows)
  const total = ventasTotal(visibleRows)
  const orderCount = visibleRows.filter((r) => r.kind === 'order').length

  // Only a free-text sale is cleanly reversible: deleting a saved-product
  // sale would not put the stock back.
  const canUndo = justCreated !== null && justCreated.product_id === null

  function handleSaleCreated(sale: ProductSaleRow) {
    setProductSales((prev) => [sale, ...prev])
    setJustCreated(sale)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(
      () => setJustCreated(null),
      UNDO_WINDOW_MS,
    )
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
      // Best-effort: already gone from view.
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Entregados y ventas</h1>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setSheetOpen(true)}
          >
            <Icon name="plus" size={18} />
            Agregar venta
          </button>
        </div>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Cargando…</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="empty card">
          <strong>Todavía no hay ventas</strong>
          Aparecen acá cuando un pedido pasa a “Entregado” o cuando cargás una
          venta directa.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="dstats">
            {isAdmin && (
              <div className="dstat dstat--total">
                <span className="dstat__label">Total vendido</span>
                <span className="dstat__value num">{formatMoney(total)}</span>
              </div>
            )}
            <div className="dstat">
              <span className="dstat__label">Pedidos entregados</span>
              <span className="dstat__value num">{orderCount}</span>
            </div>
            <div className="dstat">
              <span className="dstat__label">Ventas directas</span>
              <span className="dstat__value num">
                {visibleRows.length - orderCount}
              </span>
            </div>
          </div>

          <div className="chips dmonths" role="group" aria-label="Mes">
            <button
              type="button"
              className="chip"
              aria-pressed={month === ''}
              onClick={() => setMonth('')}
            >
              Todos
            </button>
            {groups.map((g) => (
              <button
                key={g.month}
                type="button"
                className="chip"
                aria-pressed={month === g.month}
                onClick={() => setMonth(month === g.month ? '' : g.month)}
              >
                {g.label}
              </button>
            ))}
          </div>

          {visibleGroups.map((group) => (
            <section key={group.month} className="dmonth">
              <header className="dmonth__head">
                <h2>{group.label}</h2>
                {isAdmin && (
                  <span className="num">{formatMoney(group.total)}</span>
                )}
              </header>
              <ul className="card drows">
                {group.rows.map((row) => (
                  <li key={`${row.kind}-${row.id}`}>
                    {row.href ? (
                      <Link to={row.href} className="drow">
                        <RowBody row={row} today={today} showAmount={isAdmin} />
                      </Link>
                    ) : (
                      <div className="drow">
                        <RowBody row={row} today={today} showAmount={isAdmin} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {justCreated && (
        <div className="toast" role="status">
          <Icon name="check" />
          Venta de{' '}
          {justCreated.products?.name ?? justCreated.note ?? 'producto'}{' '}
          registrada.
          {canUndo && (
            <button
              type="button"
              className="toast__action"
              onClick={() => void handleUndoCreate()}
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      <ProductSaleSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleSaleCreated}
      />
    </>
  )
}

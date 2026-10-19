import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { formatMoney } from '@/features/orders/format'
import { colorSwatch } from '@/features/production/pieces'
import {
  listAllParts,
  listProducts,
  moveProductStock,
  type ProductRow,
} from './products.api'
import { emptyProductFilter, filterProducts, type ProductFilter } from './list'
import { partsSummary, type PartLine } from './parts'
import '@/features/production/production.css'
import './products.css'

// `/admin/productos`: los productos que se repiten, con sus piezas. Tocar uno
// abre la ficha; el stock se ajusta desde la fila.
export default function ProductsList() {
  const { current, isAdmin } = useOperator()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [parts, setParts] = useState<Record<string, PartLine[]>>({})
  const [filter, setFilter] = useState<ProductFilter>(emptyProductFilter())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listProducts(), listAllParts()])
      .then(([rows, byProduct]) => {
        setProducts(rows)
        setParts(byProduct)
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los productos.',
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(
    () => filterProducts(products, filter),
    [products, filter],
  )

  // Siempre por la base (suma o resta atómica): deja en el registro quién fue.
  async function moveStock(product: ProductRow, delta: number) {
    if (!current) return
    if (product.stock_quantity + delta < 0) return
    setBusyId(product.id)
    setError(null)
    try {
      const saved = await moveProductStock(product.id, delta, current.id)
      setProducts((rows) => rows.map((r) => (r.id === saved.id ? saved : r)))
    } catch {
      setError('No se pudo guardar el stock.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Productos guardados</h1>
          <p className="muted">
            Lo que se repite: cada producto sabe qué piezas lleva y de qué
            color, así el checklist del pedido se arma solo.
          </p>
        </div>
        <div className="page-head__actions">
          {isAdmin && (
            <Link to="/admin/productos/movimientos" className="btn btn--ghost">
              <Icon name="list" size={18} />
              Movimientos
            </Link>
          )}
          <Link to="/admin/productos/nuevo" className="btn btn--primary">
            <Icon name="plus" size={18} />
            Nuevo producto
          </Link>
        </div>
      </div>

      <div className="orders-tools">
        <label className="orders-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            value={filter.query}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, query: e.target.value }))
            }
          />
        </label>
        <button
          type="button"
          className="chip"
          aria-pressed={filter.activeOnly}
          onClick={() =>
            setFilter((prev) => ({ ...prev, activeOnly: !prev.activeOnly }))
          }
        >
          Solo activos
        </button>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Cargando…</p>}

      {!loading && !error && products.length === 0 && (
        <div className="empty">
          <p>
            <strong>Todavía no hay productos guardados</strong>
          </p>
          <p className="muted">
            Cargá los que más se repiten (ej: Vaso milkshake Spiderman) con sus
            piezas y colores.
          </p>
        </div>
      )}

      {!loading && products.length > 0 && visible.length === 0 && (
        <div className="empty">
          <p className="muted">Ningún producto coincide con la búsqueda.</p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="card prod-rows">
          {visible.map((product) => {
            const list = parts[product.id] ?? []
            return (
              <li
                key={product.id}
                className={`prow${product.active ? '' : ' prow--off'}`}
              >
                <Link
                  to={`/admin/productos/${product.id}`}
                  className="prow__main"
                >
                  <span className="prow__thumb" aria-hidden="true">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" />
                    ) : (
                      <Icon name="box" size={20} />
                    )}
                  </span>
                  <span className="prow__info">
                    <span className="prow__name">
                      {product.name}
                      {!product.active && (
                        <span className="badge">Inactivo</span>
                      )}
                    </span>
                    <span className="prow__parts">
                      {list.slice(0, 8).map((p, i) => {
                        const hex = colorSwatch(p.color)
                        return (
                          <span
                            key={i}
                            className={`swatch${hex ? '' : ' swatch--unknown'}`}
                            style={hex ? { background: hex } : undefined}
                            title={`${p.label}${p.color ? ` · ${p.color}` : ''}`}
                          />
                        )
                      })}
                      <span className={list.length ? 'muted' : 'prow__noparts'}>
                        {partsSummary(list)}
                      </span>
                    </span>
                  </span>
                  {isAdmin && (
                    <span className="prow__price num">
                      {product.base_price === null
                        ? '—'
                        : formatMoney(product.base_price)}
                    </span>
                  )}
                </Link>
                <div className="prow__stock" aria-label="Stock armado">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Restar stock de ${product.name}`}
                    disabled={
                      busyId === product.id || product.stock_quantity <= 0
                    }
                    onClick={() => void moveStock(product, -1)}
                  >
                    −
                  </button>
                  <span className="num" title="Stock armado">
                    {product.stock_quantity}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Sumar stock de ${product.name}`}
                    disabled={busyId === product.id}
                    onClick={() => void moveStock(product, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

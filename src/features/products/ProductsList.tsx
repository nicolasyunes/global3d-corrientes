import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@/features/orders/format'
import { listProducts, type ProductRow } from './products.api'
import {
  emptyProductFilter,
  filterProducts,
  stockLevel,
  type ProductFilter,
} from './list'
import '@/features/orders/orders.css'
import './products.css'

const STOCK_LEVEL_LABEL: Record<ReturnType<typeof stockLevel>, string> = {
  out: 'Sin stock',
  low: 'Stock bajo',
  ok: 'Stock',
}

// `/admin/productos`: the DB-backed catalog (stock/pricing/image master
// data), reusing OrdersList's row/empty-state visual pattern. A search +
// active-only filter and a stock-health summary sit above the list so a
// growing catalog stays scannable — the count strip doubles as an at-a-glance
// "what needs restocking" view. Separate from the storefront's static
// catalog (src/features/storefront/data) — that wiring is a later step.
export default function ProductsList() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [filter, setFilter] = useState<ProductFilter>(emptyProductFilter())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar los productos.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => filterProducts(products, filter), [products, filter])
  const outOfStock = useMemo(
    () => products.filter((p) => stockLevel(p) === 'out').length,
    [products],
  )
  const lowStock = useMemo(
    () => products.filter((p) => stockLevel(p) === 'low').length,
    [products],
  )

  return (
    <main className="orders-list">
      <div className="orders-list__toolbar products-toolbar">
        <input
          type="search"
          className="field__input products-toolbar__search"
          placeholder="Buscar producto…"
          value={filter.query}
          onChange={(e) => setFilter((prev) => ({ ...prev, query: e.target.value }))}
          aria-label="Buscar producto"
        />
        <button
          type="button"
          className={`chip${filter.activeOnly ? ' chip--selected' : ''}`}
          aria-pressed={filter.activeOnly}
          onClick={() =>
            setFilter((prev) => ({ ...prev, activeOnly: !prev.activeOnly }))
          }
        >
          Solo activos
        </button>
        {!loading && !error && products.length > 0 && (
          <div className="products-summary">
            <span className="products-summary__item">
              {products.length} producto{products.length === 1 ? '' : 's'}
            </span>
            {lowStock > 0 && (
              <span className="products-summary__item products-summary__item--low">
                {lowStock} con stock bajo
              </span>
            )}
            {outOfStock > 0 && (
              <span className="products-summary__item products-summary__item--out">
                {outOfStock} sin stock
              </span>
            )}
          </div>
        )}
      </div>

      {loading && <p className="orders-list__status">Cargando…</p>}

      {error && (
        <p className="form-banner form-banner--error orders-list__status" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Todavía no hay productos</p>
          <p className="empty-state__hint">Tocá Nuevo producto para agregar uno.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Ningún producto coincide</p>
          <p className="empty-state__hint">Probá con otra búsqueda o quitá el filtro.</p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="orders-list__rows">
          {visible.map((product) => {
            const level = stockLevel(product)
            return (
              <li key={product.id}>
                <Link to={`/admin/productos/${product.id}`} className="order-row">
                  <div className="product-row__thumb">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" />
                    ) : (
                      <span aria-hidden="true">Sin foto</span>
                    )}
                  </div>
                  <div className="order-row__main">
                    <span className="order-row__customer">
                      {product.name}
                      {!product.active && (
                        <span className="badge product-row__inactive">Inactivo</span>
                      )}
                    </span>
                    <span className="order-row__product">{formatMoney(product.base_price)}</span>
                  </div>
                  <div className="order-row__meta">
                    <span
                      className={`badge${level !== 'ok' ? ` product-row__stock--${level}` : ''}`}
                    >
                      {STOCK_LEVEL_LABEL[level]}: {product.stock_quantity}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky-cta">
        <div className="sticky-cta__inner">
          <Link to="/admin/productos/nuevo" className="primary-btn">
            Nuevo producto
          </Link>
        </div>
      </div>
    </main>
  )
}

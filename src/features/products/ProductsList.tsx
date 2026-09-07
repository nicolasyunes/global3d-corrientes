import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatMoney } from '@/features/orders/format'
import {
  bulkUpdateProducts,
  createProduct,
  listCategories,
  listProducts,
  updateProduct,
  type CategoryRow,
  type ProductRow,
} from './products.api'
import { slugify } from './catalog-taxonomy'
import {
  emptyProductFilter,
  filterProducts,
  stockLevel,
  type ProductFilter,
} from './list'
import { parseNonNegativeDecimal } from './validation'
import '@/features/orders/orders.css'
import './products.css'

const STOCK_LEVEL_LABEL: Record<ReturnType<typeof stockLevel>, string> = {
  out: 'Sin stock',
  low: 'Stock bajo',
  ok: 'Stock',
}

// `/admin/productos`: grilla de carga rápida. Edición inline con autosave al
// blur (mismo patrón que InsumosList), fila de alta rápida que queda abierta
// para seguir cargando, y acciones masivas sobre las filas tildadas. El detalle
// (medios, descripción, variantes) vive en el editor de una página (/:id).
export default function ProductsList() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [filter, setFilter] = useState<ProductFilter>(emptyProductFilter())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState({
    name: '',
    price: '',
    categoryId: '',
  })
  const [savingQuick, setSavingQuick] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([listProducts(), listCategories()])
      .then(([rows, cats]) => {
        setProducts(rows)
        setCategories(cats)
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los productos.',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const visible = useMemo(
    () => filterProducts(products, filter),
    [products, filter],
  )
  const outOfStock = useMemo(
    () => products.filter((p) => stockLevel(p) === 'out').length,
    [products],
  )
  const lowStock = useMemo(
    () => products.filter((p) => stockLevel(p) === 'low').length,
    [products],
  )
  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? '—') : '—'

  async function patchRow(id: string, patch: Partial<ProductRow>) {
    setBusyId(id)
    setError(null)
    const prev = products
    setProducts((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
    try {
      await updateProduct(id, patch)
    } catch {
      setProducts(prev)
      setError('No se pudo guardar el cambio.')
    } finally {
      setBusyId(null)
    }
  }

  function commitPrice(product: ProductRow, raw: string) {
    const parsed = raw.trim() === '' ? null : parseNonNegativeDecimal(raw)
    if (raw.trim() !== '' && parsed === null) return
    if (parsed === product.base_price) return
    void patchRow(product.id, { base_price: parsed })
  }

  function commitStock(product: ProductRow, raw: string) {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n === product.stock_quantity) return
    void patchRow(product.id, { stock_quantity: n })
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBulk(patch: Partial<ProductRow>) {
    const ids = [...selected]
    if (ids.length === 0) return
    setError(null)
    try {
      await bulkUpdateProducts(ids, patch)
      setSelected(new Set())
      load()
    } catch {
      setError('No se pudo aplicar la acción masiva.')
    }
  }

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault()
    const name = quickAdd.name.trim()
    if (name === '') return
    setSavingQuick(true)
    setError(null)
    try {
      const created = await createProduct({
        name,
        slug: slugify(name),
        base_price: parseNonNegativeDecimal(quickAdd.price),
        stock_quantity: 0,
        category_id: quickAdd.categoryId || null,
        active: true,
      })
      setProducts((rows) => [created, ...rows])
      setQuickAdd({ name: '', price: '', categoryId: quickAdd.categoryId })
    } catch {
      setError('No se pudo crear el producto.')
    } finally {
      setSavingQuick(false)
    }
  }

  return (
    <main className="orders-list">
      <div className="orders-list__toolbar products-toolbar">
        <input
          type="search"
          className="field__input products-toolbar__search"
          placeholder="Buscar producto…"
          value={filter.query}
          onChange={(e) =>
            setFilter((prev) => ({ ...prev, query: e.target.value }))
          }
          aria-label="Buscar producto"
        />
        <select
          className="field__input"
          aria-label="Filtrar por categoría"
          value={filter.categoryId ?? ''}
          onChange={(e) =>
            setFilter((prev) => ({ ...prev, categoryId: e.target.value }))
          }
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
        <button
          type="button"
          className="products-toolbar__add"
          onClick={() => setQuickAddOpen((v) => !v)}
        >
          + Producto
        </button>
        <Link to="/admin/productos/nuevo" className="link-btn link-btn--inline">
          Nuevo producto (detalle)
        </Link>
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

      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {selected.size > 0 && (
        <div className="product-bulkbar">
          <span>{selected.size} seleccionados</span>
          <button
            type="button"
            className="chip"
            onClick={() => void runBulk({ active: true })}
          >
            Activar
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => void runBulk({ active: false })}
          >
            Desactivar
          </button>
          <select
            className="field__input"
            aria-label="Asignar categoría a la selección"
            value=""
            onChange={(e) => {
              if (e.target.value) void runBulk({ category_id: e.target.value })
            }}
          >
            <option value="">Asignar categoría…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {quickAddOpen && (
        <form
          className="product-quickadd"
          data-testid="quick-add-form"
          onSubmit={handleQuickAdd}
        >
          <input
            className="field__input"
            placeholder="Nombre"
            aria-label="Nombre del nuevo producto"
            value={quickAdd.name}
            onChange={(e) =>
              setQuickAdd((q) => ({ ...q, name: e.target.value }))
            }
          />
          <input
            className="field__input"
            placeholder="Precio"
            inputMode="decimal"
            aria-label="Precio del nuevo producto"
            value={quickAdd.price}
            onChange={(e) =>
              setQuickAdd((q) => ({ ...q, price: e.target.value }))
            }
          />
          <select
            className="field__input"
            aria-label="Categoría del nuevo producto"
            value={quickAdd.categoryId}
            onChange={(e) =>
              setQuickAdd((q) => ({ ...q, categoryId: e.target.value }))
            }
          >
            <option value="">— sin categoría —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-btn" disabled={savingQuick}>
            {savingQuick ? 'Agregando…' : 'Agregar'}
          </button>
        </form>
      )}

      {loading && <p className="orders-list__status">Cargando…</p>}

      {!loading && !error && products.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Todavía no hay productos</p>
          <p className="empty-state__hint">Tocá + Producto para agregar uno.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Ningún producto coincide</p>
          <p className="empty-state__hint">
            Probá con otra búsqueda o quitá el filtro.
          </p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <div className="product-grid__head" aria-hidden="true">
            <span />
            <span />
            <span>Producto</span>
            <span>Precio</span>
            <span>Stock</span>
            <span>Estado</span>
            <span>Activo</span>
          </div>
          <div className="product-grid">
            {visible.map((product) => {
              const level = stockLevel(product)
              return (
                <div
                  key={product.id}
                  className={`product-grid__row${level !== 'ok' ? ` product-grid__row--${level}` : ''}`}
                >
                  <input
                    type="checkbox"
                    className="product-grid__select"
                    aria-label={`Seleccionar ${product.name}`}
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelected(product.id)}
                  />
                  <div className="product-row__thumb">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" />
                    ) : (
                      <span aria-hidden="true">Sin foto</span>
                    )}
                  </div>
                  <div className="product-row__info">
                    <Link
                      to={`/admin/productos/${product.id}`}
                      className="product-row__name"
                    >
                      {product.name}
                      {!product.active && (
                        <span className="badge product-row__inactive">
                          Inactivo
                        </span>
                      )}
                    </Link>
                    <span className="product-row__category">
                      {catName(product.category_id)}
                    </span>
                  </div>
                  <div className="product-row__price">
                    <span className="product-row__price-prefix" aria-hidden="true">
                      $
                    </span>
                    <input
                      className="field__input product-grid__cell-input"
                      aria-label={`Precio de ${product.name}`}
                      defaultValue={
                        product.base_price === null
                          ? ''
                          : String(product.base_price)
                      }
                      inputMode="decimal"
                      onBlur={(e) => commitPrice(product, e.target.value)}
                      disabled={busyId === product.id}
                    />
                  </div>
                  <div className="product-stepper">
                    <button
                      type="button"
                      className="product-stepper__btn"
                      aria-label={`Restar stock de ${product.name}`}
                      disabled={
                        busyId === product.id || product.stock_quantity <= 0
                      }
                      onClick={() =>
                        void patchRow(product.id, {
                          stock_quantity: Math.max(
                            0,
                            product.stock_quantity - 1,
                          ),
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      className="field__input product-grid__cell-input"
                      aria-label={`Stock de ${product.name}`}
                      defaultValue={String(product.stock_quantity)}
                      inputMode="numeric"
                      onBlur={(e) => commitStock(product, e.target.value)}
                      disabled={busyId === product.id}
                    />
                    <button
                      type="button"
                      className="product-stepper__btn"
                      aria-label={`Sumar stock de ${product.name}`}
                      disabled={busyId === product.id}
                      onClick={() =>
                        void patchRow(product.id, {
                          stock_quantity: product.stock_quantity + 1,
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  <span
                    className={`badge product-row__stock-badge${level !== 'ok' ? ` product-row__stock--${level}` : ''}`}
                  >
                    {STOCK_LEVEL_LABEL[level]}
                  </span>
                  <label className="product-grid__active">
                    <input
                      type="checkbox"
                      aria-label={`Activo: ${product.name}`}
                      checked={product.active}
                      onChange={(e) =>
                        void patchRow(product.id, { active: e.target.checked })
                      }
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </>
      )}

      <p className="product-editor__hint">
        {formatMoney(visible.reduce((sum, p) => sum + (p.base_price ?? 0), 0))}{' '}
        en precio de lista ({visible.length} visibles)
      </p>
    </main>
  )
}

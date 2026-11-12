import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { formatMoney } from '@/features/orders/format'
import { colorSwatch } from '@/features/production/pieces'
import {
  listAllParts,
  listProductCatalog,
  listProducts,
  moveProductStock,
  type ProductCatalogInfo,
  type ProductFamilyInfo,
  type ProductRow,
} from './products.api'
import {
  activeFilterCount,
  filterFromParams,
  filterProducts,
  filterToParams,
  NO_FAMILY,
  stockStatus,
  type ProductFilter,
} from './list'
import { partsSummary, type PartLine } from './parts'
import '@/features/production/production.css'
import './products.css'

/** Espera desde la última tecla antes de filtrar. */
export const SEARCH_DELAY = 250

const SALE_MODE_LABEL: Record<string, string> = {
  stock: 'Venta con stock',
  a_pedido: 'A pedido',
  cotizacion: 'A cotizar',
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className={`pfilter${value && value !== 'all' ? ' is-set' : ''}`}>
      <span className="pfilter__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

// `/admin/productos`: los productos que se repiten, con sus piezas. Tocar uno
// abre la ficha; el stock se ajusta desde la fila. La actividad está en
// `/admin/actividad`.
export default function ProductsList() {
  const { current, isAdmin } = useOperator()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [parts, setParts] = useState<Record<string, PartLine[]>>({})
  const [catalog, setCatalog] = useState<Record<string, ProductCatalogInfo>>({})
  const [families, setFamilies] = useState<ProductFamilyInfo[]>([])
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => filterFromParams(params), [params])
  // Lo que se va escribiendo; pasa al filtro (y a la URL) con debounce.
  const [text, setText] = useState(filter.query)
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
    // Familias y ML suman filtros; si fallan, la lista igual se ve.
    listProductCatalog()
      .then((c) => {
        setCatalog(c.byProduct)
        setFamilies(c.families)
      })
      .catch(() => setCatalogFailed(true))
  }, [])

  function setFilter(patch: Partial<ProductFilter>) {
    setParams(filterToParams({ ...filter, ...patch }), { replace: true })
  }

  useEffect(() => {
    if (text === filter.query) return
    const t = window.setTimeout(
      () =>
        setParams(
          (prev) =>
            filterToParams({ ...filterFromParams(prev), query: text.trim() }),
          { replace: true },
        ),
      SEARCH_DELAY,
    )
    return () => window.clearTimeout(t)
  }, [text, filter.query, setParams])

  function clearFilters() {
    setText('')
    setParams(new URLSearchParams(), { replace: true })
  }

  const categories = useMemo(
    () => [...new Set(families.map((f) => f.category))].sort(),
    [families],
  )
  const familyOptions = useMemo(
    () =>
      filter.category && filter.category !== NO_FAMILY
        ? families.filter((f) => f.category === filter.category)
        : families,
    [families, filter.category],
  )

  const visible = useMemo(
    () => filterProducts(products, filter, catalog),
    [products, filter, catalog],
  )
  const filterCount = activeFilterCount(filter) + (filter.query ? 1 : 0)

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

      <div className="card pfilters">
        <label className="orders-search pfilters__search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar por producto, familia, slug o descripción…"
            aria-label="Buscar producto"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="pfilters__grid">
          <FilterSelect
            label="Categoría"
            value={filter.category}
            onChange={(category) => setFilter({ category, family: '' })}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {capitalize(c)}
              </option>
            ))}
            <option value={NO_FAMILY}>Sin familia</option>
          </FilterSelect>
          <FilterSelect
            label="Familia"
            value={filter.family}
            onChange={(family) => setFilter({ family })}
          >
            <option value="">Todas</option>
            {familyOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={NO_FAMILY}>Sin familia</option>
          </FilterSelect>
          <FilterSelect
            label="Estado"
            value={filter.active}
            onChange={(v) =>
              setFilter({ active: v as ProductFilter['active'] })
            }
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </FilterSelect>
          <FilterSelect
            label="Stock"
            value={filter.stock}
            onChange={(v) => setFilter({ stock: v as ProductFilter['stock'] })}
          >
            <option value="all">Todos</option>
            <option value="con_stock">Con stock</option>
            <option value="sin_stock">Sin stock</option>
            <option value="a_pedido">A pedido (se fabrica)</option>
          </FilterSelect>
          <FilterSelect
            label="MercadoLibre"
            value={filter.ml}
            onChange={(v) => setFilter({ ml: v as ProductFilter['ml'] })}
          >
            <option value="all">Todos</option>
            <option value="published">Publicado</option>
            <option value="active">Publicado y activo</option>
            <option value="paused">Publicado y pausado</option>
            <option value="none">Sin publicar</option>
          </FilterSelect>
          <FilterSelect
            label="Modo de venta"
            value={filter.saleMode}
            onChange={(saleMode) => setFilter({ saleMode })}
          >
            <option value="">Todos</option>
            {Object.entries(SALE_MODE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value={NO_FAMILY}>Sin familia</option>
          </FilterSelect>
        </div>
        <div className="pfilters__foot">
          <span className="muted" aria-live="polite">
            {loading
              ? 'Cargando…'
              : filterCount
                ? `${visible.length} de ${products.length} productos`
                : `${products.length} productos`}
          </span>
          {catalogFailed && (
            <span className="muted">
              · No se pudieron cargar familias ni MercadoLibre.
            </span>
          )}
          {(filterCount > 0 || text) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

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
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="card prod-rows">
          {visible.map((product) => {
            const list = parts[product.id] ?? []
            const info = catalog[product.id]
            const status = stockStatus(product, info)
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
                    <span className="prow__tags">
                      {info?.family && (
                        <span className="muted">{info.family.name}</span>
                      )}
                      {info?.mlStatus === 'active' && (
                        <span className="badge badge--ready">ML activo</span>
                      )}
                      {info?.mlStatus && info.mlStatus !== 'active' && (
                        <span className="badge">ML pausado</span>
                      )}
                      {status === 'a_pedido' && (
                        <span className="badge badge--new">
                          A pedido
                          {info?.family?.leadDays
                            ? ` · ${info.family.leadDays} días`
                            : ''}
                        </span>
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
                  <span className="prow__price num">
                    {product.base_price === null
                      ? '—'
                      : formatMoney(product.base_price)}
                  </span>
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

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { BRAND_LIST, PRODUCTS } from './data/products'
import { CATEGORY_ALIASES, THEME_LABELS, findNav } from './navigation'
import {
  PRICE_BUCKETS,
  filterProducts,
  type CapacityValue,
  type PriceBucket,
  type SortValue,
} from './filter'
import { useMediaQuery } from './useMediaQuery'
import CustomOrderCTA from './CustomOrderCTA'
import ProductCard from './ProductCard'

const CAPACITY_OPTIONS: { key: CapacityValue; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: '500ml', label: '500 ml' },
  { key: '650ml', label: '650 ml' },
  { key: '1L', label: '1 litro' },
]

export default function CategoryPage() {
  const navigate = useNavigate()
  const { slug = 'todas' } = useParams()
  const [searchParams] = useSearchParams()

  const aliasTarget = slug !== 'todas' && CATEGORY_ALIASES[slug] ? CATEGORY_ALIASES[slug] : null
  const effSlug = aliasTarget ?? slug

  const search = searchParams.get('q') || ''
  const activeCategory = search ? 'all' : effSlug === 'todas' ? 'all' : effSlug
  const nav = findNav(activeCategory)
  const facets = useMemo(() => nav?.facets ?? [], [nav])

  const [priceBucket, setPriceBucket] = useState<PriceBucket>('all')
  const [brand, setBrand] = useState('all')
  const [personalizableOnly, setPersonalizableOnly] = useState(false)
  const [sort, setSort] = useState<SortValue>('relevance')
  const [sub, setSub] = useState(searchParams.get('sub') || 'all')
  const [capacity, setCapacity] = useState<CapacityValue>('all')
  const [themes, setThemes] = useState<string[]>(() => {
    const t = searchParams.get('tema')
    return t ? [t] : []
  })

  const isMobile = useMediaQuery('(max-width: 899px)')
  const [sheetOpen, setSheetOpen] = useState(false)

  const title = search ? `Resultados para "${search}"` : nav ? nav.name : 'Todas las categorías'

  // Re-seed facets from the URL whenever the category (or its query) changes.
  useEffect(() => {
    setSub(searchParams.get('sub') || 'all')
    const t = searchParams.get('tema')
    setThemes(t ? [t] : [])
    setCapacity('all')
    setPriceBucket('all')
    setBrand('all')
    setPersonalizableOnly(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, searchParams.get('sub'), searchParams.get('tema')])

  const list = useMemo(
    () =>
      filterProducts(PRODUCTS, {
        search,
        category: activeCategory,
        subcat: sub,
        capacity,
        themes,
        priceBucket,
        brand,
        personalizableOnly,
        sort,
      }),
    [search, activeCategory, sub, capacity, themes, priceBucket, brand, personalizableOnly, sort],
  )

  const themeOptions = useMemo(() => {
    if (!facets.includes('tema')) return [] as { slug: string; label: string }[]
    const target = nav?.slug
    const set = new Set<string>()
    for (const p of PRODUCTS) {
      if ((findNav(p.cat)?.slug ?? p.cat) !== target) continue
      for (const t of p.themes ?? []) set.add(t)
    }
    return [...set].sort().map((s) => ({ slug: s, label: THEME_LABELS[s] ?? s }))
  }, [facets, nav])

  const toggleTheme = (t: string) =>
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const clearAll = () => {
    setSub('all')
    setCapacity('all')
    setThemes([])
    setPriceBucket('all')
    setBrand('all')
    setPersonalizableOnly(false)
  }

  if (aliasTarget) {
    const qs = searchParams.toString()
    return <Navigate to={`/categoria/${aliasTarget}${qs ? `?${qs}` : ''}`} replace />
  }

  const filtersBody = (
    <>
      {facets.includes('subcat') && nav && nav.subLinks.length > 0 && (
        <FilterGroup heading={nav.name}>
          <FilterButton active={sub === 'all'} onClick={() => setSub('all')}>
            Todas
          </FilterButton>
          {nav.subLinks.map((s) => (
            <FilterButton key={s.slug} active={sub === s.slug} onClick={() => setSub(s.slug)}>
              {s.label}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('capacidad') && (
        <FilterGroup heading="Capacidad">
          {CAPACITY_OPTIONS.map((c) => (
            <FilterButton key={c.key} active={capacity === c.key} onClick={() => setCapacity(c.key)}>
              {c.label}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('tema') && themeOptions.length > 0 && (
        <FilterGroup heading="Temática">
          {themeOptions.map((t) => (
            <label key={t.slug} className="sf-filters__checkbox">
              <input
                type="checkbox"
                checked={themes.includes(t.slug)}
                onChange={() => toggleTheme(t.slug)}
              />
              {t.label}
            </label>
          ))}
        </FilterGroup>
      )}

      <FilterGroup heading="Precio">
        {PRICE_BUCKETS.map((b) => (
          <FilterButton
            key={b.key}
            active={priceBucket === b.key}
            onClick={() => setPriceBucket(b.key)}
          >
            {b.label}
          </FilterButton>
        ))}
      </FilterGroup>

      {facets.includes('marca') && (
        <FilterGroup heading="Marca">
          <FilterButton active={brand === 'all'} onClick={() => setBrand('all')}>
            Todas
          </FilterButton>
          {BRAND_LIST.map((b) => (
            <FilterButton key={b.slug} active={brand === b.slug} onClick={() => setBrand(b.slug)}>
              {b.name}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('personalizable') && (
        <label className="sf-filters__checkbox">
          <input
            type="checkbox"
            checked={personalizableOnly}
            onChange={(e) => setPersonalizableOnly(e.target.checked)}
          />
          Sólo personalizables (a medida)
        </label>
      )}
    </>
  )

  return (
    <div className="sf-section">
      <div className="sf-breadcrumb">
        <button type="button" className="sf-breadcrumb__link" onClick={() => navigate('/')}>
          Inicio
        </button>
        {' / '}
        <span className="sf-breadcrumb__current">{title}</span>
      </div>

      <div className="sf-category">
        {!isMobile && <aside className="sf-filters">{filtersBody}</aside>}

        <div>
          <CustomOrderCTA variant="strip" />

          <div className="sf-results-bar">
            <span className="sf-muted" style={{ fontSize: '0.9rem' }}>
              {list.length} resultado{list.length === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isMobile && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setSheetOpen(true)}
                >
                  Filtros
                </button>
              )}
              <select
                className="sf-input"
                style={{ width: 'auto' }}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
              >
                <option value="relevance">Relevancia</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
            </div>
          </div>

          {list.length > 0 ? (
            <div className="sf-product-grid" style={{ marginTop: '1.25rem' }}>
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="sf-empty sf-muted">No encontramos productos con estos filtros.</div>
          )}
        </div>
      </div>

      {isMobile && sheetOpen && (
        <>
          <div
            className="sf-drawer__scrim"
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
          />
          <div className="sf-filter-sheet" role="dialog" aria-label="Filtros">
            <div className="sf-filter-sheet__head">
              <span>Filtros</span>
              <button
                type="button"
                className="sf-drawer__close"
                aria-label="Cerrar filtros"
                onClick={() => setSheetOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="sf-filter-sheet__body sf-filters">{filtersBody}</div>
            <div className="sf-filter-sheet__foot">
              <button type="button" className="btn btn--secondary" onClick={clearAll}>
                Limpiar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setSheetOpen(false)}
              >
                Ver {list.length} resultados
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FilterGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <div className="sf-filters__heading">{heading}</div>
      <div className="sf-filters__list">{children}</div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`sf-filters__item ${active ? 'sf-filters__item--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

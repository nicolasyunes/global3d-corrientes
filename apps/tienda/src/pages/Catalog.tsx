import { Link, useParams, useSearchParams } from 'react-router-dom'
import { IconSearch } from '../components/Icons'
import { ProductCard } from '../components/ProductCard'
import {
  CATEGORIES,
  categoryLabel,
  inStock,
  searchFamilies,
} from '../lib/catalog'
import { useShop } from '../lib/data'
import { usePageTitle } from '../lib/usePageTitle'
import { GridSkeleton, LoadError } from './states'

export function Catalog() {
  const { cat } = useParams()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const onlyStock = params.get('stock') === '1'
  const { families, status, reload } = useShop()
  const meta = CATEGORIES.find((c) => c.slug === cat)
  usePageTitle(cat ? categoryLabel(cat) : 'Catálogo')

  let list = cat ? families.filter((f) => f.category === cat) : families
  if (onlyStock) list = list.filter(inStock)
  list = searchFamilies(list, q)

  const usedCats = CATEGORIES.filter((c) =>
    families.some((f) => f.category === c.slug),
  )

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <div className="container">
      <div className="page-title">
        <nav className="crumbs" aria-label="Ruta" style={{ padding: 0 }}>
          <Link to="/">Inicio</Link> <span aria-hidden="true">/</span>
          {cat ? <Link to="/catalogo">Catálogo</Link> : <span>Catálogo</span>}
        </nav>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
          {meta ? meta.label : 'Catálogo'}
        </h1>
        {meta && <p className="muted">{meta.blurb}</p>}
      </div>

      <div className="stack" style={{ gap: 12, marginBottom: 20 }}>
        <label className="field" style={{ position: 'relative' }}>
          <span className="sr-only">Buscar</span>
          <input
            className="input"
            type="search"
            placeholder="Buscá: vaso, trofeo, llavero, Boca…"
            value={q}
            onChange={(e) => setParam('q', e.target.value || null)}
            style={{ paddingLeft: 42 }}
          />
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: 14,
              color: 'var(--muted)',
            }}
          >
            <IconSearch />
          </span>
        </label>
        <div className="chips" role="navigation" aria-label="Categorías">
          <Link
            to={`/catalogo${onlyStock ? '?stock=1' : ''}`}
            className="chip"
            aria-current={!cat ? 'page' : undefined}
          >
            Todo
          </Link>
          {usedCats.map((c) => (
            <Link
              key={c.slug}
              to={`/c/${c.slug}${onlyStock ? '?stock=1' : ''}`}
              className="chip"
              aria-current={cat === c.slug ? 'page' : undefined}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="chip"
          aria-pressed={onlyStock}
          onClick={() => setParam('stock', onlyStock ? null : '1')}
          style={{ width: 'fit-content' }}
        >
          Solo listo para retirar hoy
        </button>
      </div>

      {status === 'loading' && <GridSkeleton />}
      {status === 'error' && <LoadError onRetry={reload} />}
      {status === 'ready' && list.length === 0 && (
        <div className="empty">
          <h3>No encontramos productos{q ? ` para “${q}”` : ''}</h3>
          <p className="muted">
            Si no está en el catálogo, lo podemos hacer a medida.
          </p>
          <Link to="/a-medida" className="btn btn-primary">
            Pedir a medida
          </Link>
        </div>
      )}
      {status === 'ready' && list.length > 0 && (
        <>
          <p className="muted" style={{ marginBottom: 12, fontSize: '0.9rem' }}>
            {list.length} {list.length === 1 ? 'producto' : 'productos'}
          </p>
          <div className="grid">
            {list.map((f) => (
              <ProductCard key={f.slug} f={f} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

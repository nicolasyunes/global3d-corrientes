import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { pesos } from '@/features/sales/sales'
import {
  expectedMl,
  listingDiffs,
  listingState,
  LISTING_STATE_LABELS,
  type ListingState,
} from './ml'
import {
  listFamilies,
  listListings,
  listProductPrices,
  type MlListing,
} from './ml.api'

export interface ListingRow {
  productId: string
  family: string
  name: string
  priceWeb: number
  priceMl: number
  mlManual: boolean
  stock: number
  expected: { stock: number; leadDays: number | null }
  listing: MlListing | null
  state: ListingState
  diffs: string[]
}

type Filter = 'todas' | 'publicadas' | 'sin_publicar' | 'diferencias'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'publicadas', label: 'Publicadas' },
  { id: 'sin_publicar', label: 'Sin publicar' },
  { id: 'diferencias', label: 'Con diferencias' },
]

export function matchesFilter(r: ListingRow, f: Filter): boolean {
  if (f === 'publicadas') return r.listing !== null
  if (f === 'sin_publicar') return r.listing === null
  if (f === 'diferencias') return r.diffs.length > 0 || r.state === 'revisar'
  return true
}

// Cada producto de la tienda con su publicación de ML (una por producto).
export default function ListingsTab() {
  const [rows, setRows] = useState<ListingRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [filter, setFilter] = useState<Filter>('todas')
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setStatus('loading')
    Promise.all([listFamilies(), listListings(), listProductPrices()])
      .then(([families, listings, prices]) => {
        const byProduct = new Map(
          listings.filter((l) => l.product_id).map((l) => [l.product_id, l]),
        )
        const priceOf = new Map(prices.map((p) => [p.product_id, p]))
        const out: ListingRow[] = []
        for (const f of families) {
          const items = [...f.shop_family_products].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          )
          for (const it of items) {
            const p = it.products
            if (!p) continue
            const pr = priceOf.get(p.id)
            const listing = byProduct.get(p.id) ?? null
            const expected = expectedMl(
              p.stock_quantity,
              p.active,
              f.sale_mode,
              f.lead_days,
            )
            const priceMl = pr?.price_ml ?? 0
            out.push({
              productId: p.id,
              family: f.name,
              name: p.name,
              priceWeb: pr?.price_web ?? 0,
              priceMl,
              mlManual: pr?.ml_manual ?? false,
              stock: Math.max(p.stock_quantity ?? 0, 0),
              expected,
              listing,
              state: listingState(listing),
              diffs: listingDiffs(listing, {
                price: priceMl,
                stock: expected.stock,
              }),
            })
          }
        }
        setRows(out)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      todas: rows.length,
      publicadas: 0,
      sin_publicar: 0,
      diferencias: 0,
    }
    for (const r of rows)
      for (const f of ['publicadas', 'sin_publicar', 'diferencias'] as const)
        if (matchesFilter(r, f)) c[f]++
    return c
  }, [rows])

  const needle = q.trim().toLowerCase()
  const shown = rows.filter(
    (r) =>
      matchesFilter(r, filter) &&
      (!needle ||
        r.name.toLowerCase().includes(needle) ||
        r.family.toLowerCase().includes(needle)),
  )

  return (
    <div className="ml-tab">
      <div className="chips" role="group" aria-label="Filtro">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>
      <input
        className="input ml-search"
        type="search"
        placeholder="Buscar producto o familia"
        aria-label="Buscar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {status === 'error' && (
        <p className="banner banner--error" role="alert">
          No se pudieron cargar las publicaciones.{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
            Reintentar
          </button>
        </p>
      )}
      {status === 'ready' && shown.length === 0 && (
        <p className="muted">No hay productos con este filtro.</p>
      )}

      <ul className="ml-list">
        {shown.map((r) => (
          <li key={r.productId} className="ml-pub">
            <div className="ml-pub__main">
              <span className={`ml-state ml-state--${r.state}`}>
                {LISTING_STATE_LABELS[r.state]}
              </span>
              <strong className="ml-pub__name">{r.name}</strong>
              {r.family !== r.name && (
                <span className="muted ml-pub__family">{r.family}</span>
              )}
            </div>
            <dl className="ml-pub__nums">
              <div>
                <dt>Web</dt>
                <dd>{pesos(r.priceWeb)}</dd>
              </div>
              <div>
                <dt>ML{r.mlManual ? ' (manual)' : ''}</dt>
                <dd className="ml-price">
                  {pesos(r.priceMl)}
                  {r.diffs.includes('precio') && r.listing?.ml_price != null && (
                    <span className="ml-diff">
                      publicado {pesos(r.listing.ml_price)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Stock en ML</dt>
                <dd>
                  {r.expected.stock}
                  {r.expected.leadDays
                    ? ` · se fabrica en ${r.expected.leadDays} días`
                    : ''}
                  {r.diffs.includes('stock') && r.listing?.ml_stock != null && (
                    <span className="ml-diff">publicado {r.listing.ml_stock}</span>
                  )}
                </dd>
              </div>
            </dl>
            {r.listing?.permalink && (
              <a
                className="ml-pub__link"
                href={r.listing.permalink}
                target="_blank"
                rel="noreferrer"
              >
                Ver en ML <Icon name="external" size={14} />
              </a>
            )}
          </li>
        ))}
      </ul>
      {status === 'ready' && counts.diferencias > 0 && (
        <p className="muted ml-note">
          Las diferencias las corrige solo la tarea diaria del gestor (o
          pedíselo al director: “corregí las diferencias”).
        </p>
      )}
    </div>
  )
}

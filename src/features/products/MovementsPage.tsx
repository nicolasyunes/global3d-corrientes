import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { logStamp, signed } from '@/features/filaments/filaments'
import { useOperator } from '@/features/operators/operator-context'
import {
  filterMovements,
  groupByDay,
  KIND_TEXT,
  movementGroup,
  type MovementFilter,
} from './movements'
import { listProductLog, type ProductLogRow } from './products.api'
import './products.css'

const PAGE = 100
const FILTERS: [MovementFilter, string][] = [
  ['all', 'Todo'],
  ['in', 'Entran'],
  ['out', 'Salen'],
  ['other', 'Altas y cambios'],
]

// `/admin/productos/movimientos` (solo admin): todo lo que se hizo con el stock
// y las fichas, con quién y a qué hora. Solo lee: no se edita ni se borra.
export default function MovementsPage() {
  const { current, operators, byId } = useOperator()
  const [rows, setRows] = useState<ProductLogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [kind, setKind] = useState<MovementFilter>('all')
  const [person, setPerson] = useState('all')
  const [query, setQuery] = useState('')
  const operatorId = current?.id

  useEffect(() => {
    if (!operatorId) return
    let alive = true
    listProductLog(operatorId, null, PAGE)
      .then((r) => {
        if (!alive) return
        setRows(r)
        setMore(r.length === PAGE)
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los movimientos.',
          )
      })
    return () => {
      alive = false
    }
  }, [operatorId])

  async function loadMore() {
    if (!operatorId || !rows?.length) return
    setLoadingMore(true)
    try {
      const next = await listProductLog(
        operatorId,
        rows[rows.length - 1].created_at,
        PAGE,
      )
      setRows([...rows, ...next])
      setMore(next.length === PAGE)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar más.')
    } finally {
      setLoadingMore(false)
    }
  }

  const shown = useMemo(
    () => (rows ? filterMovements(rows, { kind, person, query }) : []),
    [rows, kind, person, query],
  )
  const days = useMemo(() => groupByDay(shown), [shown])

  return (
    <>
      <Link to="/admin/productos" className="back">
        <Icon name="back" size={16} /> Productos
      </Link>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Control</p>
          <h1 className="page-title">Movimientos de productos</h1>
          <p className="muted">
            Cada producto nuevo, cada entrada y salida de stock, cada venta
            directa y cada cambio de ficha, con quién y a qué hora. No se puede
            editar ni borrar.
          </p>
        </div>
      </div>

      <div className="orders-tools">
        <label className="orders-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar producto o nota…"
            aria-label="Buscar en los movimientos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
        <select
          className="input mlog__person"
          aria-label="Persona"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="all">Todas las personas</option>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {!rows && !error && <p className="muted">Cargando…</p>}

      {rows && shown.length === 0 && (
        <div className="empty">
          <p className="muted">
            {rows.length === 0
              ? 'Todavía no hay movimientos registrados.'
              : 'Nada coincide con los filtros.'}
          </p>
        </div>
      )}

      {days.map((day) => (
        <section key={day.key} className="mlog__day" aria-label={day.label}>
          <h2 className="mlog__day-title">{day.label}</h2>
          <ul className="card mlog__list">
            {day.rows.map((r) => {
              const who = byId(r.operator_id)
              const group = movementGroup(r)
              return (
                <li key={r.id} className="mlog__row">
                  <time dateTime={r.created_at} className="mlog__time">
                    {logStamp(r.created_at)}
                  </time>
                  <span className="mlog__main">
                    <strong>{r.product_label}</strong>
                    <span className="muted">
                      {KIND_TEXT[r.kind]}
                      {r.note ? ` · ${r.note}` : ''}
                    </span>
                  </span>
                  {r.delta != null && r.delta !== 0 && (
                    <span
                      className={`mlog__delta num mlog__delta--${group}`}
                      title="Cambio de stock"
                    >
                      {signed(r.delta)}
                    </span>
                  )}
                  {r.stock_after != null && (
                    <span
                      className="mlog__after muted num"
                      title="Stock quedó en"
                    >
                      = {r.stock_after}
                    </span>
                  )}
                  <span className="mlog__who">
                    {who ? (
                      <>
                        <span
                          className="avatar avatar--sm"
                          style={{ background: who.color }}
                        >
                          {who.initials}
                        </span>
                        {who.name}
                      </>
                    ) : (
                      <span className="muted">Sin identificar</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {rows && more && (
        <button
          type="button"
          className="btn btn--ghost"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Cargando…' : 'Ver más antiguos'}
        </button>
      )}
    </>
  )
}

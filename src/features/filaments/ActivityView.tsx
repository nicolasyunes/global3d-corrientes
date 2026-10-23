import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import {
  filterLog,
  LOG_TEXT,
  logDayKey,
  logDayLabel,
  logGroup,
  logStamp,
  signed,
  type FilamentLogRow,
  type LogFilter,
  type LogKind,
} from './filaments'
import { listLog } from './filaments.api'
import SalesPanel from './SalesPanel'

const PAGE = 100
const FILTERS: [LogFilter, string][] = [
  ['all', 'Todo'],
  ['in', 'Entran'],
  ['out', 'Salen'],
  ['setup', 'Altas y bajas'],
]

// Everything that changed in the stock, newest first, with who and when.
// It only reads: nothing here can be edited or erased.
export default function ActivityView({
  reloadKey,
  onChanged,
}: {
  reloadKey: number
  onChanged?: () => void
}) {
  const { operators, byId } = useOperator()
  const [limit, setLimit] = useState(PAGE)
  const [rows, setRows] = useState<FilamentLogRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<LogFilter>('all')
  const [person, setPerson] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    listLog(limit)
      .then((r) => {
        if (!alive) return
        setRows(r)
        setError(null)
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la actividad.',
          )
      })
    return () => {
      alive = false
    }
  }, [limit, reloadKey])

  if (error)
    return (
      <p className="fl-error" role="alert">
        {error}
      </p>
    )
  if (rows == null) return <p className="fl-quiet">Cargando actividad…</p>

  const shown = filterLog(rows, { kind, person, query })
  const days: { key: string; label: string; rows: FilamentLogRow[] }[] = []
  for (const r of shown) {
    const key = logDayKey(r.created_at)
    const last = days[days.length - 1]
    if (last?.key === key) last.rows.push(r)
    else days.push({ key, label: logDayLabel(r.created_at), rows: [r] })
  }

  return (
    <>
      <SalesPanel reloadKey={reloadKey} onChanged={onChanged ?? (() => {})} />
      <p className="fl-hint">
        Registro de control: cada bobina que entra o sale y cada color o línea
        que se crea o se borra, con quién y a qué hora. No se puede editar ni
        borrar.
      </p>
      <div className="fl-bar">
        <label className="fl-search">
          <Icon name="search" size={16} />
          <input
            placeholder="Buscar color o marca"
            aria-label="Buscar en la actividad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="fl-seg" role="group" aria-label="Tipo de movimiento">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="fl-field fl-field--inline">
          <span className="visually-hidden">Persona</span>
          <select
            className="fl-input"
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
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="fl-empty">
          {rows.length === 0
            ? 'Todavía no hay actividad registrada.'
            : 'Nada coincide con los filtros.'}
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} className="fl-day" aria-label={day.label}>
            <h2>{day.label}</h2>
            <ul className="fl-log">
              {day.rows.map((r) => {
                const setup = logGroup(r.kind) === 'setup'
                const who = byId(r.operator_id)
                return (
                  <li key={r.id} className="fl-log__row">
                    <time dateTime={r.created_at} className="fl-log__time">
                      {logStamp(r.created_at)}
                    </time>
                    <span
                      className={`fl-log__n fl-mono${
                        r.delta == null
                          ? ' is-none'
                          : r.delta > 0
                            ? ' is-in'
                            : ' is-out'
                      }`}
                    >
                      {r.delta == null ? '·' : signed(r.delta)}
                    </span>
                    <span className="fl-log__what">
                      <strong>
                        {r.color_label ?? r.line_label}
                        {r.refill && ' (recarga)'}
                      </strong>
                      <span>
                        {r.color_label ? `${r.line_label} · ` : ''}
                        <span className={setup ? 'is-setup' : undefined}>
                          {LOG_TEXT[r.kind as LogKind] ?? r.kind}
                        </span>
                        {r.note ? ` · ${r.note}` : ''}
                      </span>
                    </span>
                    <span className="fl-log__who">
                      {who?.name ?? 'Sin identificar'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
      {rows.length >= limit && (
        <button
          type="button"
          className="fl-btn"
          style={{ justifySelf: 'center' }}
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Ver más antiguos
        </button>
      )}
    </>
  )
}

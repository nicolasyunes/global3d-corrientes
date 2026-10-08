import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '@/features/filaments/filaments'
import { useOperator } from '@/features/operators/operator-context'
import {
  deliveredSummary,
  exitsByPerson,
  exitsByReason,
  pctChange,
  periodRange,
  previousRange,
  salesSummary,
  topColors,
  type PeriodKind,
} from './stats'
import { loadStats, type StatsData } from './stats.api'
import './stats.css'

const PERIODS: [PeriodKind, string][] = [
  ['today', 'Hoy'],
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['custom', 'Rango'],
]

const PAYMENT: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia MP' }

const STAMP = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayLabel(at: string, exact: boolean): string {
  if (exact) return STAMP.format(new Date(at))
  const [y, m, d] = at.split('-').map(Number)
  return `${DAY.format(new Date(y, m - 1, d))} (prometida)`
}

function Change({ curr, prev }: { curr: number; prev: number }) {
  const pct = pctChange(curr, prev)
  if (pct == null) return null
  return (
    <span className={`st-change${pct < 0 ? ' is-down' : ''}`}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)} % vs período anterior
    </span>
  )
}

function Tile({
  label,
  value,
  sub,
  curr,
  prev,
}: {
  label: string
  value: string
  sub?: string
  curr: number
  prev: number
}) {
  return (
    <div className="st-tile">
      <span className="st-tile__label">{label}</span>
      <span className="st-tile__value num">{value}</span>
      {sub && <span className="st-tile__sub">{sub}</span>}
      <Change curr={curr} prev={prev} />
    </div>
  )
}

// Owner-only numbers: what was sold, delivered and taken off the shelf in a
// period, compared with the one before.
export default function StatsPage() {
  const { byId } = useOperator()
  const [kind, setKind] = useState<PeriodKind>('week')
  const [custom, setCustom] = useState(() => {
    const today = new Date()
    return {
      from: isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
      to: isoDay(today),
    }
  })
  const [data, setData] = useState<{ curr: StatsData; prev: StatsData } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(
    () => periodRange(kind, new Date(), custom),
    // Recompute when the period or the custom dates change.
    [kind, custom],
  )

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    Promise.all([loadStats(range), loadStats(previousRange(kind, range))])
      .then(([curr, prev]) => alive && setData({ curr, prev }))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas.'))
    return () => {
      alive = false
    }
  }, [range, kind])

  const name = (id: string | null) => (id ? (byId(id)?.name ?? '—') : '—')

  return (
    <div className="st">
      <header className="st-head">
        <div>
          <p className="eyebrow">Control</p>
          <h1 className="page-title">Estadísticas</h1>
        </div>
        <div className="st-period">
          <div className="chips" role="group" aria-label="Período">
            {PERIODS.map(([value, label]) => (
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
          </div>
          {kind === 'custom' && (
            <div className="st-dates">
              <label>
                Desde
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </label>
            </div>
          )}
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {!error && !data && <p className="st-quiet">Cargando…</p>}
      {data && <Body data={data} name={name} />}
    </div>
  )
}

function Body({
  data,
  name,
}: {
  data: { curr: StatsData; prev: StatsData }
  name: (id: string | null) => string
}) {
  const { curr, prev } = data
  const s = salesSummary(curr.sales)
  const sp = salesSummary(prev.sales)
  const dl = deliveredSummary(curr.delivered)
  const dp = deliveredSummary(prev.delivered)
  const exits = exitsByReason(curr.log)
  const people = exitsByPerson(curr.log)
  const top = topColors(curr.sales)

  return (
    <>
      <div className="st-tiles">
        <Tile
          label="Ventas de filamento"
          value={money(s.total)}
          sub={`${s.units} bobinas · ${s.count} ventas`}
          curr={s.total}
          prev={sp.total}
        />
        <Tile
          label="Efectivo esperado"
          value={money(s.cash + dl.cash)}
          curr={s.cash + dl.cash}
          prev={sp.cash + dp.cash}
        />
        <Tile
          label="Transferencias esperadas"
          value={money(s.transfer + dl.transfer)}
          curr={s.transfer + dl.transfer}
          prev={sp.transfer + dp.transfer}
        />
        <Tile
          label="Pedidos entregados"
          value={String(dl.orders)}
          sub={money(dl.ordersAmount)}
          curr={dl.orders}
          prev={dp.orders}
        />
        <Tile
          label="Ventas directas"
          value={String(dl.direct)}
          sub={money(dl.directAmount)}
          curr={dl.direct}
          prev={dp.direct}
        />
      </div>
      <p className="st-hint">
        Efectivo y transferencias suman ventas de filamento y ventas directas. Los pedidos no
        tienen forma de cobro cargada.
      </p>

      <section className="st-section">
        <h2>Ventas de filamento</h2>
        {curr.sales.length === 0 ? (
          <p className="st-quiet">Sin ventas en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Ventas de filamento">
              <thead>
                <tr>
                  <th>Día y hora</th>
                  <th>Persona</th>
                  <th>Filamento</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                  <th className="num">Total</th>
                  <th>Cobro</th>
                  <th>Cliente</th>
                </tr>
              </thead>
              <tbody>
                {curr.sales.map((x) => (
                  <tr key={x.id} className={x.voided_at ? 'is-void' : undefined}>
                    <td>{STAMP.format(new Date(x.created_at))}</td>
                    <td>{name(x.operator_id)}</td>
                    <td>
                      {x.color_label} · {x.line_label}
                      {x.refill ? ' (recarga)' : ''}
                      {x.voided_at && <span className="st-void">Anulada: {x.void_reason}</span>}
                    </td>
                    <td className="num">{x.quantity}</td>
                    <td className="num">{money(x.unit_price)}</td>
                    <td className="num">{money(x.total)}</td>
                    <td>{PAYMENT[x.payment] ?? x.payment}</td>
                    <td>{x.customer ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Entregados</h2>
        {curr.delivered.length === 0 ? (
          <p className="st-quiet">Nada entregado en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Entregados">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th className="num">Monto</th>
                  <th>Cobro</th>
                </tr>
              </thead>
              <tbody>
                {curr.delivered.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <td>{dayLabel(r.at, r.exact)}</td>
                    <td>{r.customerName ?? ''}</td>
                    <td>{r.href ? <Link to={r.href}>{r.productLabel}</Link> : r.productLabel}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td>{r.method ? PAYMENT[r.method] : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Salidas del estante</h2>
        <div className="st-scroll">
          <table className="st-table" aria-label="Salidas por motivo">
            <thead>
              <tr>
                <th>Motivo</th>
                <th className="num">Movimientos</th>
                <th className="num">Bobinas</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['used', 'A producción'],
                  ['transfer', 'A la otra sede'],
                  ['personal', 'Uso personal'],
                  ['adjust', 'Ajustes'],
                  ['count', 'Ajustes por conteo'],
                ] as const
              ).map(([k, label]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td className="num">{exits[k].moves}</td>
                  <td className="num">{exits[k].units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="st-section">
        <h2>Por persona</h2>
        {people.length === 0 ? (
          <p className="st-quiet">Sin movimientos en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Por persona">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="num">Vendió</th>
                  <th className="num">A producción</th>
                  <th className="num">A la otra sede</th>
                  <th className="num">Uso personal</th>
                  <th className="num">Ajustes</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.operatorId ?? 'none'}>
                    <td>{name(p.operatorId)}</td>
                    <td className="num">{p.sale}</td>
                    <td className="num">{p.used}</td>
                    <td className="num">{p.transfer}</td>
                    <td className="num">{p.personal}</td>
                    <td className="num">{p.adjust}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Más vendidos</h2>
        {top.length === 0 ? (
          <p className="st-quiet">Sin ventas en este período.</p>
        ) : (
          <ol className="st-top">
            {top.map((t) => (
              <li key={t.label}>
                <span>{t.label}</span>
                <span className="num">
                  {t.units} · {money(t.total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { money } from '@/features/filaments/filaments'
import { ShareBars, WeeklyBars } from './charts'
import {
  COMPARE_CUTOFF,
  compareLabel,
  comparisonFor,
  containsMigration,
  isCurrentPeriod,
  parsePeriod,
  periodTitle,
  periodToParams,
  rangeOfPeriod,
  shiftPeriod,
  type SummaryKind,
  type SummaryPeriod,
} from './period'
import {
  byChannel,
  collected,
  collectedByMethod,
  newCustomers,
  onTimeRate,
  ordersByWeek,
  pctChange,
  pointsDiff,
  receivable,
  sold,
  ticketAverage,
} from './summary'
import { loadSummary, type SummaryData } from './summary.api'
import './stats.css'

const KINDS: [SummaryKind, string][] = [
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['year', 'Año'],
]

function Delta({ text, down }: { text: string | null; down?: boolean }) {
  if (!text) return null
  return <span className={`st-change${down ? ' is-down' : ''}`}>{text}</span>
}

function pctText(curr: number | null, prev: number | null): { text: string | null; down: boolean } {
  if (curr === null || prev === null) return { text: null, down: false }
  const pct = pctChange(curr, prev)
  if (pct === null) return { text: null, down: false }
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)} %`, down: pct < 0 }
}

function Tile({
  label,
  value,
  sub,
  help,
  change,
}: {
  label: string
  value: string
  sub?: ReactNode
  help: string
  change?: { text: string | null; down: boolean }
}) {
  return (
    <div className="st-tile" title={help}>
      <span className="st-tile__label">{label}</span>
      <span className="st-tile__value num">{value}</span>
      {sub && <span className="st-tile__sub">{sub}</span>}
      {change && <Delta text={change.text} down={change.down} />}
      <span className="visually-hidden">{help}</span>
    </div>
  )
}

const orderWord = (n: number) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`

// Sold, collected and owed in a period, with where the orders came from.
export default function SummaryTab() {
  const [params, setParams] = useSearchParams()
  const now = new Date()
  const period = useMemo(
    () => parsePeriod(params, now),
    // `now` only matters for the open period; params drive re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  )
  const range = useMemo(() => rangeOfPeriod(period), [period])
  const cmp = useMemo(
    () => comparisonFor(period, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period],
  )
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    loadSummary(range, cmp)
      .then((d) => alive && setData(d))
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
      })
    return () => {
      alive = false
    }
  }, [range, cmp])

  function go(next: SummaryPeriod) {
    const out = new URLSearchParams(params)
    out.delete('p')
    out.delete('d')
    for (const [k, v] of Object.entries(periodToParams(next, new Date()))) out.set(k, v)
    setParams(out)
  }

  const current = isCurrentPeriod(period, now)
  return (
    <div className="st">
      <div className="st-nav">
        <div className="chips" role="group" aria-label="Período">
          {KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="chip"
              aria-pressed={period.kind === kind}
              onClick={() =>
                go({ kind, start: rangeOfPeriod({ kind, start: now }).from })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Período anterior"
          onClick={() => go(shiftPeriod(period, -1, now))}
        >
          ‹
        </button>
        <span className="st-nav__title">{periodTitle(period)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Período siguiente"
          disabled={current}
          onClick={() => go(shiftPeriod(period, 1, now))}
        >
          ›
        </button>
        <span className="st-nav__compare">
          {cmp ? compareLabel(period) : 'sin comparación'}
        </span>
      </div>

      {containsMigration(range) && (
        <p className="st-banner">
          Datos de la planilla, incompletos: 50 pedidos se cargaron juntos el 29/9, así que este
          período no se compara.
        </p>
      )}

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {!error && !data && <p className="st-quiet">Cargando…</p>}
      {data && <Body data={data} period={period} range={range} cmp={cmp} now={now} />}
    </div>
  )
}

function Body({
  data,
  range,
  cmp,
  now,
}: {
  data: SummaryData
  period: SummaryPeriod
  range: { from: Date; to: Date }
  cmp: { from: Date; to: Date } | null
  now: Date
}) {
  const { orders, payments, deliveredAt } = data
  const s = sold(orders, range)
  const c = collected(payments, range)
  const due = receivable(orders, COMPARE_CUTOFF)
  const ticket = ticketAverage(s)
  const ontime = onTimeRate(orders, deliveredAt, range)
  const fresh = newCustomers(orders, range)

  const ps = cmp ? sold(orders, cmp) : null
  const pc = cmp ? collected(payments, cmp) : null
  const pTicket = ps ? ticketAverage(ps) : null
  const pOntime = cmp ? onTimeRate(orders, deliveredAt, cmp) : null
  const pFresh = cmp ? newCustomers(orders, cmp) : null

  const soldChange = pctText(s.amount, ps ? ps.amount : null)
  const collectedChange = pctText(c.total, pc ? pc.total : null)
  const ticketChange = pctText(ticket, pTicket)
  const pts = pointsDiff(ontime.rate, pOntime ? pOntime.rate : null)
  const ontimeChange = {
    text: pts === null ? null : `${pts >= 0 ? '▲' : '▼'} ${Math.abs(pts)} pt`,
    down: pts !== null && pts < 0,
  }
  const diff = pFresh ? fresh.fresh - pFresh.fresh : null
  const freshChange = {
    text: diff === null ? null : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}`,
    down: diff !== null && diff < 0,
  }

  const weeks = ordersByWeek(orders, range, now)
  const channels = byChannel(orders, range)
  const methods = collectedByMethod(payments, range)

  return (
    <>
      <div className="st-tiles">
        <Tile
          label="Vendido"
          value={money(s.amount)}
          sub={`${orderWord(s.orders)} · ${s.units} ${s.units === 1 ? 'unidad' : 'unidades'}${
            s.withoutAmount > 0 ? ` · ${s.withoutAmount} sin monto` : ''
          }`}
          help="Pedidos no cancelados dados de alta en el período, por su total."
          change={soldChange}
        />
        <Tile
          label="Cobrado"
          value={money(c.total)}
          sub={`pedidos ${money(c.orders)} · directas ${money(c.direct)} · filamento ${money(c.filament)}`}
          help="Plata que entró en el período, por la fecha de cada cobro."
          change={collectedChange}
        />
        <Tile
          label="Por cobrar"
          value={money(due.amount)}
          sub={`${orderWord(due.orders)} con saldo`}
          help="Saldo pendiente de pedidos no cancelados, a hoy. No cambia con el período."
        />
        <Tile
          label="Ticket promedio"
          value={ticket === null ? '—' : money(Math.round(ticket))}
          sub="por pedido"
          help="Vendido dividido los pedidos que tienen monto."
          change={ticketChange}
        />
        <Tile
          label="Entregados a tiempo"
          value={ontime.rate === null ? '—' : `${ontime.rate}%`}
          sub={
            ontime.total === 0
              ? 'sin entregas con fecha real'
              : `${ontime.late} con atraso · sobre ${ontime.total} con fecha real`
          }
          help="Entregados en el período con la fecha real de entrega igual o anterior a la prometida. No cuenta los pedidos sin apuro."
          change={ontimeChange}
        />
        <Tile
          label="Clientes nuevos"
          value={String(fresh.fresh)}
          sub={`de ${fresh.total} en total`}
          help="Clientes cuyo primer pedido cae en el período."
          change={freshChange}
        />
      </div>

      {due.legacyOrders > 0 && (
        <p className="st-hint">
          {due.legacyOrders === 1
            ? '1 pedido anterior al 30/9 con saldo sin confirmar'
            : `${due.legacyOrders} pedidos anteriores al 30/9 con saldo sin confirmar`}
          : <strong className="num">{money(due.legacyAmount)}</strong>. No se suma a "Por cobrar"
          porque la planilla no decía si se pagó.
        </p>
      )}

      <div className="st-grid">
        <section className="st-card" aria-labelledby="st-weeks">
          <h2 id="st-weeks">Pedidos por semana</h2>
          <WeeklyBars bars={weeks} />
          <p className="st-hint">Pedidos dados de alta por semana · la última puede estar en curso.</p>
        </section>
        <section className="st-card" aria-labelledby="st-channels">
          <h2 id="st-channels">De dónde vienen los pedidos</h2>
          <ShareBars
            rows={channels}
            label="Pedidos por canal"
            empty="Sin datos en este período."
            format={(n) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
          />
        </section>
      </div>

      <section className="st-card" aria-labelledby="st-methods">
        <h2 id="st-methods">Cobrado por medio</h2>
        <ShareBars
          rows={methods}
          label="Cobrado por medio"
          empty="Sin datos en este período."
          format={(n) => money(n)}
        />
      </section>
    </>
  )
}

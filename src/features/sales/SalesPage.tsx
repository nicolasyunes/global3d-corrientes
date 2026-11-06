import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { periodRange, type PeriodKind } from '@/features/stats/stats'
import {
  ORIGIN_CHANNEL,
  ORIGIN_CHANNEL_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  type OriginChannel,
  type PaymentMethod,
} from '@/lib/domain-constants'
import NewSaleSheet from './NewSaleSheet'
import SaleDetail from './SaleDetail'
import {
  DEFAULT_FILTERS,
  filterSales,
  itemsSummary,
  pesos,
  salesTotals,
  type SaleFilters,
} from './sales'
import { listSales, type SaleWithRefs } from './sales.api'
import './sales.css'

const PERIODS: { kind: PeriodKind; label: string }[] = [
  { kind: 'today', label: 'Hoy' },
  { kind: 'week', label: 'Semana' },
  { kind: 'month', label: 'Mes' },
  { kind: 'custom', label: 'Rango' },
]

function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function stamp(iso: string, withDate: boolean): string {
  const d = new Date(iso)
  return withDate
    ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// Ventas: every sale from every channel, with filters and totals.
export default function SalesPage() {
  const { operators, byId } = useOperator()
  const [period, setPeriod] = useState<PeriodKind>('today')
  const [custom, setCustom] = useState({ from: todayIso(), to: todayIso() })
  const [filters, setFilters] = useState<SaleFilters>(DEFAULT_FILTERS)
  const [rows, setRows] = useState<SaleWithRefs[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const range = useMemo(
    () =>
      periodRange(period, new Date(), period === 'custom' ? custom : undefined),
    [period, custom],
  )

  const load = useCallback(() => {
    setStatus('loading')
    listSales(range.from, range.to)
      .then((list) => {
        setRows(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const shown = filterSales(rows, filters)
  const totals = salesTotals(shown)
  const open = rows.find((r) => r.id === openId) ?? null
  const set = (p: Partial<SaleFilters>) => setFilters((f) => ({ ...f, ...p }))

  return (
    <section className="page sales-page">
      <header className="sales-page__head">
        <h1>Ventas</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setCreating(true)}
        >
          Nueva venta
        </button>
      </header>

      <div className="chips" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.kind}
            type="button"
            className="chip"
            aria-pressed={period === p.kind}
            onClick={() => setPeriod(p.kind)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="sales-filters">
          <input
            type="date"
            className="input"
            aria-label="Desde"
            value={custom.from}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
          />
          <input
            type="date"
            className="input"
            aria-label="Hasta"
            value={custom.to}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
          />
        </div>
      )}

      <div className="sales-filters">
        <select
          className="input"
          aria-label="Canal"
          value={filters.channel}
          onChange={(e) =>
            set({ channel: e.target.value as SaleFilters['channel'] })
          }
        >
          <option value="all">Todos los canales</option>
          {ORIGIN_CHANNEL.map((c) => (
            <option key={c} value={c}>
              {ORIGIN_CHANNEL_LABELS[c]}
            </option>
          ))}
          <option value="none">Sin canal</option>
        </select>
        <select
          className="input"
          aria-label="Medio"
          value={filters.method}
          onChange={(e) =>
            set({ method: e.target.value as SaleFilters['method'] })
          }
        >
          <option value="all">Todos los medios</option>
          {PAYMENT_METHOD.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Vendió"
          value={filters.operatorId}
          onChange={(e) => set({ operatorId: e.target.value })}
        >
          <option value="all">Todas las personas</option>
          {operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={filters.wholesale}
            onChange={(e) => set({ wholesale: e.target.checked })}
          />{' '}
          Solo mayoristas
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.showVoided}
            onChange={(e) => set({ showVoided: e.target.checked })}
          />{' '}
          Mostrar anuladas
        </label>
      </div>

      <p className="sales-summary" aria-live="polite">
        <strong>{pesos(totals.amount)}</strong>
        <span>{totals.count === 1 ? '1 venta' : `${totals.count} ventas`}</span>
        {totals.discounts > 0 && (
          <span>Descuentos {pesos(totals.discounts)}</span>
        )}
      </p>

      {status === 'error' && (
        <p className="banner banner--error" role="alert">
          No se pudieron cargar las ventas.{' '}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={load}
          >
            Reintentar
          </button>
        </p>
      )}
      {status === 'ready' && shown.length === 0 && (
        <p className="muted">No hay ventas en este período.</p>
      )}

      <ul className="sales-list">
        {shown.map((s) => {
          const disc = Math.max(0, Number(s.list_total) - Number(s.amount))
          const who = s.operator_id ? byId(s.operator_id)?.name : null
          return (
            <li key={s.id}>
              <button
                type="button"
                className={
                  s.voided_at ? 'sales-row sales-row--voided' : 'sales-row'
                }
                onClick={() => setOpenId(s.id)}
              >
                <span className="muted">
                  {stamp(s.sold_at, period !== 'today')}
                </span>
                <span className="sales-row__what">
                  {itemsSummary(s.sale_items)}
                </span>
                <span className="sales-row__amount">
                  {pesos(s.amount)}
                  {disc > 0 && <span className="muted"> (−{pesos(disc)})</span>}
                </span>
                <span className="sales-row__meta muted">
                  {[
                    s.channel
                      ? ORIGIN_CHANNEL_LABELS[s.channel as OriginChannel]
                      : 'Sin canal',
                    s.method
                      ? PAYMENT_METHOD_LABELS[s.method as PaymentMethod]
                      : null,
                    s.customers
                      ? `${s.customers.name}${s.customers.wholesale ? ' (mayorista)' : ''}`
                      : null,
                    who,
                    s.order_id ? 'Pedido' : null,
                    s.voided_at ? 'Anulada' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <NewSaleSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          load()
        }}
      />
      {open && (
        <SaleDetail
          sale={open}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setOpenId(null)
            load()
          }}
        />
      )}
    </section>
  )
}

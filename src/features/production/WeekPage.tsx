import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { addDaysISO } from '@/features/orders/list'
import {
  listOrderItemCounts,
  listOrders,
  type OrderWithCustomer,
} from '@/features/orders/orders.api'
import { stageOf } from '@/features/orders/stage'
import { PartsBar, StageTag } from '@/features/orders/stage-ui'
import { toISODate } from '@/features/orders/validation'
import { dueInfo } from './due'
import { orderTitle } from './OrderRow'
import { listOrderProgress, type OrderProgress } from './production.api'
import '@/features/orders/taller.css'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const LATE_SHOWN = 4

// Monday of the week `iso` falls in (weeks run Monday–Sunday).
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return addDaysISO(iso, -((weekday + 6) % 7))
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-AR', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `${d} ${month.replace('.', '')}`
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

// "Semana": what is due each day and how much of it is still to print. A
// panorama only: no capacity maths until print times are measured.
export default function WeekPage() {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [progress, setProgress] = useState<Record<string, OrderProgress>>({})
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const today = useMemo(() => toISODate(new Date()), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrders(), listOrderProgress(), listOrderItemCounts()])
      .then(([rows, prog, counts]) => {
        if (cancelled) return
        setOrders(rows)
        setProgress(prog)
        setItemCounts(counts)
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar la semana.',
          ),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const monday = addDaysISO(mondayOf(today), offset * 7)
  const days = DAY_NAMES.map((name, i) => ({
    name,
    iso: addDaysISO(monday, i),
  }))
  const sunday = days[6].iso

  const leftOf = (o: OrderWithCustomer) => {
    const p = progress[o.id]
    return p ? p.total - p.done : 0
  }

  // Confirmed orders only: "en espera" has no real date yet.
  const confirmed = useMemo(
    () => orders.filter((o) => stageOf(o) !== 'on_hold'),
    [orders],
  )
  const late = useMemo(
    () =>
      confirmed
        .filter(
          (o) => o.status !== 'delivered' && !o.flexible && o.due_date < today,
        )
        .sort(
          (a, b) =>
            Number(b.urgent) - Number(a.urgent) ||
            a.due_date.localeCompare(b.due_date),
        ),
    [confirmed, today],
  )
  const lateIds = useMemo(() => new Set(late.map((o) => o.id)), [late])
  const byDay = (iso: string) =>
    confirmed
      .filter((o) => o.due_date === iso && !lateIds.has(o.id))
      .sort((a, b) => Number(b.urgent) - Number(a.urgent))

  const weekOpen = confirmed.filter(
    (o) =>
      o.status !== 'delivered' &&
      o.due_date >= monday &&
      o.due_date <= sunday &&
      !lateIds.has(o.id),
  )
  const toPrint = [...weekOpen, ...late].reduce((n, o) => n + leftOf(o), 0)

  function card(order: OrderWithCustomer) {
    const stage = stageOf(order)
    const prog = progress[order.id]
    return (
      <Link
        key={order.id}
        to={`/admin/orders/${order.id}`}
        className={`sem-card${order.urgent && stage !== 'delivered' ? ' sem-card--urgent' : ''}`}
      >
        <span className="sem-card__who">
          <strong>{order.customers?.name ?? 'Sin cliente'}</strong>
          <span>{orderTitle(order, itemCounts[order.id])}</span>
        </span>
        <span>
          <StageTag stage={stage} />
        </span>
        {(stage === 'printing' || stage === 'new') && prog && (
          <PartsBar printed={prog.done} total={prog.total} />
        )}
      </Link>
    )
  }

  return (
    <main className="sem">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Semana</p>
          <h1 className="page-title">
            {shortDate(monday)} – {shortDate(sunday)}
          </h1>
          <p className="page-sub">
            {plural(weekOpen.length, 'entrega', 'entregas')} ·{' '}
            {plural(late.length, 'atrasado', 'atrasados')} ·{' '}
            {plural(toPrint, 'pieza', 'piezas')} por imprimir
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="sem-nav"
            aria-label="Semana anterior"
            onClick={() => setOffset((n) => n - 1)}
          >
            <Icon name="back" size={18} />
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={offset === 0}
            onClick={() => setOffset(0)}
          >
            Hoy
          </button>
          <button
            type="button"
            className="sem-nav"
            aria-label="Semana siguiente"
            onClick={() => setOffset((n) => n + 1)}
          >
            <Icon name="next" size={18} />
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          {late.length > 0 && (
            // Overdue orders: one folded line above the week, not a column.
            <details className="sem-late">
              <summary>
                <strong>
                  Atrasados <span className="num">{late.length}</span>
                </strong>
                <span className="sem-late__sum">
                  {plural(
                    late.reduce((n, o) => n + leftOf(o), 0),
                    'pieza',
                    'piezas',
                  )}{' '}
                  por imprimir
                </span>
                <span className="sem-late__names">
                  {late
                    .slice(0, LATE_SHOWN)
                    .map((o) => o.customers?.name ?? 'Sin cliente')
                    .join(' · ')}
                  {late.length > LATE_SHOWN &&
                    ` · +${late.length - LATE_SHOWN} más`}
                </span>
                <span className="sem-late__toggle">Ver</span>
              </summary>
              <ul className="sem-late__list">
                {late.map((order) => (
                  <li key={order.id}>
                    <Link to={`/admin/orders/${order.id}`}>
                      <strong>{order.customers?.name ?? 'Sin cliente'}</strong>
                      <span>{orderTitle(order, itemCounts[order.id])}</span>
                      <StageTag stage={stageOf(order)} />
                      <span className="sem-late__due">
                        {dueInfo(order.due_date, today).label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="sem-grid">
            {days.map((day) => {
              const list = byDay(day.iso)
              const isToday = day.iso === today
              const past = day.iso < today
              const left = list
                .filter((o) => o.status !== 'delivered')
                .reduce((n, o) => n + leftOf(o), 0)
              return (
                <section
                  key={day.iso}
                  className={`sem-col${isToday ? ' sem-col--today' : ''}${past ? ' sem-col--past' : ''}`}
                  aria-label={`${day.name} ${Number(day.iso.slice(8))}`}
                >
                  <h2 className="sem-col__head">
                    {day.name}
                    <span className="num">
                      {Number(day.iso.slice(8))}
                      {isToday ? ' · hoy' : ''}
                    </span>
                  </h2>
                  <p className="sem-col__sum">
                    {list.length === 0
                      ? past
                        ? 'Nada entregado'
                        : 'Sin entregas'
                      : past
                        ? plural(list.length, 'entregado', 'entregados')
                        : `${plural(list.length, 'pedido', 'pedidos')} · ${plural(left, 'pieza', 'piezas')} por imprimir`}
                  </p>
                  <div className="sem-col__cards">{list.map(card)}</div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

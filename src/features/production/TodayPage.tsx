import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import NoticesCard from '@/features/notices/NoticesCard'
import { useOperator } from '@/features/operators/operator-context'
import { useOrderModal } from '@/features/orders/order-modal-context'
import {
  listOrderItemCounts,
  listOrders,
  type OrderWithCustomer,
} from '@/features/orders/orders.api'
import { formatMoney } from '@/features/orders/format'
import { addDaysISO } from '@/features/orders/list'
import { toISODate } from '@/features/orders/validation'
import {
  isWaiting,
  needsReview,
  urgentFirst,
} from '@/features/orders/orderFlow'
import WaitingOrders from '@/features/orders/WaitingOrders'
import { daysBetween } from './due'
import OrderRow, { orderTitle } from './OrderRow'
import { colorSwatch } from './pieces'
import {
  incrementPiece,
  listOrderProgress,
  setPieceStatus,
  type OrderProgress,
} from './production.api'
import { listWorkshopPieces, type WorkPiece } from './workshop.api'
import './production.css'
import './today.css'

type Panel = 'late' | 'soon' | 'waiting' | 'ready'

const PANEL_TITLE: Record<Panel, string> = {
  late: 'Atrasados',
  soon: 'Vencen hoy o mañana',
  waiting: 'En espera',
  ready: 'Listos para avisar',
}

const CLOSED = ['finished', 'delivered', 'cancelled']
const DAYS_AHEAD = 5
const PRINTING_SHOWN = 4
const NEXT_SHOWN = 8
const DELIVERIES_SHOWN = 6

function greeting(): string {
  const h = new Date().getHours()
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

export function summarize(orders: readonly OrderWithCustomer[], today: string) {
  // Confirmed open orders; "sin apuro" ones never count as late or urgent.
  const active = orders.filter(
    (o) => !CLOSED.includes(o.status) && !isWaiting(o),
  )
  const urgent = active.filter((o) => !o.flexible)
  const tomorrow = addDaysISO(today, 1)
  const ready = orders.filter((o) => o.status === 'finished')
  const byDue = urgentFirst<OrderWithCustomer>((a, b) =>
    a.due_date.localeCompare(b.due_date),
  )
  return {
    active,
    waiting: orders
      .filter((o) => isWaiting(o) && !CLOSED.includes(o.status))
      .sort(byDue),
    review: orders.filter((o) => needsReview(o, today)),
    late: urgent.filter((o) => o.due_date < today).sort(byDue),
    soon: urgent
      .filter((o) => o.due_date >= today && o.due_date <= tomorrow)
      .sort(byDue),
    ready: [...ready].sort(byDue),
    readyBalance: ready.reduce((sum, o) => sum + (o.pending_balance ?? 0), 0),
  }
}

const weekday = (iso: string, style: 'short' | 'long' = 'short') =>
  new Date(`${iso}T00:00:00`)
    .toLocaleDateString('es-AR', { weekday: style })
    .replace('.', '')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// "Hoy", "Mañana", "Vie" — how the day of a delivery reads at a glance.
export function dayWord(iso: string, today: string): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff > 1 && diff < 7) return cap(weekday(iso))
  return new Date(`${iso}T00:00:00`)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

// When a piece started printing: minutes, hours, the time, or the day.
export function sinceText(stamp: string, now = new Date()): string {
  const then = new Date(stamp)
  const mins = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60000))
  if (mins < 60) return mins <= 1 ? 'recién' : `hace ${mins} min`
  if (mins < 6 * 60) return `hace ${Math.round(mins / 60)} h`
  if (toISODate(then) === toISODate(now))
    return then.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  return dayWord(toISODate(then), toISODate(now)).toLowerCase()
}

function pieceDue(p: WorkPiece, today: string): string {
  if (p.flexible) return 'sin apuro'
  const diff = daysBetween(today, p.due_date)
  if (diff < 0) return `+${-diff} d`
  if (diff === 0) return 'vence hoy'
  return dayWord(p.due_date, today).toLowerCase()
}

const pieceRank = (p: WorkPiece) => (p.urgent ? 0 : p.flexible ? 2 : 1)
const byPriority = (a: WorkPiece, b: WorkPiece) =>
  pieceRank(a) - pieceRank(b) || a.due_date.localeCompare(b.due_date)

function Dot({ color }: { color: string | null }) {
  const bg = colorSwatch(color)
  return (
    <span
      className={`wk-dot${bg ? '' : ' wk-dot--none'}`}
      style={bg ? { background: bg } : undefined}
      aria-hidden="true"
    />
  )
}

export default function TodayPage() {
  const { current } = useOperator()
  const { openNew } = useOrderModal()
  const [toast, showToast] = useToast()
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [progress, setProgress] = useState<Record<string, OrderProgress>>({})
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [pieces, setPieces] = useState<WorkPiece[]>([])
  const [panel, setPanel] = useState<Panel | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = toISODate(new Date())

  const loadPieces = useCallback(async () => {
    const [list, prog] = await Promise.all([
      listWorkshopPieces(),
      listOrderProgress(),
    ])
    setPieces(list)
    setProgress(prog)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listOrders(), listOrderItemCounts(), loadPieces()])
      .then(([rows, counts]) => {
        if (cancelled) return
        setOrders(rows)
        setItemCounts(counts)
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el día.',
          ),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [loadPieces])

  const s = useMemo(() => summarize(orders, today), [orders, today])
  const printing = useMemo(
    () => pieces.filter((p) => p.status === 'printing').sort(byPriority),
    [pieces],
  )
  const upNext = useMemo(
    () => pieces.filter((p) => p.status === 'pending').sort(byPriority),
    [pieces],
  )
  const pieceIndex = useMemo(() => {
    const byOrder = new Map<string, WorkPiece[]>()
    for (const p of pieces)
      byOrder.set(p.order_id, [...(byOrder.get(p.order_id) ?? []), p])
    const out = new Map<string, string>()
    for (const list of byOrder.values())
      if (list.length > 1)
        list.forEach((p, i) => out.set(p.id, `${i + 1}/${list.length}`))
    return out
  }, [pieces])

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) =>
    addDaysISO(today, i),
  )
  const upcoming = s.active.filter(
    (o) => o.due_date >= today && o.due_date <= days[DAYS_AHEAD - 1],
  )
  const deliveries = upcoming
    .filter((o) => !day || o.due_date === day)
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        Number(b.urgent) - Number(a.urgent),
    )

  async function finish(piece: WorkPiece) {
    const multi = piece.quantity_total > 1
    setBusyId(piece.id)
    setError(null)
    try {
      if (multi) await incrementPiece(piece.id, 1, current?.id ?? null)
      else await setPieceStatus(piece.id, 'done', current?.id ?? null)
      await loadPieces()
      showToast(
        multi
          ? `+1 ${piece.label} · ${piece.quantity_done + 1}/${piece.quantity_total}`
          : `${piece.label}: impresa`,
        {
          label: 'Deshacer',
          onClick: () =>
            void (
              multi
                ? incrementPiece(piece.id, -1, current?.id ?? null)
                : setPieceStatus(piece.id, 'printing', current?.id ?? null)
            ).then(loadPieces),
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusyId(null)
    }
  }

  const names = (list: OrderWithCustomer[]) =>
    list
      .slice(0, 3)
      .map((o) => o.customers?.name ?? 'Sin cliente')
      .join(', ')
  const firstSoon = s.soon[0]
  const soonProg = firstSoon ? progress[firstSoon.id] : undefined
  const firstWaiting = s.waiting[0]

  const kpis: {
    key: Panel
    n: number
    title: string
    sub: string
  }[] = [
    {
      key: 'late',
      n: s.late.length,
      title: 'Atrasados',
      sub: s.late.length ? names(s.late) : 'Nada atrasado',
    },
    {
      key: 'soon',
      n: s.soon.length,
      title: 'Vencen hoy o mañana',
      sub: firstSoon
        ? `${orderTitle(firstSoon, itemCounts[firstSoon.id])}${soonProg && soonProg.total ? ` · ${soonProg.done} de ${soonProg.total} impresas` : ''}`
        : 'Nada vence hoy ni mañana',
    },
    {
      key: 'waiting',
      n: s.waiting.length,
      title: 'En espera',
      sub: firstWaiting
        ? `${s.review.length ? `${s.review.length} para revisar · ` : ''}${firstWaiting.customers?.name ?? 'Sin cliente'}: “${firstWaiting.waiting_reason}”`
        : 'Nadie sin confirmar',
    },
    {
      key: 'ready',
      n: s.ready.length,
      title: 'Listos para avisar',
      sub: `${formatMoney(s.readyBalance)} a cobrar`,
    },
  ]

  const panelRows =
    panel === 'late'
      ? s.late
      : panel === 'soon'
        ? s.soon
        : panel === 'ready'
          ? s.ready
          : []

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <main className="td">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="page-title">
            {greeting()}, {current?.name}
          </h1>
        </div>
        <div className="page-head__actions">
          <Link to="/admin/ideas?nueva=1" className="btn btn--ghost">
            <Icon name="bulb" size={18} />
            Agregar idea
          </Link>
          <button type="button" className="btn btn--primary" onClick={openNew}>
            <Icon name="plus" />
            Nuevo pedido
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      <NoticesCard compact />

      <div className="td-kpis" role="group" aria-label="Resumen del día">
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`td-kpi td-kpi--${k.key}${k.key === 'waiting' && s.review.length ? ' is-alert' : ''}`}
            aria-expanded={panel === k.key}
            onClick={() => setPanel(panel === k.key ? null : k.key)}
          >
            <span className="td-kpi__n num">{loading ? '–' : k.n}</span>
            <span className="td-kpi__text">
              <strong>{k.title}</strong>
              <span>{loading ? 'Cargando…' : k.sub}</span>
            </span>
            <Icon
              name="next"
              size={18}
              className={`td-kpi__chev${panel === k.key ? ' is-open' : ''}`}
            />
          </button>
        ))}
      </div>

      {panel && (
        <section className="card td-panel" aria-label={PANEL_TITLE[panel]}>
          <div className="card__head">
            <h2 className="card__title">{PANEL_TITLE[panel]}</h2>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPanel(null)}
            >
              <Icon name="close" size={14} />
              Cerrar
            </button>
          </div>
          {panel === 'waiting' ? (
            s.waiting.length === 0 ? (
              <p className="muted">No hay pedidos en espera.</p>
            ) : (
              <>
                <p className="muted td-panel__hint">
                  No están confirmados. ¿Se confirmaron o hay que volver a
                  escribirles?
                </p>
                <WaitingOrders
                  orders={s.waiting}
                  today={today}
                  onChanged={(updated) =>
                    setOrders((prev) =>
                      prev.map((o) => (o.id === updated.id ? updated : o)),
                    )
                  }
                />
              </>
            )
          ) : panelRows.length === 0 ? (
            <p className="muted">Nada por acá.</p>
          ) : (
            <ul className="order-rows">
              {panelRows.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  today={today}
                  progress={progress[order.id]}
                  itemCount={itemCounts[order.id]}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="td-grid">
        <div className="td-col">
          <section className="card td-card" aria-label="Imprimiendo ahora">
            <div className="td-card__head">
              <Icon name="printer" size={20} className="td-card__icon" />
              <h2>Imprimiendo ahora</h2>
              <Link to="/admin/taller" className="td-card__link">
                Ir al taller →
              </Link>
            </div>
            {loading ? (
              <p className="muted">Cargando…</p>
            ) : printing.length === 0 ? (
              <p className="td-empty">
                Ninguna impresora en marcha. Empezá una pieza desde el Taller.
              </p>
            ) : (
              <ul className="td-printing">
                {printing.slice(0, PRINTING_SHOWN).map((p) => {
                  const multi = p.quantity_total > 1
                  const late = !p.flexible && p.due_date < today
                  const where = pieceIndex.get(p.id)
                  return (
                    <li key={p.id}>
                      <span className="td-printing__dot" aria-hidden="true" />
                      <Link
                        to={`/admin/orders/${p.order_id}`}
                        className="td-printing__who"
                      >
                        <strong>
                          {p.label}
                          {multi && ` ×${p.quantity_total}`}
                          {where && ` · ${where}`}
                        </strong>
                        <span>
                          {p.customer_name}
                          {p.urgent
                            ? ' · Urgente'
                            : late
                              ? ` · atrasado ${daysBetween(p.due_date, today)} d`
                              : ''}
                        </span>
                      </Link>
                      <span className="td-printing__color">
                        <Dot color={p.color} />
                        {p.color?.trim() || 'Sin color'}
                      </span>
                      <span className="td-printing__since">
                        {sinceText(p.updated_at)}
                      </span>
                      <button
                        type="button"
                        className="td-done"
                        disabled={busyId === p.id}
                        onClick={() => void finish(p)}
                      >
                        <Icon name="check" size={16} />
                        {multi
                          ? `+1 · ${p.quantity_done}/${p.quantity_total}`
                          : 'Impresa'}
                      </button>
                    </li>
                  )
                })}
                {printing.length > PRINTING_SHOWN && (
                  <li className="td-printing__more">
                    <Link to="/admin/taller">
                      +{printing.length - PRINTING_SHOWN} más en el taller
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>

        <div className="td-col">
          <section className="card td-card" aria-label="Próximas entregas">
            <div className="td-card__head">
              <Icon name="box" size={20} className="td-card__icon" />
              <h2>Próximas entregas</h2>
              <Link to="/admin/semana" className="td-card__link">
                Semana →
              </Link>
            </div>
            <div className="td-days" role="group" aria-label="Elegir día">
              {days.map((d) => {
                const n = upcoming.filter((o) => o.due_date === d).length
                return (
                  <button
                    key={d}
                    type="button"
                    className={`td-day${d === today ? ' is-today' : ''}`}
                    aria-pressed={day === d}
                    onClick={() => setDay(day === d ? null : d)}
                  >
                    <span className="td-day__name">
                      {cap(weekday(d))} {Number(d.slice(8))}
                    </span>
                    <span className="td-day__n num">{n}</span>
                    <span className="td-day__word">
                      {n === 1 ? 'entrega' : 'entregas'}
                    </span>
                  </button>
                )
              })}
            </div>
            {loading ? (
              <p className="muted">Cargando…</p>
            ) : deliveries.length === 0 ? (
              <p className="td-empty">
                {day
                  ? 'Nada para entregar ese día.'
                  : 'Sin entregas en estos días.'}
              </p>
            ) : (
              <ul className="td-deliv">
                {deliveries.slice(0, DELIVERIES_SHOWN).map((o) => {
                  const prog = progress[o.id]
                  const pct =
                    prog && prog.total
                      ? Math.round((prog.done / prog.total) * 100)
                      : 0
                  return (
                    <li key={o.id}>
                      <Link to={`/admin/orders/${o.id}`}>
                        <span className="td-deliv__who">
                          <strong>{o.customers?.name ?? 'Sin cliente'}</strong>
                          <span>{orderTitle(o, itemCounts[o.id])}</span>
                        </span>
                        <span className="td-deliv__prog">
                          {prog && prog.total ? (
                            <>
                              <span
                                className={`td-bar${pct >= 100 ? ' is-done' : ''}`}
                                aria-hidden="true"
                              >
                                <i style={{ width: `${pct}%` }} />
                              </span>
                              <span>
                                {prog.done} de {prog.total} impresas
                              </span>
                            </>
                          ) : (
                            <span>Sin piezas cargadas</span>
                          )}
                        </span>
                        <span
                          className={`td-deliv__day${o.urgent ? ' is-urgent' : ''}`}
                        >
                          {dayWord(o.due_date, today)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {deliveries.length > DELIVERIES_SHOWN && (
                  <li className="td-deliv__more">
                    <Link to="/admin/semana">
                      +{deliveries.length - DELIVERIES_SHOWN} más en Semana
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section
            className="card td-card"
            aria-label="Lo próximo para imprimir"
          >
            <div className="td-card__head">
              <Icon name="calendar" size={20} className="td-card__icon" />
              <h2>Lo próximo para imprimir</h2>
              <Link to="/admin/taller" className="td-card__link">
                Ver cola →
              </Link>
            </div>
            {loading ? (
              <p className="muted">Cargando…</p>
            ) : upNext.length === 0 ? (
              <p className="td-empty">No hay piezas esperando. Todo impreso.</p>
            ) : (
              <ul className="td-next">
                {upNext.slice(0, NEXT_SHOWN).map((p) => {
                  const left = p.quantity_total - p.quantity_done
                  const due = pieceDue(p, today)
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/admin/orders/${p.order_id}`}
                        className={`td-chip${p.urgent ? ' is-urgent' : ''}`}
                      >
                        <strong>
                          {p.label}
                          {left > 1 && ` ×${left}`}
                          {p.color?.trim() && ` · ${p.color.trim()}`}
                        </strong>
                        <span className={due.startsWith('+') ? 'is-late' : ''}>
                          {due}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {upNext.length > NEXT_SHOWN && (
                  <li>
                    <Link to="/admin/taller" className="td-chip td-chip--more">
                      +{upNext.length - NEXT_SHOWN} más
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
      {toast}
    </main>
  )
}

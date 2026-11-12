import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { listNotices } from '@/features/notices/notices.api'
import { visibleNotices, type Notice } from '@/features/notices/notices'
import { useOperator } from '@/features/operators/operator-context'
import { useOrderModal } from '@/features/orders/order-modal-context'
import {
  listOpenOrders,
  listOrderItemCounts,
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
import { orderTitle } from './OrderRow'
import { colorSwatch } from './pieces'
import { incrementPiece, setPieceStatus, type PieceRow } from './production.api'
import { listWorkshopPieces, type WorkPiece } from './workshop.api'
import './production.css'
import './today.css'

const CLOSED = ['finished', 'delivered', 'cancelled']
const LATE_SHOWN = 5
const PRINTING_SHOWN = 4
const DELIVER_SHOWN = 6

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

// Printed / total quantities per order, straight from the workshop pieces
// (they already include the printed ones), so Hoy needs no second query.
export function progressByOrder(
  pieces: readonly WorkPiece[],
): Record<string, { done: number; total: number }> {
  const out: Record<string, { done: number; total: number }> = {}
  for (const p of pieces) {
    const entry = (out[p.order_id] ??= { done: 0, total: 0 })
    entry.done += p.quantity_done
    entry.total += p.quantity_total
  }
  return out
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
  if (diff < 0) return `atrasado ${-diff} d`
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

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <span
      className={`td-bar${pct >= 100 ? ' is-done' : ''}`}
      aria-hidden="true"
    >
      <i style={{ width: `${pct}%` }} />
    </span>
  )
}

export default function TodayPage() {
  const { current } = useOperator()
  const { openNew } = useOrderModal()
  const [toast, showToast] = useToast()
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [pieces, setPieces] = useState<WorkPiece[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = toISODate(new Date())

  const load = useCallback(async () => {
    const [rows, list] = await Promise.all([
      listOpenOrders(),
      listWorkshopPieces(),
    ])
    setOrders(rows)
    setPieces(list)
    return rows
  }, [])

  useEffect(() => {
    let cancelled = false
    // Avisos are a side note: if they fail, the day still loads.
    listNotices()
      .then((rows) => !cancelled && setNotices(rows))
      .catch(() => undefined)
    load()
      .then((rows) => {
        if (!cancelled) setLoading(false)
        // Item counts only name multi-item orders ("3 ítems"): load them after.
        return listOrderItemCounts(rows.map((o) => o.id))
      })
      .then((counts) => !cancelled && setItemCounts(counts))
      .catch((err) => {
        if (cancelled) return
        setLoading(false)
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar el día.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const s = useMemo(() => summarize(orders, today), [orders, today])
  const progress = useMemo(() => progressByOrder(pieces), [pieces])
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

  const openNotices = visibleNotices(notices).filter((n) => !n.done_at)
  const importantNotice = openNotices.some((n) => n.priority === 'alta')
  const waitingLater = s.waiting.length - s.review.length
  const attendCount = s.late.length + s.review.length
  const deliver = [...s.soon, ...s.ready]

  // Show the piece right away, then pick up whatever the database changed
  // around it (the order may now be finished) without blocking the screen.
  function mergePiece(row: PieceRow) {
    setPieces((prev) =>
      prev.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
    )
    void load().catch(() => undefined)
  }

  async function finish(piece: WorkPiece) {
    const multi = piece.quantity_total > 1
    const who = current?.id ?? null
    setBusyId(piece.id)
    setError(null)
    try {
      mergePiece(
        multi
          ? await incrementPiece(piece.id, 1, who)
          : await setPieceStatus(piece.id, 'done', who),
      )
      showToast(
        multi
          ? `+1 ${piece.label} · ${piece.quantity_done + 1}/${piece.quantity_total}`
          : `${piece.label}: impresa`,
        {
          label: 'Deshacer',
          onClick: () =>
            void (
              multi
                ? incrementPiece(piece.id, -1, who)
                : setPieceStatus(piece.id, 'printing', who)
            ).then(mergePiece),
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusyId(null)
    }
  }

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const next = upNext[0]

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
          <Link
            to="/admin/avisos"
            className={`td-notices${importantNotice ? ' is-important' : ''}`}
          >
            <Icon name="flag" size={16} />
            {openNotices.length === 0
              ? 'Sin avisos'
              : openNotices.length === 1
                ? '1 aviso'
                : `${openNotices.length} avisos`}
          </Link>
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

      <div className="td-cols">
        <section className="td-col" aria-label="Atender">
          <div className="td-col__head">
            <h2>Atender</h2>
            {!loading && attendCount > 0 && (
              <span className="td-col__count num">{attendCount}</span>
            )}
          </div>
          {loading ? (
            <p className="td-empty">Cargando…</p>
          ) : attendCount === 0 ? (
            <p className="td-empty">Nada atrasado ni para revisar.</p>
          ) : (
            <>
              {s.late.length > 0 && (
                <ul className="td-list">
                  {s.late.slice(0, LATE_SHOWN).map((o) => {
                    const prog = progress[o.id]
                    return (
                      <li key={o.id}>
                        <Link to={`/admin/orders/${o.id}`} className="td-c">
                          <span className="td-c__top">
                            <strong>{orderTitle(o, itemCounts[o.id])}</strong>
                            <span className="td-tag td-tag--late">
                              +{daysBetween(o.due_date, today)} d
                            </span>
                          </span>
                          <span className="td-c__sub">
                            {o.customers?.name ?? 'Sin cliente'}
                            {o.urgent && ' · Urgente'}
                            {prog && prog.total
                              ? ` · ${prog.done} de ${prog.total} impresas`
                              : ' · sin piezas cargadas'}
                          </span>
                          {prog && prog.total > 0 && <Bar {...prog} />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              {s.late.length > LATE_SHOWN && (
                <Link to="/admin/orders" className="td-col__more">
                  +{s.late.length - LATE_SHOWN} atrasados más
                </Link>
              )}
              {s.review.length > 0 && (
                <div className="td-c td-c--waiting">
                  <WaitingOrders
                    orders={s.review}
                    today={today}
                    onChanged={(updated) =>
                      setOrders((prev) =>
                        prev.map((o) => (o.id === updated.id ? updated : o)),
                      )
                    }
                  />
                </div>
              )}
            </>
          )}
          {!loading && waitingLater > 0 && (
            <Link to="/admin/orders" className="td-col__more">
              {waitingLater === 1
                ? '1 en espera para más adelante'
                : `${waitingLater} en espera para más adelante`}
            </Link>
          )}
        </section>

        <section className="td-col" aria-label="Imprimir">
          <div className="td-col__head">
            <h2>Imprimir</h2>
            {!loading && (
              <span className="td-col__sub">
                {printing.length} en marcha · {upNext.length} en cola
              </span>
            )}
            <Link to="/admin/taller" className="td-col__link">
              Taller
            </Link>
          </div>
          {loading ? (
            <p className="td-empty">Cargando…</p>
          ) : (
            <>
              {printing.length === 0 ? (
                <p className="td-empty">Ninguna impresora en marcha.</p>
              ) : (
                <ul className="td-list">
                  {printing.slice(0, PRINTING_SHOWN).map((p) => {
                    const multi = p.quantity_total > 1
                    const late = !p.flexible && p.due_date < today
                    const where = pieceIndex.get(p.id)
                    return (
                      <li key={p.id} className="td-c">
                        <Link
                          to={`/admin/orders/${p.order_id}`}
                          className="td-c__link"
                        >
                          <span className="td-c__top">
                            <strong>
                              {p.label}
                              {where && ` · ${where}`}
                            </strong>
                            <span className="td-c__since">
                              {sinceText(p.updated_at)}
                            </span>
                          </span>
                          <span className="td-c__sub">
                            <Dot color={p.color} />
                            {p.color?.trim() || 'Sin color'} · {p.customer_name}
                            {p.urgent ? (
                              <b className="is-urgent"> · Urgente</b>
                            ) : (
                              late && (
                                <b className="is-late">
                                  {' '}
                                  · atrasado {daysBetween(p.due_date, today)} d
                                </b>
                              )
                            )}
                          </span>
                        </Link>
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
                </ul>
              )}
              {printing.length > PRINTING_SHOWN && (
                <Link to="/admin/taller" className="td-col__more">
                  +{printing.length - PRINTING_SHOWN} más en el taller
                </Link>
              )}
              {next ? (
                <Link
                  to={`/admin/orders/${next.order_id}`}
                  className={`td-next${next.urgent ? ' is-urgent' : ''}`}
                >
                  <span className="td-next__label">Lo próximo</span>
                  <strong>
                    {next.label}
                    {next.quantity_total - next.quantity_done > 1 &&
                      ` ×${next.quantity_total - next.quantity_done}`}
                    {next.color?.trim() && ` · ${next.color.trim()}`}
                  </strong>
                  <span>{next.urgent ? 'urgente' : pieceDue(next, today)}</span>
                </Link>
              ) : (
                <p className="td-empty">No hay piezas esperando.</p>
              )}
            </>
          )}
        </section>

        <section className="td-col" aria-label="Entregar">
          <div className="td-col__head">
            <h2>Entregar</h2>
            {!loading && (
              <span className="td-col__sub">
                {s.ready.length
                  ? `${formatMoney(s.readyBalance)} a cobrar`
                  : 'hoy y mañana'}
              </span>
            )}
            <Link to="/admin/semana" className="td-col__link">
              Semana
            </Link>
          </div>
          {loading ? (
            <p className="td-empty">Cargando…</p>
          ) : deliver.length === 0 ? (
            <p className="td-empty">Nada para entregar hoy ni mañana.</p>
          ) : (
            <ul className="td-list">
              {deliver.slice(0, DELIVER_SHOWN).map((o) => {
                const ready = o.status === 'finished'
                const prog = progress[o.id]
                const word = dayWord(o.due_date, today)
                return (
                  <li key={o.id}>
                    <Link to={`/admin/orders/${o.id}`} className="td-c">
                      <span className="td-c__top">
                        <strong>{o.customers?.name ?? 'Sin cliente'}</strong>
                        <span
                          className={`td-tag ${
                            ready
                              ? 'td-tag--ready'
                              : word === 'Hoy' || o.urgent
                                ? 'td-tag--today'
                                : ''
                          }`}
                        >
                          {ready ? 'Listo' : o.urgent ? 'Urgente' : word}
                        </span>
                      </span>
                      <span className="td-c__sub">
                        {orderTitle(o, itemCounts[o.id])}
                        {ready
                          ? (o.pending_balance ?? 0) > 0
                            ? ` · ${formatMoney(o.pending_balance ?? 0)} a cobrar`
                            : ' · pagado'
                          : prog && prog.total
                            ? ` · ${prog.done} de ${prog.total} impresas`
                            : ' · sin piezas cargadas'}
                      </span>
                      {!ready && prog && prog.total > 0 && <Bar {...prog} />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {!loading && deliver.length > DELIVER_SHOWN && (
            <Link to="/admin/semana" className="td-col__more">
              +{deliver.length - DELIVER_SHOWN} más en Semana
            </Link>
          )}
        </section>
      </div>
      {toast}
    </main>
  )
}

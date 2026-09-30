import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
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
import { isWaiting, needsReview } from '@/features/orders/orderFlow'
import WaitingOrders from '@/features/orders/WaitingOrders'
import OrderRow from './OrderRow'
import QueueList from './QueueList'
import { listOrderProgress, type OrderProgress } from './production.api'
import { useQueue } from './useQueue'
import './production.css'

type Tab = 'urgent' | 'all' | 'ready' | 'late' | 'soon' | 'production'

const TAB_TITLE: Record<Tab, string> = {
  urgent: 'Pedidos por fecha',
  all: 'Pedidos por fecha',
  ready: 'Pedidos por fecha',
  late: 'Atrasados',
  soon: 'Vencen hoy o mañana',
  production: 'En producción',
}

const CLOSED = ['finished', 'delivered', 'cancelled']

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
  return {
    active,
    urgent,
    review: orders.filter((o) => needsReview(o, today)),
    late: urgent.filter((o) => o.due_date < today),
    soon: urgent.filter((o) => o.due_date >= today && o.due_date <= tomorrow),
    inProduction: active.filter(
      (o) => o.status === 'printing' || o.status === 'post_processing',
    ),
    ready,
    readyBalance: ready.reduce((sum, o) => sum + (o.pending_balance ?? 0), 0),
  }
}

export default function TodayPage() {
  const { current } = useOperator()
  const { openNew } = useOrderModal()
  const [toast, showToast] = useToast()
  const queue = useQueue(showToast)
  const [orders, setOrders] = useState<OrderWithCustomer[]>([])
  const [progress, setProgress] = useState<Record<string, OrderProgress>>({})
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<Tab>('urgent')
  const listRef = useRef<HTMLElement>(null)

  // KPI cards filter the list below and bring it into view.
  function showTab(next: Tab) {
    setTab(next)
    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = toISODate(new Date())

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
            err instanceof Error ? err.message : 'No se pudo cargar el día.',
          ),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const s = useMemo(() => summarize(orders, today), [orders, today])
  const queued = queue.pieces.reduce(
    (sum, p) => sum + p.quantity_total - p.quantity_done,
    0,
  )

  const rows = useMemo(() => {
    const byDue = (a: OrderWithCustomer, b: OrderWithCustomer) =>
      a.due_date.localeCompare(b.due_date)
    if (tab === 'ready') return [...s.ready].sort(byDue)
    if (tab === 'all') return [...s.active].sort(byDue)
    if (tab === 'late') return [...s.late].sort(byDue)
    if (tab === 'soon') return [...s.soon].sort(byDue)
    if (tab === 'production') return [...s.inProduction].sort(byDue)
    const horizon = addDaysISO(today, 3)
    return s.urgent.filter((o) => o.due_date <= horizon).sort(byDue)
  }, [tab, s, today])

  const dateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <main>
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">{dateLabel}</p>
          <h1 className="page-title">
            {greeting()}, {current?.name}
          </h1>
        </div>
        <div className="page-head__actions">
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

      <div className="kpis" role="group" aria-label="Filtrar pedidos">
        {(
          [
            [
              'late',
              'Atrasados',
              'var(--status-red)',
              s.late.length,
              'pedidos con fecha vencida',
            ],
            [
              'soon',
              'Vencen hoy / mañana',
              'var(--color-orange)',
              s.soon.length,
              'a entregar pronto',
            ],
            [
              'production',
              'En producción',
              'var(--status-violet)',
              s.inProduction.length,
              `${queued} piezas en cola`,
            ],
            [
              'ready',
              'Listos para avisar',
              'var(--color-teal)',
              s.ready.length,
              `${formatMoney(s.readyBalance)} de saldo a cobrar`,
            ],
          ] as const
        ).map(([key, label, color, value, foot]) => (
          <button
            key={key}
            type="button"
            className="kpi kpi--btn"
            aria-pressed={tab === key}
            onClick={() => showTab(tab === key ? 'urgent' : key)}
          >
            <span className="kpi__label">
              <span className="kpi__dot" style={{ background: color }} />
              {label}
            </span>
            <span className="kpi__value num">{loading ? '–' : value}</span>
            <span className="kpi__foot num">{foot}</span>
          </button>
        ))}
      </div>

      {!loading && s.review.length > 0 && (
        <section className="card today-review">
          <div className="card__head">
            <Icon name="alert" className="accent-icon" />
            <h2 className="card__title">
              Para revisar: {s.review.length} pedido
              {s.review.length === 1 ? '' : 's'} en espera
            </h2>
            <span className="spacer" />
            <Link to="/admin/orders" className="btn btn--ghost btn--sm">
              Ver todos
            </Link>
          </div>
          <p className="muted today-review__hint">
            No están confirmados. ¿Se confirmaron o hay que volver a
            escribirles?
          </p>
          <WaitingOrders
            orders={s.review}
            today={today}
            onChanged={(updated) =>
              setOrders((prev) =>
                prev.map((o) => (o.id === updated.id ? updated : o)),
              )
            }
          />
        </section>
      )}

      <div className="today-grid">
        <section className="card today-list" ref={listRef}>
          <div className="card__head">
            <h2 className="card__title">{TAB_TITLE[tab]}</h2>
            {TAB_TITLE[tab] !== TAB_TITLE.urgent && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setTab('urgent')}
              >
                <Icon name="close" size={14} />
                Quitar filtro
              </button>
            )}
            <span className="spacer" />
            <div className="segmented" role="group" aria-label="Filtro">
              <button
                type="button"
                aria-pressed={tab === 'urgent'}
                onClick={() => setTab('urgent')}
              >
                Urgentes
              </button>
              <button
                type="button"
                aria-pressed={tab === 'all'}
                onClick={() => setTab('all')}
              >
                Todos
              </button>
              <button
                type="button"
                aria-pressed={tab === 'ready'}
                onClick={() => setTab('ready')}
              >
                Listos
              </button>
            </div>
          </div>
          {loading ? (
            <p className="muted">Cargando…</p>
          ) : rows.length === 0 ? (
            <div className="empty">
              <strong>
                {tab === 'ready'
                  ? 'Nada listo para avisar'
                  : tab === 'late'
                    ? 'Nada atrasado 🎉'
                    : tab === 'soon'
                      ? 'Nada vence hoy ni mañana'
                      : tab === 'production'
                        ? 'Nada en producción'
                        : 'Sin pedidos urgentes'}
              </strong>
              {tab === 'urgent' && 'Nada vence en los próximos 3 días.'}
            </div>
          ) : (
            <ul className="order-rows">
              {rows.map((order) => (
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

        <section className="card">
          <div className="card__head">
            <Icon name="printer" className="accent-icon" />
            <h2 className="card__title">¿Qué imprimo ahora?</h2>
            <span className="spacer" />
            <Link to="/admin/taller" className="btn btn--ghost btn--sm">
              Ver todo
            </Link>
          </div>
          {queue.loading ? (
            <p className="muted">Cargando…</p>
          ) : queue.groups.length === 0 ? (
            <div className="empty">
              <strong>Cola vacía</strong>
              Las piezas que falten en los pedidos aparecen acá.
            </div>
          ) : (
            <QueueList
              groups={queue.groups}
              today={today}
              busyId={queue.busyId}
              onAdd={(piece, delta) => void queue.add(piece, delta)}
              limit={8}
            />
          )}
        </section>
      </div>
      {toast}
    </main>
  )
}

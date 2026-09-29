import { useEffect, useMemo, useState } from 'react'
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
import OrderRow from './OrderRow'
import QueueList from './QueueList'
import { listOrderProgress, type OrderProgress } from './production.api'
import { useQueue } from './useQueue'
import './production.css'

type Tab = 'urgent' | 'all' | 'ready'

const CLOSED = ['finished', 'delivered', 'cancelled']

function greeting(): string {
  const h = new Date().getHours()
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

export function summarize(orders: readonly OrderWithCustomer[], today: string) {
  const active = orders.filter((o) => !CLOSED.includes(o.status))
  const tomorrow = addDaysISO(today, 1)
  const ready = orders.filter((o) => o.status === 'finished')
  return {
    active,
    late: active.filter((o) => o.due_date < today),
    soon: active.filter((o) => o.due_date >= today && o.due_date <= tomorrow),
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
    const horizon = addDaysISO(today, 3)
    return s.active.filter((o) => o.due_date <= horizon).sort(byDue)
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

      <div className="kpis">
        <div className="kpi">
          <p className="kpi__label">
            <span
              className="kpi__dot"
              style={{ background: 'var(--status-red)' }}
            />
            Atrasados
          </p>
          <p className="kpi__value num">{loading ? '–' : s.late.length}</p>
          <p className="kpi__foot">pedidos con fecha vencida</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">
            <span
              className="kpi__dot"
              style={{ background: 'var(--color-orange)' }}
            />
            Vencen hoy / mañana
          </p>
          <p className="kpi__value num">{loading ? '–' : s.soon.length}</p>
          <p className="kpi__foot">a entregar pronto</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">
            <span
              className="kpi__dot"
              style={{ background: 'var(--status-violet)' }}
            />
            En producción
          </p>
          <p className="kpi__value num">
            {loading ? '–' : s.inProduction.length}
          </p>
          <p className="kpi__foot num">{queued} piezas en cola</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">
            <span
              className="kpi__dot"
              style={{ background: 'var(--color-teal)' }}
            />
            Listos para avisar
          </p>
          <p className="kpi__value num">{loading ? '–' : s.ready.length}</p>
          <p className="kpi__foot num">
            {formatMoney(s.readyBalance)} de saldo a cobrar
          </p>
        </div>
      </div>

      <div className="today-grid">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Pedidos por fecha</h2>
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
            <Link to="/admin/imprimir" className="btn btn--ghost btn--sm">
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
              onPlus={queue.plus}
              limit={8}
            />
          )}
        </section>
      </div>
      {toast}
    </main>
  )
}

import { useMemo, useState } from 'react'
import { useToast } from '@/components/useToast'
import { toISODate } from '@/features/orders/validation'
import QueueList from './QueueList'
import { weekBucket, type WeekBucket } from './due'
import {
  groupQueueByColor,
  groupQueueByCustomer,
  normalizeColor,
  sortQueueGroups,
} from './pieces'
import SortSelect, { useStoredSort } from './SortSelect'
import type { QueuePiece } from './production.api'
import { useQueue } from './useQueue'
import './production.css'

const GROUP_KEY = 'g3d.queueGroup'

const WEEKS: { key: WeekBucket; label: string; hint: string }[] = [
  { key: 'late', label: 'Atrasado', hint: 'ya pasó la fecha' },
  { key: 'this', label: 'Esta semana', hint: 'hasta el domingo' },
  { key: 'next', label: 'Próxima semana', hint: 'lunes a domingo' },
  { key: 'later', label: 'Más adelante', hint: 'después' },
]

type GroupBy = 'color' | 'customer'

function readGroup(): GroupBy {
  try {
    return localStorage.getItem(GROUP_KEY) === 'customer' ? 'customer' : 'color'
  } catch {
    return 'color'
  }
}

const leftOf = (list: readonly QueuePiece[]) =>
  list.reduce((sum, p) => sum + p.quantity_total - p.quantity_done, 0)

export default function PrintQueuePage() {
  const [toast, showToast] = useToast()
  const { pieces, relaxed, loading, error, busyId, plus } = useQueue(showToast)
  const [week, setWeek] = useState<WeekBucket | null>(null)
  const [customer, setCustomer] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>(readGroup)
  const [sort, setSort] = useStoredSort('g3d.queueSort')
  const today = toISODate(new Date())

  function changeGroup(next: GroupBy) {
    setGroupBy(next)
    try {
      localStorage.setItem(GROUP_KEY, next)
    } catch {
      /* preferencia opcional */
    }
  }

  // Everything except the week filter, so the week tiles show what each week
  // holds under the other filters.
  const base = useMemo(
    () =>
      pieces.filter(
        (p) =>
          (!customer || p.customer_id === customer) &&
          (color === null || normalizeColor(p.color) === color),
      ),
    [pieces, customer, color],
  )
  const filtered = useMemo(
    () =>
      week ? base.filter((p) => weekBucket(p.due_date, today) === week) : base,
    [base, week, today],
  )
  const groups = useMemo(
    () =>
      sortQueueGroups(
        groupBy === 'customer'
          ? groupQueueByCustomer(filtered)
          : groupQueueByColor(filtered),
        sort,
      ),
    [filtered, groupBy, sort],
  )

  const weekCounts = useMemo(() => {
    const out: Record<WeekBucket, number> = {
      late: 0,
      this: 0,
      next: 0,
      later: 0,
    }
    for (const p of base)
      out[weekBucket(p.due_date, today)] += p.quantity_total - p.quantity_done
    return out
  }, [base, today])

  const customers = useMemo(() => {
    const map = new Map<string, { name: string; left: number }>()
    for (const p of pieces) {
      const entry = map.get(p.customer_id) ?? { name: p.customer_name, left: 0 }
      entry.left += p.quantity_total - p.quantity_done
      map.set(p.customer_id, entry)
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [pieces])

  // "Sin apuro": same customer/color filters, no week (their date is a guide).
  const relaxedGroups = useMemo(() => {
    const list = relaxed.filter(
      (p) =>
        (!customer || p.customer_id === customer) &&
        (color === null || normalizeColor(p.color) === color),
    )
    return sortQueueGroups(
      groupBy === 'customer'
        ? groupQueueByCustomer(list)
        : groupQueueByColor(list),
      sort,
    )
  }, [relaxed, customer, color, groupBy, sort])
  const relaxedLeft = relaxedGroups.reduce((s, g) => s + leftOf(g.entries), 0)

  const colors = useMemo(() => groupQueueByColor(pieces), [pieces])
  const total = leftOf(filtered)
  const anyFilter = Boolean(week || customer || color !== null)
  const first = groups[0]

  function clearFilters() {
    setWeek(null)
    setCustomer('')
    setColor(null)
  }

  return (
    <main className="queue-page">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Cola de impresión</p>
          <h1 className="page-title">
            {total === 0 ? (
              anyFilter ? (
                'Nada con estos filtros'
              ) : (
                'No hay piezas pendientes'
              )
            ) : (
              <>
                <span className="num">{total}</span>{' '}
                {total === 1 ? 'pieza' : 'piezas'} en cola.
                {first && (
                  <span className="muted">
                    {' '}
                    Empezá por{' '}
                    {groupBy === 'color'
                      ? first.label.toLowerCase()
                      : first.label}
                    .
                  </span>
                )}
              </>
            )}
          </h1>
        </div>
        <div className="page-head__actions">
          <div className="segmented" aria-label="Agrupar">
            <button
              type="button"
              aria-pressed={groupBy === 'color'}
              onClick={() => changeGroup('color')}
            >
              Por color
            </button>
            <button
              type="button"
              aria-pressed={groupBy === 'customer'}
              onClick={() => changeGroup('customer')}
            >
              Por cliente
            </button>
          </div>
        </div>
      </header>

      <div className="qweeks" role="group" aria-label="Filtrar por semana">
        {WEEKS.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`qweek qweek--${w.key}`}
            aria-pressed={week === w.key}
            onClick={() => setWeek(week === w.key ? null : w.key)}
          >
            <span className="qweek__n num">{weekCounts[w.key]}</span>
            <span className="qweek__label">{w.label}</span>
            <span className="qweek__hint">{w.hint}</span>
          </button>
        ))}
      </div>

      <div className="queue-tools">
        <select
          className="input queue-tools__customer"
          aria-label="Filtrar por cliente"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        >
          <option value="">Todos los clientes ({customers.length})</option>
          {customers.map(([id, c]) => (
            <option key={id} value={id}>
              {c.name} · {c.left}
            </option>
          ))}
        </select>
        <SortSelect value={sort} onChange={setSort} />

        {anyFilter && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {colors.length > 1 && (
        <div
          className="chips queue-colors"
          role="group"
          aria-label="Filtrar por color"
        >
          {colors.map((g) => (
            <button
              key={g.key}
              type="button"
              className="chip"
              aria-pressed={color === g.key}
              onClick={() => setColor(color === g.key ? null : g.key)}
            >
              <span
                className={`swatch${g.swatch ? '' : ' swatch--unknown'}`}
                style={g.swatch ? { background: g.swatch } : undefined}
              />
              {g.label} · {leftOf(g.entries)}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : groups.length === 0 ? (
        <div className="empty card">
          <strong>
            {anyFilter ? 'Nada con estos filtros' : 'Nada para imprimir'}
          </strong>
          {anyFilter
            ? 'Probá con otra semana o cliente.'
            : 'Cargá piezas desde el detalle de cada pedido y van a aparecer en esta cola.'}
        </div>
      ) : (
        <QueueList
          groups={groups}
          today={today}
          busyId={busyId}
          onPlus={plus}
          by={groupBy}
        />
      )}

      {!loading && relaxedGroups.length > 0 && (
        <details className="qrelaxed">
          <summary>
            <span className="qrelaxed__title">Cuando haya tiempo</span>
            <span className="qrelaxed__count num">
              {relaxedLeft} {relaxedLeft === 1 ? 'pieza' : 'piezas'}
            </span>
            <span className="qrelaxed__hint">
              Pedidos sin apuro: para aprovechar una impresora libre.
            </span>
          </summary>
          <QueueList
            groups={relaxedGroups}
            today={today}
            busyId={busyId}
            onPlus={plus}
            by={groupBy}
            relaxed
          />
        </details>
      )}
      {toast}
    </main>
  )
}

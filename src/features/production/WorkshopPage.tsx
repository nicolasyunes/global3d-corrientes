import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import { updateOrder } from '@/features/orders/orders.api'
import {
  dueText,
  PartsBar,
  PostMarks,
  UrgentBadge,
} from '@/features/orders/stage-ui'
import { partsProgress } from '@/features/orders/stage'
import { toISODate } from '@/features/orders/validation'
import { weekBucket, type WeekBucket } from './due'
import { colorSwatch, normalizeColor, type PieceStatus } from './pieces'
import { incrementPiece, setPieceStatus } from './production.api'
import SortSelect, { useStoredSort } from './SortSelect'
import {
  listWorkshopPieces,
  logOrderEvent,
  type WorkPiece,
} from './workshop.api'
import '@/features/orders/taller.css'

type View = 'table' | 'board'
type Tab = 'print' | 'post'

const VIEW_KEY = 'g3d.workshopView'
const COLORS_SHOWN = 3

const WEEKS: { key: WeekBucket; label: string }[] = [
  { key: 'late', label: 'Atrasado' },
  { key: 'this', label: 'Esta semana' },
  { key: 'next', label: 'Próxima' },
  { key: 'later', label: 'Más adelante' },
]

const PIECE_STATES: { key: PieceStatus; label: string }[] = [
  { key: 'pending', label: 'Pendiente' },
  { key: 'printing', label: 'Imprimiendo' },
  { key: 'done', label: 'Impresa' },
]

export interface WorkOrder {
  id: string
  customer_id: string
  customer: string
  title: string
  due_date: string
  created_at: string
  updated_at: string
  status: WorkPiece['order_status']
  urgent: boolean
  flexible: boolean
  pp_sand: boolean
  pp_paint: boolean
  pp_notes: string | null
  sand_done: boolean
  paint_done: boolean
  pieces: WorkPiece[]
}

// Pieces come flat from the database; the workshop thinks in orders.
export function groupByOrder(pieces: readonly WorkPiece[]): WorkOrder[] {
  const map = new Map<string, WorkOrder>()
  for (const p of pieces) {
    let order = map.get(p.order_id)
    if (!order) {
      order = {
        id: p.order_id,
        customer_id: p.customer_id,
        customer: p.customer_name,
        title: p.order_title?.trim() ?? '',
        due_date: p.due_date,
        created_at: p.order_created_at,
        updated_at: p.order_updated_at,
        status: p.order_status,
        urgent: p.urgent,
        flexible: p.flexible,
        pp_sand: p.pp_sand,
        pp_paint: p.pp_paint,
        pp_notes: p.pp_notes,
        sand_done: p.sand_done,
        paint_done: p.paint_done,
        pieces: [],
      }
      map.set(p.order_id, order)
    }
    order.pieces.push(p)
  }
  for (const order of map.values()) {
    if (!order.title) {
      const names = [
        ...new Set(order.pieces.map((p) => p.item_label ?? p.label)),
      ]
      order.title = names.slice(0, 3).join(' · ')
    }
  }
  return [...map.values()]
}

// Urgent first, "sin apuro" last; in between by delivery date (or by when the
// order was loaded).
export function sortWorkOrders(
  orders: WorkOrder[],
  sort: 'due' | 'newest' | 'oldest',
): WorkOrder[] {
  const rank = (o: WorkOrder) => (o.urgent ? 0 : o.flexible ? 2 : 1)
  return [...orders].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (sort === 'due'
        ? a.due_date.localeCompare(b.due_date)
        : (sort === 'newest' ? -1 : 1) *
          a.created_at.localeCompare(b.created_at)),
  )
}

const colorLabel = (color: string | null) => color?.trim() || 'Sin color'
const leftOf = (p: WorkPiece) => p.quantity_total - p.quantity_done

function ColorDot({ color }: { color: string | null }) {
  const bg = colorSwatch(color)
  return (
    <span
      className={`wk-dot${bg ? '' : ' wk-dot--none'}`}
      style={bg ? { background: bg } : undefined}
      aria-hidden="true"
    />
  )
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'table'
  } catch {
    return 'table'
  }
}

export default function WorkshopPage() {
  const { current } = useOperator()
  const operatorId = current?.id ?? null
  const [toast, showToast] = useToast()
  const [pieces, setPieces] = useState<WorkPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(readView)
  const [tab, setTab] = useState<Tab>('print')
  const [query, setQuery] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [week, setWeek] = useState<WeekBucket | null>(null)
  const [customer, setCustomer] = useState('')
  const [sort, setSort] = useStoredSort('g3d.workshopSort')
  const [showFilters, setShowFilters] = useState(false)
  const [allColors, setAllColors] = useState(false)
  const today = useMemo(() => toISODate(new Date()), [])

  const reload = useCallback(async () => {
    try {
      setPieces(await listWorkshopPieces())
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el taller.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function setView(next: View) {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* preferencia opcional */
    }
  }

  // Apply the change locally, then reload: the database may have moved the
  // order to another stage.
  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = (piece: WorkPiece, status: PieceStatus) => {
    if (piece.status === status) return
    void run(piece.id, async () => {
      const updated = await setPieceStatus(piece.id, status, operatorId)
      setPieces((prev) =>
        prev.map((p) => (p.id === piece.id ? { ...p, ...updated } : p)),
      )
      const label = PIECE_STATES.find((s) => s.key === status)!.label
      showToast(`${piece.label}: ${label.toLowerCase()}`, {
        label: 'Deshacer',
        onClick: () =>
          void run(piece.id, async () => {
            await setPieceStatus(
              piece.id,
              piece.status as PieceStatus,
              operatorId,
            )
          }),
      })
    })
  }

  const addOne = (piece: WorkPiece) =>
    void run(piece.id, async () => {
      const updated = await incrementPiece(piece.id, 1, operatorId)
      showToast(
        `+1 ${piece.label} · ${updated.quantity_done}/${updated.quantity_total}`,
        {
          label: 'Deshacer',
          onClick: () =>
            void run(piece.id, async () => {
              await incrementPiece(piece.id, -1, operatorId)
            }),
        },
      )
    })

  const togglePost = (order: WorkOrder, step: 'sand' | 'paint') =>
    void run(order.id, async () => {
      const field = step === 'sand' ? 'sand_done' : 'paint_done'
      const next = !order[field]
      await updateOrder(order.id, { [field]: next })
      const name = step === 'sand' ? 'Lijado' : 'Pintado'
      await logOrderEvent(
        order.id,
        operatorId,
        'postprocess',
        next ? name : `${name} (desmarcado)`,
      )
      showToast(
        `${order.customer}: ${name.toLowerCase()} ${next ? 'hecho' : 'pendiente'}`,
      )
    })

  const orders = useMemo(() => groupByOrder(pieces), [pieces])
  const toPrint = useMemo(
    () => pieces.filter((p) => p.status !== 'done'),
    [pieces],
  )
  const postOrders = useMemo(
    () =>
      sortWorkOrders(
        orders.filter((o) => o.status === 'post_processing'),
        'due',
      ),
    [orders],
  )
  const finishedToday = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'finished' &&
          toISODate(new Date(o.updated_at)) === today,
      ),
    [orders, today],
  )

  const q = query.trim().toLowerCase()
  const matches = useCallback(
    (p: WorkPiece, withColor = true, withWeek = true) =>
      (!customer || p.customer_id === customer) &&
      (!withColor || color === null || normalizeColor(p.color) === color) &&
      (!withWeek || !week || weekBucket(p.due_date, today) === week) &&
      (!q ||
        [p.customer_name, p.order_title, p.label, p.item_label, p.color]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q))),
    [customer, color, week, today, q],
  )

  const leftTotal = toPrint.reduce((n, p) => n + leftOf(p), 0)

  const colorChips = useMemo(() => {
    const map = new Map<
      string,
      { label: string; color: string | null; n: number }
    >()
    for (const p of toPrint.filter((x) => matches(x, false))) {
      const key = normalizeColor(p.color)
      const entry = map.get(key) ?? {
        label: colorLabel(p.color),
        color: p.color,
        n: 0,
      }
      entry.n += leftOf(p)
      map.set(key, entry)
    }
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [toPrint, matches])

  const weekCounts = useMemo(() => {
    const out: Record<WeekBucket, number> = {
      late: 0,
      this: 0,
      next: 0,
      later: 0,
    }
    for (const p of toPrint.filter((x) => matches(x, true, false)))
      out[weekBucket(p.due_date, today)] += leftOf(p)
    return out
  }, [toPrint, matches, today])

  const customers = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of toPrint) map.set(p.customer_id, p.customer_name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [toPrint])

  // Orders that still have something to print and match the filters; inside
  // each, the matching pieces (printed ones stay visible, dimmed, to undo).
  const printGroups = useMemo(() => {
    const list = orders
      .map((o) => ({
        ...o,
        shown: o.pieces.filter((p) => matches(p)),
      }))
      .filter((o) => o.shown.some((p) => p.status !== 'done'))
    return sortWorkOrders(list, sort) as (WorkOrder & { shown: WorkPiece[] })[]
  }, [orders, matches, sort])

  const folded = (customer ? 1 : 0) + (week ? 1 : 0) + (sort !== 'due' ? 1 : 0)
  const anyFilter = Boolean(customer || week || color !== null || q)

  function clearFilters() {
    setCustomer('')
    setWeek(null)
    setColor(null)
    setQuery('')
  }

  function pieceControls(piece: WorkPiece) {
    const busy = busyId === piece.id
    const multi = piece.quantity_total > 1
    return (
      <div className="wk-controls">
        {multi && piece.status !== 'done' && (
          <button
            type="button"
            className="wk-plus num"
            disabled={busy}
            aria-label={`Sumar 1 a ${piece.label}`}
            title="Sumar una impresa"
            onClick={() => addOne(piece)}
          >
            {piece.quantity_done}/{piece.quantity_total} +1
          </button>
        )}
        <div
          className="wk-seg"
          role="group"
          aria-label={`Estado de ${piece.label}`}
        >
          {PIECE_STATES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`wk-seg__btn wk-seg__btn--${s.key}`}
              aria-pressed={piece.status === s.key}
              disabled={busy}
              onClick={() => setStatus(piece, s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // "pieza 2 de 3": where a piece sits inside its order.
  const pieceIndex = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orders)
      if (o.pieces.length > 1)
        o.pieces.forEach((p, i) =>
          map.set(p.id, `pieza ${i + 1} de ${o.pieces.length}`),
        )
    return map
  }, [orders])

  // Quantity, filament and, on the right, what makes it pressing.
  function cardMeta(
    item: { due_date: string; flexible: boolean; urgent: boolean },
    qty: number | null,
    pieceColor: string | null | undefined,
  ) {
    const due = dueText(item, today, { short: true })
    return (
      <p className="wk-card__meta">
        {qty !== null && <span className="wk-card__qty num">{qty}×</span>}
        {pieceColor !== undefined && (
          <>
            <ColorDot color={pieceColor} />
            <span className="wk-card__color">{colorLabel(pieceColor)}</span>
          </>
        )}
        {item.urgent ? (
          <span className="wk-pill-urgent">Urgente</span>
        ) : (
          <span className={`wk-due${due.late ? ' is-late' : ''}`}>
            {due.late ? due.label.replace(' d', ' días') : due.label}
          </span>
        )}
      </p>
    )
  }

  function pieceSub(piece: WorkPiece) {
    const where = pieceIndex.get(piece.id)
    return where ? `${piece.customer_name} · ${where}` : piece.customer_name
  }

  // Por imprimir: the next piece to load gets the big button; the rest a
  // small one, so any of them can be started.
  function pendingCard(piece: WorkPiece, first: boolean) {
    const busy = busyId === piece.id
    return (
      <li key={piece.id} className={`wk-card${first ? ' wk-card--next' : ''}`}>
        <div className="wk-card__head">
          <Link
            to={`/admin/orders/${piece.order_id}`}
            className="wk-card__title"
          >
            {piece.label}
          </Link>
          {!first && (
            <button
              type="button"
              className="wk-mini"
              disabled={busy}
              aria-label={`Empezar a imprimir ${piece.label}`}
              title="Empezar a imprimir"
              onClick={() => setStatus(piece, 'printing')}
            >
              <Icon name="play" size={14} />
            </button>
          )}
        </div>
        <p className="wk-card__sub">{pieceSub(piece)}</p>
        {cardMeta(
          piece,
          piece.quantity_total - piece.quantity_done,
          piece.color,
        )}
        {first && (
          <button
            type="button"
            className="wk-act wk-act--start"
            disabled={busy}
            onClick={() => setStatus(piece, 'printing')}
          >
            <Icon name="play" size={16} />
            Empezar a imprimir
          </button>
        )}
      </li>
    )
  }

  function printingCard(piece: WorkPiece) {
    const busy = busyId === piece.id
    const multi = piece.quantity_total > 1
    const units = Math.min(piece.quantity_total, 12)
    return (
      <li key={piece.id} className="wk-card">
        <Link to={`/admin/orders/${piece.order_id}`} className="wk-card__title">
          {piece.label}
        </Link>
        <p className="wk-card__sub">{pieceSub(piece)}</p>
        {cardMeta(piece, piece.quantity_total, piece.color)}
        {multi && (
          <div className="wk-units">
            {piece.quantity_total <= 12 ? (
              <span className="wk-units__row" aria-hidden="true">
                {Array.from({ length: units }, (_, i) => (
                  <i
                    key={i}
                    className={
                      i < piece.quantity_done
                        ? 'is-done'
                        : i === piece.quantity_done
                          ? 'is-now'
                          : undefined
                    }
                  />
                ))}
              </span>
            ) : (
              <span className="parts-bar__track" aria-hidden="true">
                <i
                  style={{
                    width: `${Math.round((piece.quantity_done / piece.quantity_total) * 100)}%`,
                  }}
                />
              </span>
            )}
            <span className="wk-units__text">
              {piece.quantity_done} de {piece.quantity_total} impresas
            </span>
          </div>
        )}
        <button
          type="button"
          className="wk-act wk-act--done"
          disabled={busy}
          onClick={() => (multi ? addOne(piece) : setStatus(piece, 'done'))}
        >
          <Icon name="check" size={16} />
          {multi ? '+1 impresa' : 'Impresa'}
        </button>
      </li>
    )
  }

  function postCard(order: WorkOrder, step: 'sand' | 'paint' | null) {
    const busy = busyId === order.id
    const colors = [...new Set(order.pieces.map((p) => colorLabel(p.color)))]
    return (
      <li key={order.id} className="wk-card">
        <Link to={`/admin/orders/${order.id}`} className="wk-card__title">
          {order.title || order.customer}
        </Link>
        <p className="wk-card__sub">
          {order.customer} · {order.pieces.length}{' '}
          {order.pieces.length === 1 ? 'parte' : 'partes'}
        </p>
        {cardMeta(
          order,
          null,
          colors.length === 1 ? order.pieces[0].color : undefined,
        )}
        {step === 'paint' && order.pp_notes && (
          <p className="wk-card__quote">“{order.pp_notes}”</p>
        )}
        {step === 'sand' && order.pp_paint && !order.paint_done && (
          <p className="wk-card__after">
            Después:
            <span className="wk-chip-paint">
              <Icon name="brush" size={13} />
              Pintar
            </span>
          </p>
        )}
        {step ? (
          <button
            type="button"
            className="wk-act wk-act--ghost"
            disabled={busy}
            onClick={() => togglePost(order, step)}
          >
            <Icon name="check" size={16} />
            {step === 'sand' ? 'Lijada' : 'Pintada'}
          </button>
        ) : (
          <p className="wk-card__sub">
            No tiene lijado ni pintura marcados: pasalo de etapa desde el
            pedido.
          </p>
        )}
      </li>
    )
  }

  const shownPieces = printGroups.flatMap((g) => g.shown)
  const pendingByColor = useMemo(() => {
    const map = new Map<string, { label: string; pieces: WorkPiece[] }>()
    for (const p of shownPieces.filter((x) => x.status === 'pending')) {
      const key = normalizeColor(p.color)
      const entry = map.get(key) ?? { label: colorLabel(p.color), pieces: [] }
      entry.pieces.push(p)
      map.set(key, entry)
    }
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printGroups])
  const printing = shownPieces.filter((p) => p.status === 'printing')
  const printingColors = new Set(printing.map((p) => normalizeColor(p.color)))
  const pendingCount = pendingByColor.reduce((n, g) => n + g.pieces.length, 0)
  const colorsShown = allColors
    ? pendingByColor
    : pendingByColor.slice(0, COLORS_SHOWN)

  const toSand = postOrders.filter((o) => o.pp_sand && !o.sand_done)
  const toPaint = postOrders.filter(
    (o) => o.pp_paint && !o.paint_done && (!o.pp_sand || o.sand_done),
  )
  const undetailed = postOrders.filter(
    (o) => !(o.pp_sand && !o.sand_done) && !(o.pp_paint && !o.paint_done),
  )

  return (
    <main className="wk">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">
            {leftTotal} {leftTotal === 1 ? 'pieza' : 'piezas'} por imprimir
          </h1>
          <p className="page-sub">
            Acá se mueven piezas, no pedidos. El pedido avanza solo cuando todas
            sus piezas terminan
            {postOrders.length > 0 &&
              ` · ${postOrders.length} ${postOrders.length === 1 ? 'pedido' : 'pedidos'} en posprocesado`}
            .
          </p>
        </div>
        <div className="page-head__actions">
          <label className="orders-search wk-search">
            <Icon name="search" size={18} />
            <span className="visually-hidden">Buscar</span>
            <input
              type="search"
              placeholder="Buscar cliente o pieza…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="Vista del taller">
            <button
              type="button"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              <Icon name="list" size={16} />
              Tabla
            </button>
            <button
              type="button"
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              <Icon name="kanban" size={16} />
              Tablero
            </button>
          </div>
        </div>
      </header>

      {view === 'table' && (
        <div className="wk-tabs" role="tablist" aria-label="Qué ver">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'print'}
            onClick={() => setTab('print')}
          >
            Por imprimir <span className="num">{leftTotal}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'post'}
            onClick={() => setTab('post')}
          >
            Posprocesado <span className="num">{postOrders.length}</span>
          </button>
        </div>
      )}

      {(view === 'board' || tab === 'print') && (
        <div className="wk-filters">
          <span className="wk-filters__label">Color</span>
          <div className="wk-chips" role="group" aria-label="Filtrar por color">
            {colorChips.map(([key, c]) => (
              <button
                key={key}
                type="button"
                className="wk-chip"
                aria-pressed={color === key}
                onClick={() => setColor(color === key ? null : key)}
              >
                <ColorDot color={c.color} />
                {c.label}
                <span className="num">{c.n}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={showFilters}
            aria-controls="wk-more-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filtros
            {folded > 0 && <span className="wk-badge num">{folded}</span>}
          </button>
          {anyFilter && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={clearFilters}
            >
              <Icon name="close" size={14} />
              Limpiar
            </button>
          )}
        </div>
      )}

      {showFilters && (view === 'board' || tab === 'print') && (
        <div id="wk-more-filters" className="wk-more">
          <div
            className="wk-chips"
            role="group"
            aria-label="Filtrar por semana"
          >
            {WEEKS.map((w) => (
              <button
                key={w.key}
                type="button"
                className="wk-chip"
                aria-pressed={week === w.key}
                disabled={weekCounts[w.key] === 0 && week !== w.key}
                onClick={() => setWeek(week === w.key ? null : w.key)}
              >
                {w.label}
                <span className="num">{weekCounts[w.key]}</span>
              </button>
            ))}
          </div>
          <label className="wk-more__field">
            <span className="field-label">Cliente</span>
            <select
              className="input"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Todos ({customers.length})</option>
              {customers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="wk-more__field">
            <span className="field-label">Ordenar</span>
            <SortSelect value={sort} onChange={setSort} />
          </label>
        </div>
      )}

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : view === 'board' ? (
        <div className="wk-board wk-board--5">
          <section className="wk-col wk-col--pending" aria-label="Por imprimir">
            <h2 className="wk-col__head">
              <i className="wk-col__dot" aria-hidden="true" />
              Por imprimir
              <span className="num">{pendingCount}</span>
            </h2>
            {pendingByColor.length === 0 && (
              <p className="wk-col__empty">Nada pendiente.</p>
            )}
            {colorsShown.map((group, gi) => {
              const key = normalizeColor(group.pieces[0].color)
              return (
                <div key={key} className="wk-colorgroup">
                  <h3 className="wk-col__sub">
                    <ColorDot color={group.pieces[0].color} />
                    {group.label} · {group.pieces.length}
                    {printingColors.has(key) && (
                      <span className="wk-loaded">En máquina</span>
                    )}
                  </h3>
                  <ul className="wk-cards">
                    {group.pieces.map((p, i) =>
                      pendingCard(p, gi === 0 && i === 0),
                    )}
                  </ul>
                </div>
              )
            })}
            {pendingByColor.length > COLORS_SHOWN && (
              <button
                type="button"
                className="wk-more-link"
                onClick={() => setAllColors((v) => !v)}
              >
                {allColors
                  ? 'Mostrar menos colores'
                  : `+ ${pendingByColor.length - COLORS_SHOWN} ${pendingByColor.length - COLORS_SHOWN === 1 ? 'color' : 'colores'} más`}
              </button>
            )}
          </section>

          <section className="wk-col wk-col--printing" aria-label="Imprimiendo">
            <h2 className="wk-col__head">
              <i className="wk-col__dot" aria-hidden="true" />
              Imprimiendo
              <span className="num">{printing.length}</span>
            </h2>
            {printing.length === 0 ? (
              <p className="wk-col__empty">Ninguna impresora en marcha.</p>
            ) : (
              <ul className="wk-cards">{printing.map(printingCard)}</ul>
            )}
          </section>

          <section className="wk-col wk-col--sand" aria-label="Lijar">
            <h2 className="wk-col__head">
              <i className="wk-col__dot" aria-hidden="true" />
              Lijar
              <span className="num">{toSand.length}</span>
            </h2>
            {toSand.length + undetailed.length === 0 ? (
              <p className="wk-col__empty">Nada para lijar.</p>
            ) : (
              <ul className="wk-cards">
                {toSand.map((o) => postCard(o, 'sand'))}
                {undetailed.map((o) => postCard(o, null))}
              </ul>
            )}
          </section>

          <section className="wk-col wk-col--paint" aria-label="Pintar">
            <h2 className="wk-col__head">
              <i className="wk-col__dot" aria-hidden="true" />
              Pintar
              <span className="num">{toPaint.length}</span>
            </h2>
            {toPaint.length === 0 ? (
              <p className="wk-col__empty">Nada para pintar.</p>
            ) : (
              <ul className="wk-cards">
                {toPaint.map((o) => postCard(o, 'paint'))}
              </ul>
            )}
          </section>

          <section className="wk-col wk-col--done" aria-label="Terminadas hoy">
            <h2 className="wk-col__head">
              <i className="wk-col__dot" aria-hidden="true" />
              Terminadas hoy
              <span className="num">{finishedToday.length}</span>
            </h2>
            {finishedToday.length > 0 && (
              <ul className="wk-cards">
                {finishedToday.map((o) => (
                  <li key={o.id} className="wk-card">
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="wk-card__title"
                    >
                      {o.title || o.customer}
                    </Link>
                    <p className="wk-card__sub">{o.customer}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="wk-col__note">
              <Icon name="check" size={14} />
              Pedido completo: pasa solo a “Listo para avisar”.
            </p>
          </section>
        </div>
      ) : tab === 'post' ? (
        postOrders.length === 0 ? (
          <div className="card empty">
            <strong>Nada en posprocesado</strong>
            Cuando un pedido que lleva lijado o pintura termina de imprimirse,
            aparece acá.
          </div>
        ) : (
          <ul className="wk-cards wk-cards--grid">
            {postOrders.map((o) =>
              postCard(
                o,
                o.pp_sand && !o.sand_done
                  ? 'sand'
                  : o.pp_paint && !o.paint_done
                    ? 'paint'
                    : null,
              ),
            )}
          </ul>
        )
      ) : printGroups.length === 0 ? (
        <div className="card empty">
          <strong>
            {anyFilter ? 'Nada con estos filtros' : 'Todo impreso'}
          </strong>
          {anyFilter
            ? 'Probá con otro color, semana o cliente.'
            : 'Cuando cargues un pedido con piezas, aparece acá.'}
        </div>
      ) : (
        <div className="wk-table" role="table" aria-label="Piezas por imprimir">
          <div className="wk-table__head" role="row">
            <span role="columnheader">Pedido / parte</span>
            <span role="columnheader">Color</span>
            <span role="columnheader">Cant.</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Entrega</span>
          </div>
          {printGroups.map((order) => {
            const prog = partsProgress(order.pieces)
            const due = dueText(order, today)
            return (
              <section
                key={order.id}
                className={`wk-group${order.urgent ? ' wk-group--urgent' : ''}`}
              >
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="wk-group__head"
                  role="row"
                >
                  <span className="wk-group__who">
                    {order.urgent && <UrgentBadge />}
                    <strong>{order.customer}</strong>
                    <span className="wk-group__title">{order.title}</span>
                  </span>
                  <PartsBar printed={prog.printed} total={prog.total} compact />
                  <span className="wk-group__post">
                    Después: <PostMarks order={order} />
                  </span>
                  <span
                    className={`wk-group__due${due.late ? ' is-late' : ''}`}
                  >
                    {due.label}
                  </span>
                </Link>
                {order.shown.map((piece) => (
                  <div
                    key={piece.id}
                    className={`wk-row${piece.status === 'done' ? ' is-done' : ''}`}
                    role="row"
                  >
                    <span className="wk-row__name">{piece.label}</span>
                    <span className="wk-row__color">
                      <ColorDot color={piece.color} />
                      {colorLabel(piece.color)}
                    </span>
                    <span className="wk-row__qty num">
                      {piece.quantity_total}×
                    </span>
                    {pieceControls(piece)}
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}
      {toast}
    </main>
  )
}

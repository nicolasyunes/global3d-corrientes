import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import type { OrderItemRow } from '@/features/orders/orders.api'
import type { PostFields } from '@/features/orders/stage'
import PieceColorPicker from './PieceColorPicker'
import PieceRow from './PieceRow'
import {
  itemState,
  NEXT_PIECE_STATUS,
  TO_PAINT,
  type PieceStatus,
} from './pieces'
import {
  createPiece,
  deletePiece,
  incrementPiece,
  listPieces,
  setPieceStatus,
  updatePiece,
  type PieceEdit,
  type PieceRow as Piece,
} from './production.api'
import './production.css'

interface Group {
  key: string
  itemId: string | null
  quantity: number | null
  title: string
  subtitle: string | null
}

const URL_RE = /(https?:\/\/[^\s"”)]+)/g

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// A reference link inside an item's note reads as its site name, not a URL.
function NoteText({ text }: { text: string }) {
  const parts = text.split(URL_RE)
  if (parts.length === 1) return <>“{text}”</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="item-block__link"
          >
            {hostOf(part)}
            <Icon name="external" size={12} />
          </a>
        ) : (
          part.replace(/["”“]/g, '')
        ),
      )}
    </>
  )
}

// Last row of every item: type, Enter, type the next one.
function QuickAdd({
  onAdd,
  busy,
  usedColors,
  defaultColor,
}: {
  onAdd: (label: string, color: string, qty: number) => Promise<boolean>
  busy: boolean
  usedColors: string[]
  defaultColor: string
}) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [qty, setQty] = useState('1')
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim() || busy) return
    const ok = await onAdd(
      label.trim(),
      color.trim(),
      Math.max(1, Math.floor(Number(qty)) || 1),
    )
    if (ok) {
      setLabel('')
      setQty('1')
      inputRef.current?.focus()
    }
  }

  return (
    <form className="add-piece" onSubmit={submit}>
      <input
        ref={inputRef}
        className="input add-piece__label"
        placeholder="Agregar pieza… ej: cabeza, ojos, manos"
        aria-label="Agregar pieza"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <PieceColorPicker
        value={color}
        onChange={setColor}
        usedColors={usedColors}
      />
      <label className="add-piece__qty">
        <span aria-hidden="true">×</span>
        <input
          className="input"
          type="number"
          min={1}
          inputMode="numeric"
          aria-label="Cantidad"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="btn btn--ghost btn--sm"
        disabled={busy || !label.trim()}
      >
        Enter para agregar
      </button>
    </form>
  )
}

interface OrderPiecesProps {
  orderId: string
  items: OrderItemRow[]
  // Postprocess of the whole order (what it needs, what is done).
  post: PostFields
  busy?: boolean
  onPost: (fields: Partial<PostFields>, event: string) => void
  // Products are edited in the order form.
  onEditItems: () => void
  onChanged?: () => void
}

export default function OrderPieces({
  orderId,
  items,
  post,
  busy = false,
  onPost,
  onEditItems,
  onChanged,
}: OrderPiecesProps) {
  const { current } = useOperator()
  const operatorId = current?.id ?? null
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    let cancelled = false
    listPieces(orderId)
      .then((rows) => !cancelled && setPieces(rows))
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las piezas.',
          ),
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [orderId])

  const groups: Group[] = useMemo(() => {
    const list: Group[] = items.map((item) => ({
      key: item.id,
      itemId: item.id,
      quantity: item.quantity,
      title: item.description,
      subtitle: item.personalization,
    }))
    const hasLoose = pieces.some(
      (p) => !p.order_item_id || !items.some((i) => i.id === p.order_item_id),
    )
    if (items.length === 0 || hasLoose) {
      list.push({
        key: 'general',
        itemId: null,
        quantity: null,
        title: items.length === 0 ? 'Piezas del pedido' : 'Piezas generales',
        subtitle: null,
      })
    }
    return list
  }, [items, pieces])

  const usedColors = useMemo(
    () => [
      ...new Set(
        pieces
          .map((p) => p.color?.trim())
          .filter((c): c is string => Boolean(c)),
      ),
    ],
    [pieces],
  )
  // New pieces start with the last color used here; an order that gets
  // painted starts them as "Para pintar".
  const defaultColor =
    pieces[pieces.length - 1]?.color?.trim() ||
    (post.pp_paint ? TO_PAINT : 'negro')

  function piecesOf(group: Group) {
    return pieces.filter((p) =>
      group.itemId
        ? p.order_item_id === group.itemId
        : !p.order_item_id || !items.some((i) => i.id === p.order_item_id),
    )
  }

  function replace(updated: Piece) {
    setPieces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    onChanged?.()
  }

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el cambio.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const cycle = (piece: Piece) =>
    run(piece.id, async () => {
      const next = NEXT_PIECE_STATUS[piece.status as PieceStatus] ?? 'printing'
      replace(await setPieceStatus(piece.id, next, operatorId))
      showToast(
        `${piece.label}: ${next === 'done' ? 'impresa' : next === 'printing' ? 'imprimiendo' : 'pendiente'}`,
      )
    })

  const increment = (piece: Piece) =>
    run(piece.id, async () => {
      const updated = await incrementPiece(piece.id, 1, operatorId)
      replace(updated)
      showToast(
        `+1 ${piece.label} · ${updated.quantity_done}/${updated.quantity_total}`,
      )
    })

  const remove = (piece: Piece) => {
    if (!window.confirm(`¿Quitar “${piece.label}”?`)) return
    void run(piece.id, async () => {
      await deletePiece(piece.id, operatorId)
      setPieces((prev) => prev.filter((p) => p.id !== piece.id))
      onChanged?.()
    })
  }

  async function edit(piece: Piece, changes: PieceEdit) {
    setBusyId(piece.id)
    setError(null)
    try {
      replace(await updatePiece(piece.id, changes, operatorId))
      return true
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la pieza.',
      )
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function add(group: Group, label: string, color: string, qty: number) {
    setBusyId(`add-${group.key}`)
    setError(null)
    try {
      const created = await createPiece(
        {
          orderId,
          orderItemId: group.itemId,
          label,
          color: color || null,
          quantityTotal: qty,
          location: null,
          position: pieces.length,
        },
        operatorId,
      )
      setPieces((prev) => [...prev, created])
      onChanged?.()
      return true
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo agregar la pieza.',
      )
      return false
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="muted">Cargando piezas…</p>

  const needsPost = post.pp_sand || post.pp_paint

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">
          {items.length > 0 ? 'Ítems del pedido' : 'Piezas'}
        </h2>
        <span className="card__meta">Tocá cualquier dato para editarlo</span>
        <span className="spacer" />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onEditItems}
        >
          <Icon name="plus" size={16} />
          Agregar producto
        </button>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {groups.map((group) => {
        const list = piecesOf(group)
        const state = itemState(list)
        return (
          <div
            key={group.key}
            className={`item-block${state === 'done' ? ' is-done' : ''}`}
          >
            <div className="item-block__head">
              {group.quantity !== null && (
                <span className="item-block__qty num">{group.quantity}×</span>
              )}
              <div className="item-block__title">
                <strong>{group.title}</strong>
                {group.subtitle && (
                  <span className="item-block__note">
                    <NoteText text={group.subtitle} />
                  </span>
                )}
                {group.itemId && (
                  <span className="item-block__post">
                    Posprocesado: igual que el pedido
                  </span>
                )}
              </div>
              {group.itemId && (
                <button
                  type="button"
                  className="prt__del"
                  aria-label={`Editar ${group.title}`}
                  title="Editar producto"
                  onClick={onEditItems}
                >
                  <Icon name="edit" size={16} />
                </button>
              )}
            </div>
            {list.length > 0 && (
              <>
                <div className="prt-head" aria-hidden="true">
                  <span />
                  <span>Pieza</span>
                  <span>Color</span>
                  <span>Cant.</span>
                  <span>Último cambio</span>
                  <span />
                </div>
                <ul className="piece-list">
                  {list.map((piece) => (
                    <PieceRow
                      key={piece.id}
                      piece={piece}
                      busy={busyId === piece.id}
                      usedColors={usedColors}
                      onCycle={cycle}
                      onIncrement={increment}
                      onRemove={remove}
                      onEdit={edit}
                    />
                  ))}
                </ul>
              </>
            )}
            <QuickAdd
              usedColors={usedColors}
              defaultColor={defaultColor}
              busy={busyId === `add-${group.key}`}
              onAdd={(label, color, qty) => add(group, label, color, qty)}
            />
          </div>
        )
      })}

      <div className="post-foot">
        <div className="post-foot__text">
          <strong>Posprocesado del pedido</strong>
          <span>cuando todo esté impreso</span>
        </div>
        <div className="post-foot__toggles" role="group" aria-label="Lleva">
          <button
            type="button"
            className="wk-toggle"
            aria-pressed={post.pp_sand}
            disabled={busy}
            onClick={() =>
              onPost(
                {
                  pp_sand: !post.pp_sand,
                  ...(post.pp_sand && { sand_done: false }),
                },
                post.pp_sand ? 'Ya no lleva lijado' : 'Lleva lijado',
              )
            }
          >
            <Icon name="sand" size={16} />
            Lijar
          </button>
          <button
            type="button"
            className="wk-toggle"
            aria-pressed={post.pp_paint}
            disabled={busy}
            onClick={() =>
              onPost(
                {
                  pp_paint: !post.pp_paint,
                  ...(post.pp_paint && { paint_done: false }),
                },
                post.pp_paint ? 'Ya no lleva pintura' : 'Lleva pintura',
              )
            }
          >
            <Icon name="brush" size={16} />
            Pintar
          </button>
        </div>
        {needsPost && (
          <div className="post-foot__toggles" role="group" aria-label="Hecho">
            <span className="post-foot__label">Hecho:</span>
            {post.pp_sand && (
              <button
                type="button"
                className="wk-toggle wk-toggle--done"
                aria-pressed={post.sand_done}
                disabled={busy}
                onClick={() =>
                  onPost(
                    { sand_done: !post.sand_done },
                    post.sand_done ? 'Lijado (desmarcado)' : 'Lijado',
                  )
                }
              >
                <Icon name="check" size={16} />
                Lijado
              </button>
            )}
            {post.pp_paint && (
              <button
                type="button"
                className="wk-toggle wk-toggle--done"
                aria-pressed={post.paint_done}
                disabled={busy}
                onClick={() =>
                  onPost(
                    { paint_done: !post.paint_done },
                    post.paint_done ? 'Pintado (desmarcado)' : 'Pintado',
                  )
                }
              >
                <Icon name="check" size={16} />
                Pintado
              </button>
            )}
          </div>
        )}
      </div>
      <datalist id="piece-colors">
        {usedColors.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {toast}
    </section>
  )
}

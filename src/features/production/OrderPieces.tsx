import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import type { OrderItemRow } from '@/features/orders/orders.api'
import PieceColorPicker from './PieceColorPicker'
import PieceRow from './PieceRow'
import { itemState, NEXT_PIECE_STATUS, type PieceStatus } from './pieces'
import {
  createPiece,
  deletePiece,
  incrementPiece,
  listPieces,
  registerPieceFailure,
  setPieceStatus,
  updatePiece,
  type PieceEdit,
  type PieceRow as Piece,
} from './production.api'
import './production.css'

interface Group {
  key: string
  itemId: string | null
  index: number | null
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

function AddPiece({
  onAdd,
  busy,
  usedColors,
}: {
  onAdd: (label: string, color: string, qty: number) => Promise<boolean>
  busy: boolean
  usedColors: string[]
}) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('negro')
  const [qty, setQty] = useState('1')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    const ok = await onAdd(
      label.trim(),
      color.trim(),
      Math.max(1, Math.floor(Number(qty)) || 1),
    )
    if (ok) {
      setLabel('')
      setQty('1')
    }
  }

  return (
    <form className="add-piece" onSubmit={submit}>
      <input
        className="input add-piece__label"
        placeholder="¿Qué falta? ej: cabeza, ojos, manos…"
        aria-label="Pieza que falta"
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
        className="btn btn--primary"
        disabled={busy || !label.trim()}
      >
        Agregar
      </button>
    </form>
  )
}

interface OrderPiecesProps {
  orderId: string
  items: OrderItemRow[]
  onChanged?: () => void
}

export default function OrderPieces({
  orderId,
  items,
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
    const list: Group[] = items.map((item, i) => ({
      key: item.id,
      itemId: item.id,
      index: i + 1,
      title: `${item.quantity > 1 ? `${item.quantity}× ` : ''}${item.description}`,
      subtitle: item.personalization,
    }))
    const hasLoose = pieces.some(
      (p) => !p.order_item_id || !items.some((i) => i.id === p.order_item_id),
    )
    if (items.length === 0 || hasLoose) {
      list.push({
        key: 'general',
        itemId: null,
        index: null,
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
        `${piece.label}: ${next === 'done' ? 'lista' : next === 'printing' ? 'imprimiendo' : 'pendiente'}`,
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

  const fail = (piece: Piece) =>
    run(piece.id, async () => {
      await registerPieceFailure(piece.id, operatorId)
      showToast(`Falla registrada en ${piece.label}`)
      onChanged?.()
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
      showToast('Pieza actualizada')
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

  const doneItems = items.filter(
    (item) =>
      itemState(pieces.filter((p) => p.order_item_id === item.id)) === 'done',
  ).length

  if (loading) return <p className="muted">Cargando piezas…</p>

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">
          {items.length > 0 ? 'Ítems del pedido' : 'Piezas'}
        </h2>
        <span className="spacer" />
        {items.length > 1 && (
          <span className="card__meta num">
            {doneItems} de {items.length} listos
          </span>
        )}
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {groups.map((group) => {
        const list = piecesOf(group)
        const state = itemState(list)
        const doneCount = list.filter((p) => p.status === 'done').length
        return (
          <div
            key={group.key}
            className={`item-block${state === 'done' ? ' is-done' : ''}`}
          >
            <div className="item-block__head">
              {items.length > 1 && group.index !== null && (
                <span className="item-block__n">{group.index}</span>
              )}
              <div className="item-block__title">
                <strong>{group.title}</strong>
                {group.subtitle && (
                  <span className="item-block__note">
                    <NoteText text={group.subtitle} />
                  </span>
                )}
              </div>
              {list.length > 0 && (
                <span
                  className={`item-block__meta num is-${state}`}
                  title={`${doneCount} de ${list.length} piezas listas`}
                >
                  {doneCount}/{list.length}
                </span>
              )}
            </div>
            {list.length > 0 && (
              <ul className="piece-list">
                {list.map((piece) => (
                  <PieceRow
                    key={piece.id}
                    piece={piece}
                    busy={busyId === piece.id}
                    onCycle={cycle}
                    onIncrement={increment}
                    onFail={fail}
                    onRemove={remove}
                    onEdit={edit}
                    usedColors={usedColors}
                  />
                ))}
              </ul>
            )}
            <AddPiece
              usedColors={usedColors}
              busy={busyId === `add-${group.key}`}
              onAdd={(label, color, qty) => add(group, label, color, qty)}
            />
          </div>
        )
      })}
      <datalist id="piece-colors">
        {usedColors.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {toast}
    </section>
  )
}

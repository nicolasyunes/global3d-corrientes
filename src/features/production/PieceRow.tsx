import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import PieceColorPicker from './PieceColorPicker'
import { colorSwatch, type PieceStatus } from './pieces'
import type { PieceEdit, PieceRow as Piece } from './production.api'

const STATUS_LABEL: Record<PieceStatus, string> = {
  pending: 'Falta',
  printing: 'Imprimiendo',
  done: 'Impresa',
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const date = new Date(iso)
  const sameDay = new Date(now).toDateString() === date.toDateString()
  if (sameDay)
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  const days = Math.round((now - date.getTime()) / 86_400_000)
  return days <= 1 ? 'ayer' : `hace ${days} días`
}

interface PieceRowProps {
  piece: Piece
  busy: boolean
  usedColors: string[]
  onCycle: (piece: Piece) => void
  onIncrement: (piece: Piece) => void
  onRemove: (piece: Piece) => void
  // Every field is edited in place and saved on its own.
  onEdit: (piece: Piece, edit: PieceEdit) => Promise<boolean>
}

// One piece of an item, edited inline: tap the circle to move its state, type
// over the name, pick the color from the popover, step the quantity.
export default function PieceRow({
  piece,
  busy,
  usedColors,
  onCycle,
  onIncrement,
  onRemove,
  onEdit,
}: PieceRowProps) {
  const { byId } = useOperator()
  const [name, setName] = useState(piece.label)
  const [color, setColor] = useState(piece.color ?? '')
  const [colorOpen, setColorOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  // Follow the saved row (another person or the list may change it).
  useEffect(() => setName(piece.label), [piece.label])
  useEffect(() => setColor(piece.color ?? ''), [piece.color])

  const status = piece.status as PieceStatus
  const who = byId(piece.updated_by)
  const swatch = colorSwatch(color)
  const multi = piece.quantity_total > 1
  const minQty = Math.max(1, piece.quantity_done)

  const save = (changes: Partial<PieceEdit>) =>
    onEdit(piece, {
      label: piece.label,
      color: piece.color,
      quantityTotal: piece.quantity_total,
      ...changes,
    })

  function commitName() {
    const next = name.trim()
    if (!next) return setName(piece.label)
    if (next !== piece.label) void save({ label: next })
  }

  function closeColor() {
    setColorOpen(false)
    const next = color.trim() || null
    if (next !== (piece.color ?? null)) void save({ color: next })
  }

  // The color popover closes (and saves) on outside tap or Escape.
  useEffect(() => {
    if (!colorOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node)) closeColor()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') closeColor()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorOpen, color])

  return (
    <li className="prt" data-status={status}>
      <button
        type="button"
        className="prt__state"
        disabled={busy}
        aria-label={`${piece.label}: ${STATUS_LABEL[status]}. Tocar para avanzar`}
        title={`${STATUS_LABEL[status]} · tocar para avanzar`}
        onClick={() => onCycle(piece)}
      >
        {status === 'done' && <Icon name="check" size={14} />}
      </button>
      <div className="prt__name">
        <input
          className="prt__input"
          aria-label="Nombre de la pieza"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName(piece.label)
              e.currentTarget.blur()
            }
          }}
        />
        {multi && (
          <span className="prt__count num">
            {piece.quantity_done}/{piece.quantity_total}
            {status !== 'done' && (
              <button
                type="button"
                className="prt__plus"
                disabled={busy}
                aria-label={`Sumar 1 a ${piece.label}`}
                onClick={() => onIncrement(piece)}
              >
                +1
              </button>
            )}
          </span>
        )}
      </div>
      <div className="prt__color" ref={popRef}>
        <button
          type="button"
          className="prt__color-btn"
          aria-expanded={colorOpen}
          aria-label={`Color de ${piece.label}: ${color || 'sin color'}`}
          onClick={() => (colorOpen ? closeColor() : setColorOpen(true))}
        >
          <span
            className={`wk-dot${swatch ? '' : ' wk-dot--none'}`}
            style={swatch ? { background: swatch } : undefined}
            aria-hidden="true"
          />
          {color || 'Sin color'}
        </button>
        {colorOpen && (
          <div className="prt__pop">
            <PieceColorPicker
              value={color}
              onChange={setColor}
              usedColors={usedColors}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={closeColor}
            >
              Listo
            </button>
          </div>
        )}
      </div>
      <div className="prt__qty" role="group" aria-label="Cantidad">
        <button
          type="button"
          aria-label={`Una menos de ${piece.label}`}
          disabled={busy || piece.quantity_total <= minQty}
          onClick={() => void save({ quantityTotal: piece.quantity_total - 1 })}
        >
          −
        </button>
        <span className="num">{piece.quantity_total}</span>
        <button
          type="button"
          aria-label={`Una más de ${piece.label}`}
          disabled={busy}
          onClick={() => void save({ quantityTotal: piece.quantity_total + 1 })}
        >
          +
        </button>
      </div>
      <span className="prt__who">
        {who ? `${who.name} · ${timeAgo(piece.updated_at)}` : ''}
      </span>
      <button
        type="button"
        className="prt__del"
        disabled={busy}
        aria-label={`Quitar ${piece.label}`}
        title="Quitar pieza"
        onClick={() => onRemove(piece)}
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  )
}

import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { colorSwatch, type PieceStatus } from './pieces'
import type { PieceRow as Piece } from './production.api'

const STATUS_LABEL: Record<PieceStatus, string> = {
  pending: 'Falta',
  printing: 'Imprimiendo',
  done: 'Lista',
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
  onCycle: (piece: Piece) => void
  onIncrement: (piece: Piece) => void
  onFail: (piece: Piece) => void
  onRemove: (piece: Piece) => void
}

export default function PieceRow({
  piece,
  busy,
  onCycle,
  onIncrement,
  onFail,
  onRemove,
}: PieceRowProps) {
  const { byId } = useOperator()
  const status = piece.status as PieceStatus
  const who = byId(piece.updated_by)
  const swatch = colorSwatch(piece.color)
  const multi = piece.quantity_total > 1

  return (
    <li className="piece" data-status={status}>
      <button
        type="button"
        className="piece__state"
        disabled={busy}
        aria-label={`${piece.label}: ${STATUS_LABEL[status]}. Tocar para avanzar`}
        title="Tocar para avanzar"
        onClick={() => onCycle(piece)}
      >
        {status === 'done' && <Icon name="check" size={16} />}
      </button>
      <span
        className={`swatch piece__swatch${swatch ? '' : ' swatch--unknown'}`}
        style={swatch ? { background: swatch } : undefined}
        aria-hidden="true"
      />
      <div className="piece__body">
        <p className="piece__name">
          <strong>
            {piece.label}
            {multi && ` ×${piece.quantity_total}`}
          </strong>
          {piece.color && (
            <span className="piece__color"> · {piece.color}</span>
          )}
        </p>
        {multi && (
          <div className="piece__count">
            <div
              className={`progress${status === 'done' ? ' progress--done' : ''}`}
            >
              <i
                style={{
                  width: `${(piece.quantity_done / piece.quantity_total) * 100}%`,
                }}
              />
            </div>
            <span className="num">
              {piece.quantity_done}/{piece.quantity_total}
            </span>
            {status !== 'done' && (
              <button
                type="button"
                className="piece__plus"
                disabled={busy}
                aria-label={`Sumar 1 a ${piece.label}`}
                onClick={() => onIncrement(piece)}
              >
                +1
              </button>
            )}
          </div>
        )}
      </div>
      <span className="piece__who">
        {who ? `${who.name} · ${timeAgo(piece.updated_at)}` : '—'}
      </span>
      <details className="piece__menu">
        <summary aria-label={`Más acciones para ${piece.label}`}>
          <Icon name="more" />
        </summary>
        <div className="piece__menu-panel">
          {status !== 'done' && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.currentTarget.closest('details')?.removeAttribute('open')
                onFail(piece)
              }}
            >
              <Icon name="alert" size={16} />
              Registrar falla
            </button>
          )}
          <button
            type="button"
            className="is-danger"
            disabled={busy}
            onClick={(e) => {
              e.currentTarget.closest('details')?.removeAttribute('open')
              onRemove(piece)
            }}
          >
            <Icon name="trash" size={16} />
            Quitar pieza
          </button>
        </div>
      </details>
    </li>
  )
}

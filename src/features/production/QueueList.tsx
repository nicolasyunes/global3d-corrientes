import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { initialsFrom } from '@/features/operators/operators.api'
import { dueInfo } from './due'
import { colorSwatch, type QueueGroup } from './pieces'
import type { QueuePiece } from './production.api'

interface QueueListProps {
  groups: QueueGroup<QueuePiece>[]
  today: string
  busyId: string | null
  onPlus: (piece: QueuePiece) => void
  limit?: number
  // Color groups show who each piece is for; customer groups show its color.
  by?: 'color' | 'customer'
}

function Swatch({ color, size }: { color: string | null; size?: number }) {
  const hex = colorSwatch(color)
  return (
    <span
      className={`swatch${hex ? '' : ' swatch--unknown'}`}
      style={{
        ...(hex ? { background: hex } : {}),
        ...(size ? { width: size, height: size } : {}),
      }}
      aria-hidden="true"
    />
  )
}

export default function QueueList({
  groups,
  today,
  busyId,
  onPlus,
  limit,
  by = 'color',
}: QueueListProps) {
  let remaining = limit ?? Infinity
  return (
    <div className="queue">
      {groups.map((group) => {
        if (remaining <= 0) return null
        const entries = group.entries.slice(0, remaining)
        remaining -= entries.length
        const pending = group.entries.reduce(
          (sum, p) => sum + (p.quantity_total - p.quantity_done),
          0,
        )
        const groupDue = dueInfo(group.earliest, today)
        return (
          <section
            key={group.key}
            className="queue__group"
            style={
              by === 'color' && group.swatch
                ? ({ '--group-color': group.swatch } as CSSProperties)
                : undefined
            }
          >
            <header className="queue__head">
              {by === 'color' ? (
                <Swatch color={group.label} size={26} />
              ) : (
                <span className="avatar avatar--sm queue__avatar">
                  {initialsFrom(group.label)}
                </span>
              )}
              <h2 className="queue__label">{group.label}</h2>
              <span className="queue__count num">
                {pending} {pending === 1 ? 'pieza' : 'piezas'}
              </span>
              <span className={`qdue qdue--${groupDue.tone}`}>
                {groupDue.label}
              </span>
            </header>
            <ul className="queue__items">
              {entries.map((piece) => {
                const due = dueInfo(piece.due_date, today)
                const left = piece.quantity_total - piece.quantity_done
                return (
                  <li
                    key={piece.id}
                    className={`queue-item queue-item--${due.tone}`}
                  >
                    <span className="queue-item__left num" title="Faltan">
                      {left}
                    </span>
                    <div className="queue-item__body">
                      <Link
                        to={`/admin/orders/${piece.order_id}`}
                        className="queue-item__title"
                      >
                        {piece.label}
                        {piece.item_label && (
                          <span className="queue-item__item">
                            {' '}
                            · {piece.item_label}
                          </span>
                        )}
                      </Link>
                      <p className="queue-item__sub">
                        {by === 'color' ? (
                          piece.customer_name
                        ) : (
                          <>
                            <Swatch color={piece.color} />
                            {piece.color?.trim() || 'Sin color'}
                          </>
                        )}
                        {piece.quantity_done > 0 && (
                          <span className="num">
                            {' '}
                            · {piece.quantity_done}/{piece.quantity_total}{' '}
                            hechas
                          </span>
                        )}
                        {piece.status === 'printing' && (
                          <span className="badge badge--printing">
                            Imprimiendo
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`qdue qdue--${due.tone}`}>
                      {due.label}
                    </span>
                    <button
                      type="button"
                      className="queue-item__plus"
                      disabled={busyId === piece.id}
                      aria-label={`Sumar 1 a ${piece.label}`}
                      onClick={() => onPlus(piece)}
                    >
                      <Icon name="plus" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

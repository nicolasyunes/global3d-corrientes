import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { formatDueDate } from '@/features/orders/format'
import { initialsFrom } from '@/features/operators/operators.api'
import { dueInfo } from './due'
import { colorSwatch, groupHasUrgent, type QueueGroup } from './pieces'
import type { QueuePiece } from './production.api'

interface QueueListProps {
  groups: QueueGroup<QueuePiece>[]
  today: string
  busyId: string | null
  onAdd: (piece: QueuePiece, delta: number) => void
  limit?: number
  // Color groups show who each piece is for; customer groups show its color.
  by?: 'color' | 'customer'
  // "Sin apuro" pieces: their date is a guide, never shown as late.
  relaxed?: boolean
  // Entries are in due-date order: mark where each date starts.
  dateSeparators?: boolean
}

const HOLD_DELAY = 350
const HOLD_STEP = 110

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

// Tap = +1. Hold = counts up (shown on the button) and adds it all on release.
function PlusButton({
  label,
  max,
  disabled,
  onAdd,
}: {
  label: string
  max: number
  disabled: boolean
  onAdd: (delta: number) => void
}) {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const pressed = useRef(false)

  function clearTimers() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    if (stepTimer.current) clearInterval(stepTimer.current)
    holdTimer.current = null
    stepTimer.current = null
  }
  useEffect(() => clearTimers, [])

  function start() {
    if (disabled) return
    pressed.current = true
    countRef.current = 0
    holdTimer.current = setTimeout(() => {
      countRef.current = 1
      setCount(1)
      stepTimer.current = setInterval(() => {
        countRef.current = Math.min(max, countRef.current + 1)
        setCount(countRef.current)
      }, HOLD_STEP)
    }, HOLD_DELAY)
  }

  function finish(cancel = false) {
    if (!pressed.current) return
    pressed.current = false
    clearTimers()
    const held = countRef.current
    countRef.current = 0
    setCount(0)
    if (!cancel) onAdd(held > 0 ? held : 1)
  }

  return (
    <button
      type="button"
      className={`queue-item__plus${count > 0 ? ' is-holding' : ''}`}
      disabled={disabled}
      aria-label={`Sumar 1 a ${label} (mantené apretado para sumar varias)`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        start()
      }}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd(1)
        }
      }}
    >
      {count > 0 ? <span className="num">+{count}</span> : <Icon name="plus" />}
    </button>
  )
}

export default function QueueList({
  groups,
  today,
  busyId,
  onAdd,
  limit,
  by = 'color',
  relaxed = false,
  dateSeparators = true,
}: QueueListProps) {
  const dueOf = (date: string) =>
    relaxed
      ? { label: `Sin apuro · ${formatDueDate(date)}`, tone: 'ok' as const }
      : dueInfo(date, today)
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
        const groupDue = groupHasUrgent(group)
          ? { label: 'Urgente', tone: 'late' as const }
          : dueOf(group.earliest)
        // Urgent pieces form their own block ahead of the dated ones.
        const blockOf = (p: QueuePiece) => (p.urgent ? 'urgent' : p.due_date)
        const mixedDates =
          dateSeparators && !relaxed && new Set(entries.map(blockOf)).size > 1
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
              {entries.map((piece, i) => {
                const due = dueOf(piece.due_date)
                const left = piece.quantity_total - piece.quantity_done
                const newDate =
                  mixedDates &&
                  (i === 0 || blockOf(entries[i - 1]) !== blockOf(piece))
                return [
                  newDate && (
                    <li
                      key={`sep-${blockOf(piece)}`}
                      className={`queue__sep queue__sep--${piece.urgent ? 'late' : due.tone}`}
                    >
                      {piece.urgent ? 'Urgente' : due.label}
                    </li>
                  ),
                  <li
                    key={piece.id}
                    className={`queue-item queue-item--${due.tone}${piece.urgent ? ' queue-item--urgent' : ''}`}
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
                    {left > 1 && (
                      <button
                        type="button"
                        className="queue-item__all"
                        disabled={busyId === piece.id}
                        title={`Marcar las ${left} como hechas`}
                        onClick={() => onAdd(piece, left)}
                      >
                        <Icon name="check" size={16} />
                        <span>Completar</span>
                      </button>
                    )}
                    <PlusButton
                      label={piece.label}
                      max={left}
                      disabled={busyId === piece.id}
                      onAdd={(delta) => onAdd(piece, delta)}
                    />
                  </li>,
                ]
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

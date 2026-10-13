import Icon from '@/components/Icon'
import { daysBetween, dueInfo } from '@/features/production/due'
import { formatDueDate } from './format'
import { initialsOf, STAGE_LABEL, type PostFields, type Stage } from './stage'
import './taller.css'

export function StageTag({ stage }: { stage: Stage }) {
  return (
    <span className={`stage-tag stage-tag--${stage}`}>
      <i aria-hidden="true" />
      {STAGE_LABEL[stage]}
    </span>
  )
}

// Bar + "x de y impresas". Without pieces there is nothing to measure.
export function PartsBar({
  printed,
  total,
  compact = false,
}: {
  printed: number
  total: number
  compact?: boolean
}) {
  if (total === 0) return <span className="parts-bar__none">Sin piezas</span>
  const pct = Math.round((printed / total) * 100)
  return (
    <span className={`parts-bar${printed >= total ? ' is-done' : ''}`}>
      <span className="parts-bar__track" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className={`parts-bar__text${compact ? ' num' : ''}`}>
        {compact
          ? `${printed}/${total}`
          : `${printed} de ${total} impresa${total === 1 ? '' : 's'}`}
      </span>
    </span>
  )
}

// What the order needs after printing; done steps are ticked.
export function PostMarks({ order }: { order: PostFields }) {
  if (!order.pp_sand && !order.pp_paint)
    return <span className="post-marks post-marks--none">No lleva</span>
  return (
    <span className="post-marks">
      {order.pp_sand && (
        <span className={order.sand_done ? 'is-done' : undefined}>
          <Icon name={order.sand_done ? 'check' : 'sand'} size={14} />
          {order.sand_done ? 'Lijado' : 'Lijar'}
        </span>
      )}
      {order.pp_paint && (
        <span className={order.paint_done ? 'is-done' : undefined}>
          <Icon name={order.paint_done ? 'check' : 'brush'} size={14} />
          {order.paint_done ? 'Pintado' : 'Pintar'}
        </span>
      )}
    </span>
  )
}

export function ClientAvatar({
  name,
  size,
}: {
  name: string | null | undefined
  size?: 'sm'
}) {
  return (
    <span
      className={`client-avatar${size ? ` client-avatar--${size}` : ''}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

interface DueFields {
  due_date: string
  flexible: boolean
}

// Due date as the workshop reads it: late in red, the rest plain. `short`
// gives the board's compact form ("+8 d").
export function dueText(
  order: DueFields,
  today: string,
  opts: { short?: boolean; closed?: boolean } = {},
): { label: string; late: boolean } {
  if (opts.closed) return { label: formatDueDate(order.due_date), late: false }
  if (order.flexible)
    return {
      label: `Sin apuro · ${formatDueDate(order.due_date)}`,
      late: false,
    }
  const diff = daysBetween(today, order.due_date)
  if (diff < 0 && opts.short) return { label: `+${-diff} d`, late: true }
  const info = dueInfo(order.due_date, today)
  return { label: info.label, late: info.tone === 'late' }
}

export function UrgentBadge() {
  return <span className="urgent-badge">Urgente</span>
}

import { useEffect, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { timeAgo } from './PieceRow'
import { listEvents, type ProductionEventRow } from './production.api'

const STATUS_TEXT: Record<string, string> = {
  pending: 'pendiente',
  printing: 'imprimiendo',
  done: 'lista',
}

export function describeEvent(e: ProductionEventRow): string {
  switch (e.kind) {
    case 'created':
      return `agregó “${e.label}”`
    case 'count':
      return `${(e.delta ?? 0) >= 0 ? 'sumó' : 'restó'} ${Math.abs(e.delta ?? 0)} a “${e.label}”`
    case 'status':
      return `marcó “${e.label}” como ${STATUS_TEXT[e.to_status ?? ''] ?? e.to_status}`
    case 'failed':
      return `registró una falla en “${e.label}”`
    case 'deleted':
      return `quitó “${e.label}”`
    default:
      return e.label
  }
}

export default function ActivityFeed({
  orderId,
  refreshKey,
}: {
  orderId: string
  refreshKey: number
}) {
  const { byId } = useOperator()
  const [events, setEvents] = useState<ProductionEventRow[]>([])

  useEffect(() => {
    let cancelled = false
    listEvents(orderId)
      .then((rows) => !cancelled && setEvents(rows))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [orderId, refreshKey])

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Actividad</h2>
      </div>
      {events.length === 0 ? (
        <p className="muted activity-empty">Todavía no hay movimientos.</p>
      ) : (
        <ol className="activity">
          {events.map((e) => {
            const who = byId(e.operator_id)
            return (
              <li
                key={e.id}
                className={`activity__row activity__row--${e.kind}`}
              >
                <time className="activity__time">{timeAgo(e.created_at)}</time>
                <span>
                  <strong>{who?.name ?? 'Alguien'}</strong> {describeEvent(e)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

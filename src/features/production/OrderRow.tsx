import { Link } from 'react-router-dom'
import {
  PRODUCT_TYPE_LABELS,
  type OrderStatus,
  type ProductType,
} from '@/lib/domain-constants'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import StatusBadge from '@/features/orders/StatusBadge'
import { formatDueDate, formatMoney } from '@/features/orders/format'
import { isWaiting, needsReview } from '@/features/orders/orderFlow'
import { dueInfo } from './due'
import type { OrderProgress } from './production.api'

const TYPE_MARK: Record<string, string> = {
  cup: 'VA',
  trophy: 'TR',
  keychain: 'LL',
  other: '3D',
}

function markFrom(title: string): string {
  const words = title
    .replace(/^\d+\s*[×x]\s*/i, '')
    .split(/[\s+]+/)
    .filter((w) => /^[a-záéíóúñ]/i.test(w))
  return (words[0]?.[0] ?? '3').concat(words[1]?.[0] ?? '').toUpperCase()
}

export function orderTitle(order: OrderWithCustomer, itemCount = 0): string {
  if (order.title?.trim()) return order.title.trim()
  const type =
    PRODUCT_TYPE_LABELS[order.product_type as ProductType] ?? order.product_type
  if (itemCount > 1) return `${itemCount} ítems`
  return order.personalization ? `${type} · ${order.personalization}` : type
}

interface OrderRowProps {
  order: OrderWithCustomer
  today: string
  progress?: OrderProgress
  itemCount?: number
}

export default function OrderRow({
  order,
  today,
  progress,
  itemCount,
}: OrderRowProps) {
  const due = isWaiting(order)
    ? {
        label: `En espera · revisar ${formatDueDate(order.follow_up_on ?? today)}`,
        tone: needsReview(order, today) ? ('soon' as const) : ('ok' as const),
      }
    : order.flexible
      ? {
          label: `Sin apuro · ${formatDueDate(order.due_date)}`,
          tone: 'ok' as const,
        }
      : dueInfo(order.due_date, today)
  const status = order.status as OrderStatus
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : null
  const finished = status === 'finished' || status === 'delivered'

  return (
    <li>
      <Link
        to={`/admin/orders/${order.id}`}
        className={`orow${order.urgent && !finished ? ' orow--urgent' : ''}`}
      >
        <span className="orow__thumb" aria-hidden="true">
          {order.title?.trim()
            ? markFrom(order.title)
            : (TYPE_MARK[order.product_type] ?? '3D')}
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="orow__title">
            {order.urgent && !finished && (
              <span className="urgent-tag">Urgente</span>
            )}
            {orderTitle(order, itemCount)}
          </p>
          <p className="orow__sub">
            {order.customers?.name ?? 'Sin cliente'}
            <StatusBadge status={status} />
            {status === 'finished' && (order.pending_balance ?? 0) > 0 && (
              <span className="num">
                saldo {formatMoney(order.pending_balance)}
              </span>
            )}
          </p>
        </div>
        <div className="orow__progress">
          {pct !== null ? (
            <>
              <div
                className={`progress${finished || pct === 100 ? ' progress--done' : ''}`}
              >
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-label num">
                <span>
                  {progress!.done}/{progress!.total}
                </span>
                <span>{pct}%</span>
              </div>
            </>
          ) : (
            <span className="progress-label">Sin piezas cargadas</span>
          )}
        </div>
        <span className={`due due--${finished ? 'ok' : due.tone}`}>
          {due.label}
        </span>
      </Link>
    </li>
  )
}

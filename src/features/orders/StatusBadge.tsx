import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/domain-constants'

export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  new: 'badge badge--new',
  in_queue: 'badge badge--new',
  printing: 'badge badge--printing',
  post_processing: 'badge badge--post',
  finished: 'badge badge--ready',
  delivered: 'badge badge--delivered',
  cancelled: 'badge',
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={STATUS_BADGE_CLASS[status]}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

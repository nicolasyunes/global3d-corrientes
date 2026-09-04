import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/lib/domain-constants'

// Status stamp: the semantic token as border + text color, no fill — reads
// like a rubber stamp on a docket rather than a colored chip. Reused by the
// list rows and the detail header.
export default function StatusBadge({ status }: { status: OrderStatus }) {
  const color = ORDER_STATUS_COLORS[status]
  return (
    <span className="badge" style={{ color }}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

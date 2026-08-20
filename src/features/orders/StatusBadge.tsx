import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/lib/domain-constants'

// Small status pill: the semantic token as text over a ~12% tint of the same
// token (color-mix), so the badge reads the state on its own without a colored
// side border. Reused by the list rows and the detail header.
export default function StatusBadge({ status }: { status: OrderStatus }) {
  const color = ORDER_STATUS_COLORS[status]
  return (
    <span
      className="badge"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, var(--color-white))`,
      }}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

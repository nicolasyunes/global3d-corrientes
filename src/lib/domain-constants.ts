import type { Database } from './database.types'

// Enum unions derived from the generated types, so the Postgres enum and the
// client union can never drift. A missing label/color below fails `tsc` at
// compile time thanks to the `Record<OrderStatus, ...>` coverage.
export type OrderStatus = Database['public']['Enums']['order_status']
export type TransactionType = Database['public']['Enums']['transaction_type']

// Value lists mirroring the Postgres enums exactly (compile-time checked).
export const ORDER_STATUS = [
  'new',
  'in_queue',
  'printing',
  'post_processing',
  'finished',
  'cancelled',
] as const satisfies readonly OrderStatus[]

export const TRANSACTION_TYPE = [
  '3d_service',
  'supplies_sale',
] as const satisfies readonly TransactionType[]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  in_queue: 'In Queue',
  printing: 'Printing',
  post_processing: 'Post-processing',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  '3d_service': '3D Service',
  supplies_sale: 'Supplies Sale',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'var(--color-gray)',
  in_queue: 'var(--color-orange)',
  printing: 'var(--color-orange)',
  post_processing: 'var(--color-gray)',
  finished: 'var(--color-black)',
  cancelled: 'var(--color-gray)',
}

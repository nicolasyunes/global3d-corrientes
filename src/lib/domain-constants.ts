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

// Open-list values (text + CHECK columns). The generated types expose these as
// `string`, not a union, so these literal arrays are the source of truth that
// forms and filters consume. They MUST mirror the CHECK constraints.
export const PAYMENT_METHOD = [
  'cash',
  'transfer',
  'uala',
  'brubank',
  'mercadopago',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[number]

export const PRODUCT_TYPE = ['cup', 'trophy', 'keychain', 'other'] as const
export type ProductType = (typeof PRODUCT_TYPE)[number]

export const ORIGIN_CHANNEL = [
  'facebook',
  'whatsapp',
  'instagram',
  'other',
] as const
export type OriginChannel = (typeof ORIGIN_CHANNEL)[number]

// Where a production checklist task is being made — the order_production_tasks
// CHECK constraint's source of truth on the client side.
export const TASK_LOCATION = ['casa', 'local'] as const
export type TaskLocation = (typeof TASK_LOCATION)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nuevo',
  in_queue: 'En cola',
  printing: 'Imprimiendo',
  post_processing: 'Post-procesado',
  finished: 'Terminado',
  cancelled: 'Cancelado',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  '3d_service': 'Servicio 3D',
  supplies_sale: 'Venta de insumos',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  uala: 'Ualá',
  brubank: 'Brubank',
  mercadopago: 'Mercado Pago',
  other: 'Otro',
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  cup: 'Taza',
  trophy: 'Trofeo',
  keychain: 'Llavero',
  other: 'Otro',
}

export const ORIGIN_CHANNEL_LABELS: Record<OriginChannel, string> = {
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  other: 'Otro',
}

export const TASK_LOCATION_LABELS: Record<TaskLocation, string> = {
  casa: 'Casa',
  local: 'Local',
}

// Status/urgency color maps reference design tokens, never raw hex, so the
// palette can change in one place (`tokens.css`) without touching constants.
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'var(--status-amber)',
  in_queue: 'var(--color-orange)',
  printing: 'var(--color-orange)',
  post_processing: 'var(--color-orange)',
  finished: 'var(--color-teal)',
  cancelled: 'var(--color-carbon)',
}

// Future urgency semaphore (agenda-view): warm, desaturated buckets. teal maps
// to finished/success; red/amber/green feed the traffic-light agenda.
export type Urgency = 'overdue' | 'upcoming' | 'comfortable' | 'finished'
export const URGENCY_COLORS: Record<Urgency, string> = {
  overdue: 'var(--status-red)',
  upcoming: 'var(--status-amber)',
  comfortable: 'var(--status-green)',
  finished: 'var(--color-teal)',
}

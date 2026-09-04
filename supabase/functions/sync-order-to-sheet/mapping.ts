// Pure mapping from an `orders` row to a Google Sheets row. No network, no DB —
// deterministic and unit-testable on its own, same philosophy as
// src/features/orders/validation.ts in the main app.

export interface OrderRecord {
  id: string
  customer_id: string
  product_type: string
  personalization: string | null
  measurements: string | null
  observations: string | null
  due_date: string // 'YYYY-MM-DD'
  total_amount: number | null
  deposit: number | null
  pending_balance: number | null
  origin_channel: string | null
  status: string
}

const PRODUCT_TYPE_ES: Record<string, string> = {
  cup: 'Vaso',
  trophy: 'Trofeo',
  keychain: 'Llavero',
  other: 'Otro',
}

const ORIGIN_CHANNEL_ES: Record<string, string> = {
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  other: 'Otro',
}

const STATUS_ES: Record<string, string> = {
  new: '',
  in_queue: '',
  printing: '',
  post_processing: 'Post-procesado',
  finished: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return ''
  const [intPart, decPart] = value.toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$${grouped},${decPart}`
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

// Column order MUST match A:K in "Pedidos - Nueva":
// Columna 1 | CLIENTE | PRODUCTO | DESCRIPCION | FECHA DE ENTREGA |
// Total (ARS) | SEÑA | SALDO | CANAL | ESTADO | (K, hidden) order id
export function toSheetRow(order: OrderRecord, customerName: string): string[] {
  const description = [order.personalization, order.measurements, order.observations]
    .filter((part): part is string => Boolean(part && part.trim() !== ''))
    .join(' — ')

  return [
    '', // Columna 1 — left blank; matches the ~90% of existing rows with no manual number
    customerName,
    PRODUCT_TYPE_ES[order.product_type] ?? order.product_type,
    description,
    formatDate(order.due_date),
    formatMoney(order.total_amount),
    formatMoney(order.deposit),
    formatMoney(order.pending_balance),
    order.origin_channel ? (ORIGIN_CHANNEL_ES[order.origin_channel] ?? order.origin_channel) : '',
    STATUS_ES[order.status] ?? '',
    order.id,
  ]
}

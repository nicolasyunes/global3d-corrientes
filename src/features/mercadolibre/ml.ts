// Reglas puras de la sección MercadoLibre. Los datos los escribe el gestor
// (repo global3d-gestor-ML): acá solo se muestran y se editan las reglas de precio.

export interface MlOrderItem {
  product_id: string | null
  description: string
  quantity: number
  unit_price?: number
  stock_descontado?: number
}

// Unidades vendidas en ML que no salieron del stock: hay que imprimirlas.
export function toFabricate(
  items: readonly MlOrderItem[] | null | undefined,
): { description: string; qty: number }[] {
  const out: { description: string; qty: number }[] = []
  for (const i of items ?? []) {
    const qty = Number(i.quantity ?? 0) - Number(i.stock_descontado ?? 0)
    if (qty > 0) out.push({ description: i.description, qty })
  }
  return out
}

// Suma lo que hay que fabricar entre varias ventas (misma descripción = mismo producto).
export function fabricateTotals(
  orders: readonly { items: readonly MlOrderItem[] | null }[],
): { description: string; qty: number }[] {
  const acc = new Map<string, number>()
  for (const o of orders)
    for (const f of toFabricate(o.items))
      acc.set(f.description, (acc.get(f.description) ?? 0) + f.qty)
  return [...acc.entries()]
    .map(([description, qty]) => ({ description, qty }))
    .sort((a, b) => b.qty - a.qty)
}

export type Urgency = 'late' | 'today' | 'soon' | 'ok' | 'none'

const HOUR = 3_600_000

// Semáforo de despacho según la fecha límite que pone MercadoLibre.
export function urgency(limit: string | null | undefined, now: Date): Urgency {
  if (!limit) return 'none'
  const ms = new Date(limit).getTime() - now.getTime()
  if (Number.isNaN(ms)) return 'none'
  if (ms < 0) return 'late'
  if (ms < 24 * HOUR) return 'today'
  if (ms < 48 * HOUR) return 'soon'
  return 'ok'
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  late: 'Vencido',
  today: 'Despachar hoy',
  soon: 'Despachar mañana',
  ok: 'En plazo',
  none: 'Sin fecha',
}

const SHIPPING_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  handling: 'Preparando',
  ready_to_ship: 'Listo para despachar',
  shipped: 'En camino',
  delivered: 'Entregado',
  not_delivered: 'No entregado',
  cancelled: 'Cancelado',
}

export function shippingLabel(status: string | null | undefined): string {
  if (!status) return 'Sin datos de envío'
  return SHIPPING_LABELS[status] ?? status
}

// Envíos que ya no requieren nada del taller.
export const CLOSED_SHIPPING = ['delivered', 'not_delivered', 'cancelled']

export function orderUrl(mlOrderId: number | string): string {
  return `https://www.mercadolibre.com.ar/ventas/${mlOrderId}/detalle`
}

export interface PriceRule {
  channel: 'ml' | 'efectivo'
  markup_pct: number
  fixed_add: number
  round_to: number
}

// Misma cuenta que la vista v_product_prices: recargo/descuento, monto fijo y
// redondeo hacia arriba.
export function rulePrice(base: number, rule: PriceRule): number {
  const raw =
    base * (1 + Number(rule.markup_pct) / 100) + Number(rule.fixed_add)
  const round = Number(rule.round_to)
  if (!round) return raw
  // El épsilon evita que 13200.000000000002 suba a 13300.
  return Math.ceil(raw / round - 1e-9) * round
}

// Stock y plazo que el gestor publica en ML (misma regla que tools/sync.py).
export const STOCK_FABRICABLE = 3

export function expectedMl(
  stock: number | null,
  active: boolean,
  saleMode: string | null,
  leadDays: number | null,
): { stock: number; leadDays: number | null } {
  const real = Math.max(Number(stock ?? 0), 0)
  const lead = Number(leadDays ?? 0)
  if (!active) return { stock: 0, leadDays: null }
  if (saleMode === 'a_pedido')
    return { stock: STOCK_FABRICABLE, leadDays: lead || 5 }
  if (real > 0) return { stock: real, leadDays: null }
  if (lead > 0) return { stock: STOCK_FABRICABLE, leadDays: lead }
  return { stock: 0, leadDays: null }
}

export type ListingState =
  'sin_publicar' | 'activa' | 'pausada' | 'revisar' | 'cerrada'

export const LISTING_STATE_LABELS: Record<ListingState, string> = {
  sin_publicar: 'Sin publicar',
  activa: 'Publicada',
  pausada: 'Pausada',
  revisar: 'Revisar',
  cerrada: 'Cerrada',
}

export interface ListingLike {
  status: string
  needs_review: boolean
  ml_price: number | null
  ml_stock: number | null
}

export function listingState(l: ListingLike | null | undefined): ListingState {
  if (!l) return 'sin_publicar'
  if (l.status === 'closed') return 'cerrada'
  if (l.needs_review || l.status === 'error' || l.status === 'under_review')
    return 'revisar'
  if (l.status === 'paused') return 'pausada'
  return 'activa'
}

// Una fila de la pestaña Publicaciones: un producto de la tienda y su publicación.
export interface ListingRow {
  productId: string
  family: string
  name: string
  priceWeb: number
  priceMl: number
  mlManual: boolean
  stock: number
  expected: { stock: number; leadDays: number | null }
  listing: (ListingLike & { permalink: string | null }) | null
  state: ListingState
  diffs: string[]
}

export type ListingFilter =
  'todas' | 'publicadas' | 'sin_publicar' | 'diferencias'

export function matchesFilter(r: ListingRow, f: ListingFilter): boolean {
  if (f === 'publicadas') return r.listing !== null
  if (f === 'sin_publicar') return r.listing === null
  if (f === 'diferencias') return r.diffs.length > 0 || r.state === 'revisar'
  return true
}

// Diferencias entre lo publicado y lo que debería estar (según Supabase).
export function listingDiffs(
  l: ListingLike | null | undefined,
  expected: { price: number; stock: number },
): string[] {
  if (!l || l.status === 'closed') return []
  const d: string[] = []
  if (l.ml_price != null && Math.abs(Number(l.ml_price) - expected.price) > 0.5)
    d.push('precio')
  if (l.ml_stock != null && Number(l.ml_stock) !== expected.stock)
    d.push('stock')
  return d
}

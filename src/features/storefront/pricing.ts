// Pure pricing/formatting helpers — ported from the "Global3D Tienda" design.
import type { Product } from './data/products'
import type { CartLine } from './cart-types'

export const CASH_DISCOUNT = 0.09
export const FILAMENT_BULK_QTY = 3
export const FILAMENT_BULK_DISCOUNT = 0.1
export const FREE_SHIPPING_THRESHOLD = 30000
export const SHIPPING_COST = 3500

export function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

export function cashPrice(price: number): number {
  return price * (1 - CASH_DISCOUNT)
}

export function installmentPrice(price: number): number {
  return price / 3
}

// Deterministic pseudo stock-count for "low stock" display — not real
// inventory, just a UI nudge, kept identical to the source design.
function idHash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i)
  return h
}

export function stockCount(p: Product): number {
  const h = idHash(p.id)
  return p.stock === 'low' ? 1 + (h % 4) : 8 + (h % 30)
}

export function leadTimeText(p: Product): string | null {
  const s = p.specs.find((x) => x.startsWith('Tiempo estimado'))
  return s ? s.replace('Tiempo estimado: ', '') : null
}

export function lineDiscountRate(l: CartLine): number {
  return l.cat === 'filamentos' && l.qty >= FILAMENT_BULK_QTY ? FILAMENT_BULK_DISCOUNT : 0
}

export function lineTotal(l: CartLine): number {
  return l.price * l.qty * (1 - lineDiscountRate(l))
}

export function shippingCost(shipMethod: 'domicilio' | 'retiro', subtotal: number): number {
  if (shipMethod === 'retiro') return 0
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
}

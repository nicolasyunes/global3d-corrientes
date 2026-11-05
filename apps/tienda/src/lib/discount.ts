import type { PaymentMethod, ShopSettings } from './types'

// Descuento por pagar en efectivo o transferencia (shop_settings
// .descuento_efectivo.porcentaje). Tiene que redondear igual que
// shop_create_order, que es quien calcula lo que se cobra: round() sobre el
// total del pedido.

export function cashDiscountPct(
  settings: Pick<ShopSettings, 'descuento_efectivo'>,
): number {
  const p = settings.descuento_efectivo?.porcentaje ?? 0
  return p > 0 && p < 100 ? p : 0
}

export function discountFor(method: PaymentMethod): boolean {
  return method === 'transfer' || method === 'cash'
}

export function cashDiscount(total: number, pct: number): number {
  return pct > 0 ? Math.round((total * pct) / 100) : 0
}

/** Precio pagando en efectivo o transferencia. */
export function cashPrice(price: number, pct: number): number {
  return price - cashDiscount(price, pct)
}

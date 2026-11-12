// Envíos por Correo Argentino y Andreani: tipos y ayudas para las
// cotizaciones que hacen las edge functions correo-cotizar y andreani-quote.
// Cada empresa guarda su cotización aparte (shipping_quotes) y el precio que
// se cobra lo pone el servidor (shop_create_order lee la cotización guardada);
// acá solo se muestra.

import type { CartItem } from './cart'

export type Carrier = 'correo' | 'andreani'

export const CARRIER_NAME: Record<Carrier, string> = {
  correo: 'Correo Argentino',
  andreani: 'Andreani',
}

export interface ShippingRate {
  carrier: Carrier
  /** Cotización guardada de la que sale esta tarifa */
  quoteId: string
  deliveredType: 'S' | 'D'
  productType: string
  productName: string
  price: number
  deliveryTimeMin: string | null
  deliveryTimeMax: string | null
}

/** Tarifas de todas las empresas que cotizaron, juntas. */
export interface ShippingQuote {
  postalCode: string
  rates: ShippingRate[]
}

/** Lo que devuelve cada edge function al cotizar. */
export interface CarrierQuote {
  quoteId: string
  postalCode: string
  rates: Omit<ShippingRate, 'carrier' | 'quoteId'>[]
}

export type QuoteResult =
  { ok: true; quote: ShippingQuote } | { ok: false; error: string | null }

export interface Agency {
  code: string
  name: string
  address: string
  city: string
  postalCode: string
  hours: string | null
}

/** Lo que el checkout manda a shop_create_order en delivery.shipping */
export interface ShippingChoice {
  carrier: Carrier
  quoteId: string
  type: 'S' | 'D'
  product: string
  price: number
  label: string
  agencyCode?: string
  agencyName?: string
}

/** Provincias con el código que usa Correo Argentino. */
export const PROVINCES: Array<[code: string, name: string]> = [
  ['C', 'Ciudad Autónoma de Buenos Aires'],
  ['B', 'Buenos Aires'],
  ['K', 'Catamarca'],
  ['H', 'Chaco'],
  ['U', 'Chubut'],
  ['X', 'Córdoba'],
  ['W', 'Corrientes'],
  ['E', 'Entre Ríos'],
  ['P', 'Formosa'],
  ['Y', 'Jujuy'],
  ['L', 'La Pampa'],
  ['F', 'La Rioja'],
  ['M', 'Mendoza'],
  ['N', 'Misiones'],
  ['Q', 'Neuquén'],
  ['R', 'Río Negro'],
  ['A', 'Salta'],
  ['J', 'San Juan'],
  ['D', 'San Luis'],
  ['Z', 'Santa Cruz'],
  ['S', 'Santa Fe'],
  ['G', 'Santiago del Estero'],
  ['V', 'Tierra del Fuego'],
  ['T', 'Tucumán'],
]

/** "3400", "W3400", "W3400ABC" → "3400"; null si no es un CP. */
export function normalizePostalCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/\s+/g, '')
  const m = /^[A-Z]?(\d{4})[A-Z]{0,3}$/.exec(s)
  if (!m || m[1] === '0000') return null
  return m[1]
}

/** Si escribieron el CP nuevo (W3400ABC), la letra es la provincia. */
export function provinceFromPostalCode(raw: string): string | null {
  const m = /^([A-Z])\d{4}/.exec(raw.toUpperCase().replace(/\s+/g, ''))
  if (!m) return null
  return PROVINCES.some(([c]) => c === m[1]) ? m[1] : null
}

/** Los ítems del carrito tal como los entiende el servidor. */
export function shippingItems(items: CartItem[]) {
  return items.map((i) => ({
    productId: i.productId ?? undefined,
    familySlug: i.productId ? undefined : i.familySlug,
    quantity: i.quantity,
  }))
}

/** Clave para saber si el carrito cambió desde la última cotización. */
export function cartShippingKey(items: CartItem[]): string {
  return shippingItems(items)
    .map((i) => `${i.productId ?? i.familySlug}:${i.quantity}`)
    .sort()
    .join('|')
}

export function deliveryTime(r: ShippingRate): string {
  const min = r.deliveryTimeMin
  const max = r.deliveryTimeMax
  if (min && max && min !== max) return `${min} a ${max} días hábiles`
  const d = max ?? min
  return d
    ? `${d} día${d === '1' ? '' : 's'} hábil${d === '1' ? '' : 'es'}`
    : ''
}

export function rateLabel(r: ShippingRate): string {
  const kind = r.deliveredType === 'S' ? 'a sucursal' : 'a domicilio'
  if (r.carrier === 'andreani') return `Andreani ${kind}`
  const name =
    r.productName
      .replace(/^Correo Argentino\s*/i, '')
      .replace(/^clasico$/i, 'Clásico') || 'Clásico'
  return `${name} ${kind}`
}

export function rateKey(
  r: Pick<ShippingRate, 'carrier' | 'deliveredType' | 'productType'>,
) {
  return `${r.carrier}-${r.deliveredType}-${r.productType}`
}

/** La misma clave, para la opción elegida. */
export function choiceKey(
  c: Pick<ShippingChoice, 'carrier' | 'type' | 'product'>,
) {
  return `${c.carrier}-${c.type}-${c.product}`
}

/** Así describe el pedido la opción elegida: "Correo Argentino, Clásico a sucursal". */
export function choiceText(
  c: Pick<ShippingChoice, 'carrier' | 'label'>,
): string {
  return c.carrier === 'andreani'
    ? c.label
    : `${CARRIER_NAME[c.carrier]}, ${c.label}`
}

/** La más barata de cada tipo, para mostrar "desde" en el carrito. */
export function cheapestByType(rates: ShippingRate[]): {
  S: ShippingRate | null
  D: ShippingRate | null
} {
  const pick = (t: 'S' | 'D') =>
    rates
      .filter((r) => r.deliveredType === t)
      .reduce<ShippingRate | null>(
        (best, r) => (!best || r.price < best.price ? r : best),
        null,
      )
  return { S: pick('S'), D: pick('D') }
}

const QUOTE_ERRORS: Record<string, string> = {
  cp: 'Revisá el código postal: son 4 números (ej: 3400).',
  sin_cotizacion:
    'No pudimos cotizar ese código postal. Revisalo o escribinos por WhatsApp.',
  demasiadas: 'Muchas consultas seguidas. Probá de nuevo en un minuto.',
  medidas:
    'El pedido es muy grande para cotizarlo solo. Escribinos por WhatsApp.',
  peso: 'El pedido es muy pesado para cotizarlo solo. Escribinos por WhatsApp.',
}

export function quoteErrorMessage(code: string | null): string {
  return (
    (code && QUOTE_ERRORS[code]) ||
    'No pudimos cotizar el envío ahora. Probá de nuevo en un rato.'
  )
}

/** Errores que significan "el cotizador no está andando": volver a "a cotizar". */
export function quoteUnavailable(code: string | null): boolean {
  return code === 'correo_no_configurado' || code === 'andreani_no_configurado'
}

/** Qué error mostrar cuando ninguna empresa cotizó. */
const ERROR_RANK = [
  'cp',
  'items',
  'peso',
  'medidas',
  'demasiadas',
  'sin_cotizacion',
]

/**
 * Junta las cotizaciones de cada empresa. Alcanza con que una cotice. Si
 * ninguna cotizó: si todas están sin configurar, devuelve un error de "no
 * configurado" (el checkout vuelve a "a cotizar"); si no, el error más útil.
 */
export function mergeQuotes(
  results: Array<
    { carrier: Carrier } & (
      { ok: true; quote: CarrierQuote } | { ok: false; error: string | null }
    )
  >,
): QuoteResult {
  const rates: ShippingRate[] = []
  let postalCode = ''
  const errors: string[] = []
  for (const r of results) {
    if (!r.ok) {
      errors.push(r.error ?? 'error')
      continue
    }
    postalCode ||= r.quote.postalCode
    for (const rate of r.quote.rates)
      rates.push({ ...rate, carrier: r.carrier, quoteId: r.quote.quoteId })
  }
  if (rates.length) {
    // Sucursal primero; dentro de cada tipo, la más barata primero.
    const rank = (r: ShippingRate) => (r.deliveredType === 'S' ? 0 : 1)
    rates.sort((a, b) => rank(a) - rank(b) || a.price - b.price)
    return { ok: true, quote: { postalCode, rates } }
  }
  const real = errors.filter((e) => !quoteUnavailable(e))
  if (!real.length)
    return { ok: false, error: errors[0] ?? 'correo_no_configurado' }
  const best = ERROR_RANK.find((e) => real.includes(e))
  return { ok: false, error: best ?? real[0] }
}

const POSTAL_KEY = 'g3d.tienda.envio'

export function loadShippingPlace(): { postalCode: string; province: string } {
  try {
    const raw = localStorage.getItem(POSTAL_KEY)
    if (raw) {
      const v = JSON.parse(raw)
      return {
        postalCode: String(v.postalCode ?? ''),
        province: String(v.province ?? ''),
      }
    }
  } catch {
    // sin datos guardados
  }
  return { postalCode: '', province: '' }
}

export function saveShippingPlace(postalCode: string, province: string) {
  try {
    localStorage.setItem(POSTAL_KEY, JSON.stringify({ postalCode, province }))
  } catch {
    // no se pudo recordar: no pasa nada
  }
}

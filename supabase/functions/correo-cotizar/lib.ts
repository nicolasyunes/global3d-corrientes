// Lógica pura de correo-cotizar (sin Deno ni red), para poder testearla con
// vitest: normaliza códigos postales, arma los paquetes para la API MiCorreo
// y limpia sus respuestas.

export interface Box {
  key: string
  label: string
  /** gramos */
  weight: number
  /** cm */
  height: number
  width: number
  length: number
}

export interface Package {
  quantity: number
  weight: number
  height: number
  width: number
  length: number
}

export interface Rate {
  deliveredType: 'S' | 'D'
  productType: string
  productName: string
  price: number
  deliveryTimeMin: string | null
  deliveryTimeMax: string | null
}

export interface Agency {
  code: string
  name: string
  address: string
  city: string
  postalCode: string
  hours: string | null
}

/** Provincias según los códigos de Correo Argentino. */
export const PROVINCES: Record<string, string> = {
  C: 'Ciudad Autónoma de Buenos Aires',
  B: 'Buenos Aires',
  K: 'Catamarca',
  H: 'Chaco',
  U: 'Chubut',
  X: 'Córdoba',
  W: 'Corrientes',
  E: 'Entre Ríos',
  P: 'Formosa',
  Y: 'Jujuy',
  L: 'La Pampa',
  F: 'La Rioja',
  M: 'Mendoza',
  N: 'Misiones',
  Q: 'Neuquén',
  R: 'Río Negro',
  A: 'Salta',
  J: 'San Juan',
  D: 'San Luis',
  Z: 'Santa Cruz',
  S: 'Santa Fe',
  G: 'Santiago del Estero',
  V: 'Tierra del Fuego',
  T: 'Tucumán',
}

/**
 * Acepta "3400", "W3400", "W3400ABC" o con espacios y devuelve los 4 dígitos
 * que usa la cotización. null si no es un CP argentino.
 */
export function normalizePostalCode(raw: unknown): string | null {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
  const m = /^[A-Z]?(\d{4})[A-Z]{0,3}$/.exec(s)
  if (!m || m[1] === '0000') return null
  return m[1]
}

function int(n: unknown): number {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? v : 0
}

/** Error de datos con un código que la tienda/admin traduce. */
export class InputError extends Error {}

/** Revisa un paquete contra los límites de MiCorreo. */
export function checkPackage(p: Package): Package {
  const q = {
    quantity: int(p.quantity),
    weight: int(p.weight),
    height: int(p.height),
    width: int(p.width),
    length: int(p.length),
  }
  if (q.quantity < 1 || q.quantity > 100) throw new InputError('cantidad')
  if (q.weight < 1 || q.weight > 50000) throw new InputError('peso')
  for (const side of [q.height, q.width, q.length])
    if (side < 1 || side > 200) throw new InputError('medidas')
  if (q.height + q.width + q.length > 300) throw new InputError('medidas')
  return q
}

/** {"chica": 2} + cajas configuradas → paquetes para /rates/packages. */
export function boxesToPackages(
  counts: Record<string, number>,
  boxes: Box[],
): Package[] {
  const out: Package[] = []
  for (const [key, n] of Object.entries(counts)) {
    const box = boxes.find((b) => b.key === key) ?? boxes[0]
    if (!box || !(n > 0)) continue
    out.push(
      checkPackage({
        quantity: n,
        weight: box.weight,
        height: box.height,
        width: box.width,
        length: box.length,
      }),
    )
  }
  return out
}

/** Limpia la respuesta de /rates o /rates/packages. */
export function parseRates(body: unknown): Rate[] {
  const list = (body as { rates?: unknown[] } | null)?.rates
  if (!Array.isArray(list)) return []
  const out: Rate[] = []
  for (const r of list as Record<string, unknown>[]) {
    const type = r.deliveredType
    const price = Number(r.price)
    if ((type !== 'S' && type !== 'D') || !(price > 0)) continue
    out.push({
      deliveredType: type,
      productType: String(r.productType ?? 'CP'),
      productName: String(r.productName ?? 'Correo Argentino'),
      price: Math.ceil(price),
      deliveryTimeMin: r.deliveryTimeMin == null ? null : String(r.deliveryTimeMin),
      deliveryTimeMax: r.deliveryTimeMax == null ? null : String(r.deliveryTimeMax),
    })
  }
  // Sucursal primero, y dentro de cada una la más barata primero.
  const rank = (r: Rate) => (r.deliveredType === 'S' ? 0 : 1)
  return out.sort((a, b) => rank(a) - rank(b) || a.price - b.price)
}

const DAYS: [string, string][] = [
  ['monday', 'Lun'],
  ['tuesday', 'Mar'],
  ['wednesday', 'Mié'],
  ['thursday', 'Jue'],
  ['friday', 'Vie'],
  ['saturday', 'Sáb'],
]

function hhmm(s: unknown): string {
  const t = String(s ?? '').padStart(4, '0')
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`
}

/** "Lun a Vie 10:00–18:00 · Sáb 09:00–13:00" agrupando días iguales. */
export function formatHours(hours: unknown): string | null {
  if (!hours || typeof hours !== 'object') return null
  const h = hours as Record<string, { start?: string; end?: string } | null>
  const groups: { from: string; to: string; range: string }[] = []
  for (const [key, label] of DAYS) {
    const d = h[key]
    if (!d?.start || !d?.end) continue
    const range = `${hhmm(d.start)}–${hhmm(d.end)}`
    const last = groups[groups.length - 1]
    const prevLabel = DAYS[DAYS.findIndex(([k]) => k === key) - 1]?.[1]
    if (last && last.range === range && last.to === prevLabel) last.to = label
    else groups.push({ from: label, to: label, range })
  }
  if (!groups.length) return null
  return groups
    .map((g) => `${g.from === g.to ? g.from : `${g.from} a ${g.to}`} ${g.range}`)
    .join(' · ')
}

/**
 * Limpia /agencies: solo sucursales activas que entregan al público, ordenadas
 * por cercanía de código postal al del cliente.
 */
export function parseAgencies(body: unknown, postalCode: string | null): Agency[] {
  if (!Array.isArray(body)) return []
  const out: (Agency & { dist: number })[] = []
  for (const a of body as Record<string, unknown>[]) {
    if (a.status && a.status !== 'ACTIVE') continue
    const services = a.services as Record<string, boolean> | undefined
    if (services && services.pickupAvailability === false) continue
    const loc = (a.location as { address?: Record<string, unknown> } | undefined)
      ?.address
    const code = String(a.code ?? '')
    if (!/^[A-Z0-9]{3,12}$/.test(code)) continue
    const cp = normalizePostalCode(loc?.postalCode) ?? ''
    const street = [loc?.streetName, loc?.streetNumber].filter(Boolean).join(' ')
    out.push({
      code,
      name: String(a.name ?? code),
      address: street,
      city: String(loc?.locality || loc?.city || ''),
      postalCode: cp,
      hours: formatHours(a.hours),
      dist:
        postalCode && cp ? Math.abs(Number(cp) - Number(postalCode)) : 99999,
    })
  }
  out.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, 'es'))
  return out.map((a) => ({
    code: a.code,
    name: a.name,
    address: a.address,
    city: a.city,
    postalCode: a.postalCode,
    hours: a.hours,
  }))
}

/**
 * Ordena las claves para comparar con lo que guarda shop_shipping_boxes
 * (jsonb no tiene orden, pero así la respuesta queda prolija).
 */
export function sortCounts(c: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(c)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

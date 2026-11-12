// Cotizador de Correo Argentino del admin: cajas configurables y armado de
// los paquetes que se mandan a la edge function correo-cotizar.

export interface ShipBox {
  key: string
  label: string
  /** gramos */
  weight: number
  /** cm */
  height: number
  width: number
  length: number
}

export interface CorreoConfig {
  cpOrigen: string
  cajas: ShipBox[]
}

export interface ShipPackage {
  quantity: number
  weight: number
  height: number
  width: number
  length: number
}

export interface ShipRate {
  deliveredType: 'S' | 'D'
  productType: string
  productName: string
  price: number
  deliveryTimeMin: string | null
  deliveryTimeMax: string | null
}

export const DEFAULT_BOXES: ShipBox[] = [
  { key: 'chica', label: 'Caja chica', weight: 500, height: 10, width: 15, length: 20 },
  { key: 'mediana', label: 'Caja mediana', weight: 1500, height: 15, width: 20, length: 30 },
  { key: 'grande', label: 'Caja grande', weight: 4000, height: 30, width: 30, length: 40 },
]

/** "3400", "W3400ABC" → "3400"; null si no es un CP argentino. */
export function normalizePostalCode(raw: string): string | null {
  const m = /^[A-Z]?(\d{4})[A-Z]{0,3}$/.exec(raw.toUpperCase().replace(/\s+/g, ''))
  if (!m || m[1] === '0000') return null
  return m[1]
}

/** Revisa un paquete contra los límites de MiCorreo. Devuelve el error o null. */
export function packageError(p: ShipPackage): string | null {
  if (!(p.quantity >= 1 && p.quantity <= 100)) return 'La cantidad va de 1 a 100.'
  if (!(p.weight >= 1 && p.weight <= 50000))
    return 'El peso va de 1 g a 50 kg por bulto.'
  const sides = [p.height, p.width, p.length]
  if (sides.some((s) => !(s >= 1 && s <= 200)))
    return 'Cada lado va de 1 a 200 cm.'
  if (sides.reduce((a, b) => a + b, 0) > 300)
    return 'Alto + ancho + largo no puede pasar los 300 cm.'
  return null
}

/** Cantidades por caja → paquetes (se omiten las cajas en 0). */
export function boxesToPackages(
  counts: Record<string, number>,
  boxes: ShipBox[],
): ShipPackage[] {
  return boxes
    .filter((b) => (counts[b.key] ?? 0) > 0)
    .map((b) => ({
      quantity: counts[b.key],
      weight: b.weight,
      height: b.height,
      width: b.width,
      length: b.length,
    }))
}

/** Clave nueva para una caja a partir del nombre ("Caja tubo" → "caja-tubo"). */
export function boxKey(label: string, taken: string[]): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'caja'
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) if (!taken.includes(`${base}-${n}`)) return `${base}-${n}`
}

/** Error de la configuración de cajas, o null si se puede guardar. */
export function configError(cfg: CorreoConfig): string | null {
  if (!normalizePostalCode(cfg.cpOrigen)) return 'Revisá el CP de origen.'
  if (cfg.cajas.length === 0) return 'Tiene que haber al menos una caja.'
  for (const b of cfg.cajas) {
    if (!b.label.trim()) return 'Cada caja necesita un nombre.'
    const err = packageError({ quantity: 1, ...b })
    if (err) return `${b.label}: ${err}`
  }
  return null
}

export function deliveryTime(r: ShipRate): string {
  const { deliveryTimeMin: min, deliveryTimeMax: max } = r
  if (min && max && min !== max) return `${min} a ${max} días hábiles`
  const d = max ?? min
  return d ? `${d} día${d === '1' ? '' : 's'} hábil${d === '1' ? '' : 'es'}` : ''
}

export function serviceName(r: ShipRate): string {
  return (
    r.productName
      .replace(/^Correo Argentino\s*/i, '')
      .replace(/^clasico$/i, 'Clásico') || r.productType
  )
}

const money = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)

/** Texto para pegarle al cliente por WhatsApp. */
export function quoteText(postalCode: string, rates: ShipRate[]): string {
  const line = (t: 'S' | 'D', title: string) => {
    const list = rates.filter((r) => r.deliveredType === t)
    if (!list.length) return null
    return `${title}: ${list
      .map((r) => `${serviceName(r)} ${money(r.price)} (${deliveryTime(r)})`)
      .join(' · ')}`
  }
  return [
    `Envío por Correo Argentino a CP ${postalCode}`,
    line('S', 'A sucursal'),
    line('D', 'A domicilio'),
  ]
    .filter(Boolean)
    .join('\n')
}

const ERRORS: Record<string, string> = {
  correo_no_configurado:
    'Falta cargar las credenciales de MiCorreo en Supabase (secrets MICORREO_*).',
  cp: 'Revisá el código postal de destino.',
  sin_cotizacion: 'Correo no cotizó ese destino o esas medidas.',
  medidas: 'Las medidas superan lo que acepta Correo.',
  peso: 'El peso supera lo que acepta Correo.',
  cantidad: 'Revisá las cantidades.',
  no_autorizado: 'Tu sesión venció. Volvé a entrar.',
  correo_caido: 'Correo Argentino no respondió. Probá de nuevo en un rato.',
}

export function shippingErrorMessage(code: string | null): string {
  return (code && ERRORS[code]) || 'No se pudo cotizar. Probá de nuevo.'
}

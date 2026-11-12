// Envío por Correo de un pedido web: qué guardó la tienda, qué falta para
// importarlo en MiCorreo y cómo se muestra. La importación y el seguimiento los
// hace la edge function correo-envio.

export interface ShipmentRecipient {
  name: string
  email: string
  phone: string
  street: string
  number: string
  floor: string
  apartment: string
  city: string
  province: string
}

/** delivery.shipping de shop_orders (lo arma shop_create_order). */
export interface SavedShipping {
  carrier?: string
  type?: 'S' | 'D'
  productName?: string
  price?: number
  postalCode?: string
  agencyCode?: string | null
  agencyName?: string | null
  recipient?: Partial<ShipmentRecipient>
}

export interface TrackingEvent {
  event: string
  date: string
  branch: string
  status: string
}

/** Fila de shop_shipments. */
export interface ShipmentRow {
  order_id: string
  ext_order_id: string
  imported_at: string | null
  tracking_number: string | null
  tracking_events: TrackingEvent[]
  tracking_checked_at: string | null
  last_error: string | null
}

/** El pedido se cotizó con Correo Argentino desde la tienda. */
export function isCorreoShipping(
  s: SavedShipping | null | undefined,
): s is SavedShipping {
  return (
    !!s &&
    s.carrier === 'correo_argentino' &&
    (s.type === 'S' || s.type === 'D')
  )
}

/** Datos para el formulario: lo que guardó la tienda + nombre y WhatsApp del cliente. */
export function initialRecipient(
  s: SavedShipping,
  customer: { name?: string | null; whatsapp?: string | null },
): ShipmentRecipient {
  const r = s.recipient ?? {}
  return {
    name: customer.name ?? '',
    email: r.email ?? '',
    phone: customer.whatsapp ?? '',
    street: r.street ?? '',
    number: r.number ?? '',
    floor: r.floor ?? '',
    apartment: r.apartment ?? '',
    city: r.city ?? '',
    province: r.province ?? '',
  }
}

/** Primer dato que falta para importar; null si está todo. */
export function recipientError(
  r: ShipmentRecipient,
  type: 'S' | 'D',
): string | null {
  if (r.name.trim().length < 2) return 'Falta el nombre del destinatario.'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email.trim()))
    return 'Falta el email del destinatario (MiCorreo lo exige).'
  if (type === 'D') {
    if (r.street.trim().length < 2 || !r.number.trim())
      return 'Falta calle y número.'
    if (r.city.trim().length < 2) return 'Falta la ciudad.'
    if (!r.province) return 'Falta la provincia.'
  }
  return null
}

const ERRORS: Record<string, string> = {
  correo_no_configurado:
    'MiCorreo no está configurado (faltan las credenciales en Supabase).',
  correo_caido: 'MiCorreo no responde. Probá de nuevo en un rato.',
  no_autorizado: 'Tu sesión venció. Volvé a entrar.',
  no_es_correo: 'Este pedido no tiene un envío cotizado con Correo.',
  sin_envio: 'Primero creá el envío en Correo.',
  seguimiento: 'Revisá el número de seguimiento (solo letras y números).',
  email: 'Revisá el email del destinatario.',
  direccion: 'Revisá calle, número y ciudad.',
  provincia: 'Elegí la provincia.',
  nombre: 'Revisá el nombre del destinatario.',
  cp: 'El pedido no tiene un código postal válido.',
  cajas: 'Revisá las cajas de envío en Cotizar envío.',
}

export function shipmentErrorMessage(
  code: string | null,
  message?: string | null,
): string {
  if (code === 'micorreo' && message) return `MiCorreo lo rechazó: ${message}`
  return (code && ERRORS[code]) || 'No se pudo. Probá de nuevo en un rato.'
}

/** "dd-mm-aaaa hh:mm" de MiCorreo → "dd/mm hh:mm" */
export function eventDate(d: string): string {
  const m = /^(\d{2})-(\d{2})-\d{4} (\d{2}:\d{2})/.exec(d)
  return m ? `${m[1]}/${m[2]} ${m[3]}` : d
}

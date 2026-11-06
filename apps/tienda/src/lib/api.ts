import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { quoteFilePath } from './quoteFiles'
import type { Agency, ShippingQuote } from './shipping'
import type {
  CreateOrderInput,
  CreateOrderResult,
  Family,
  FilamentLine,
  InstagramPost,
  OrderStatusResult,
  ShopSettings,
} from './types'

// Cliente propio y sin sesión: la tienda es pública y no debe tomar la sesión
// del admin aunque se abra en el mismo dominio.
const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new ShopError(error.message)
  return data as T
}

export class ShopError extends Error {}

// Mensajes legibles para los errores que lanza shop_create_order
const ORDER_ERRORS: Record<string, string> = {
  nombre_invalido: 'Revisá tu nombre: tiene que tener entre 2 y 80 letras.',
  whatsapp_invalido:
    'Revisá tu WhatsApp: escribilo con característica, por ejemplo 379 4123456.',
  items_invalidos: 'Tu carrito está vacío o tiene demasiados productos.',
  entrega_invalida: 'Elegí cómo querés recibir el pedido.',
  direccion_invalida: 'Escribí la dirección de entrega.',
  pago_invalido: 'Elegí si pagás la seña o el total.',
  medio_invalido: 'Elegí el medio de pago.',
  producto_invalido:
    'Uno de los productos ya no está disponible. Sacalo del carrito y probá de nuevo.',
  cantidad_minima: 'Uno de los productos no llega a la cantidad mínima.',
  envio_sin_cotizar: 'Cotizá el envío con tu código postal antes de confirmar.',
  envio_invalido: 'Elegí de nuevo cómo te lo mandamos.',
  cotizacion_vencida:
    'El precio del envío se actualizó. Revisalo y confirmá de nuevo.',
  sucursal_invalida: 'Elegí la sucursal de Correo donde lo retirás.',
  demasiados_pedidos:
    'Recibimos varios pedidos seguidos desde este número. Escribinos por WhatsApp y lo cargamos nosotros.',
}

export function orderErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const key = Object.keys(ORDER_ERRORS).find((k) => msg.includes(k))
  return key
    ? ORDER_ERRORS[key]
    : 'No pudimos registrar el pedido. Revisá tu conexión y probá de nuevo, o escribinos por WhatsApp.'
}

/** Lee el código de error que devuelve una edge function ({ error: '...' }). */
async function functionErrorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context
  if (ctx instanceof Response) {
    const body = await ctx.json().catch(() => null)
    if (body && typeof body.error === 'string') return body.error
  }
  return null
}

export type QuoteResult =
  | { ok: true; quote: ShippingQuote }
  | { ok: false; error: string | null }

export const api = {
  catalog: () => rpc<Family[]>('shop_catalog'),
  filaments: () => rpc<FilamentLine[]>('shop_filaments'),
  settings: () => rpc<ShopSettings>('shop_settings'),
  createOrder: (input: CreateOrderInput) =>
    rpc<CreateOrderResult>('shop_create_order', { p: input }),
  orderStatus: (token: string) =>
    rpc<OrderStatusResult | null>('shop_order_status', { p_token: token }),
  /** Sube un archivo de "Pedido a medida" y devuelve su link público. */
  uploadQuoteFile: async (file: File, type: string): Promise<string> => {
    const path = quoteFilePath(type)
    const bucket = supabase.storage.from('shop-quote-files')
    const { error } = await bucket.upload(path, file, {
      contentType: type,
      upsert: false,
    })
    if (error) throw new ShopError(error.message)
    return bucket.getPublicUrl(path).data.publicUrl
  },
  // Edge function con caché; si algo falla devuelve [] y la sección no se ve.
  /** Cobra con tarjeta (edge function mp-pay); el monto lo calcula el servidor. */
  payWithMercadoPago: async (
    orderToken: string,
    formData: unknown,
  ): Promise<{ status: string | null; statusDetail: string | null }> => {
    const { data, error } = await supabase.functions.invoke<{
      status: string
      statusDetail: string | null
    }>('mp-pay', { body: { orderToken, formData } })
    if (error || !data) return { status: null, statusDetail: null }
    return data
  },
  /** Preferencia para "Pagar con Mercado Pago" (edge function mp-preference). */
  mercadoPagoPreference: async (
    orderToken: string,
    returnUrl: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke<{
      preferenceId: string
    }>('mp-preference', { body: { orderToken, returnUrl } })
    if (error || !data?.preferenceId) return null
    return data.preferenceId
  },
  /** Cotiza el envío del carrito con Correo Argentino (edge function correo-cotizar). */
  quoteShipping: async (
    items: Array<{ productId?: string; familySlug?: string; quantity: number }>,
    postalCode: string,
  ): Promise<QuoteResult> => {
    const { data, error } = await supabase.functions.invoke<ShippingQuote>(
      'correo-cotizar',
      { body: { action: 'rates', items, postalCode } },
    )
    if (error || !data?.quoteId)
      return { ok: false, error: await functionErrorCode(error) }
    return { ok: true, quote: data }
  },
  /** Sucursales de Correo de una provincia, las más cercanas al CP primero. */
  agencies: async (provinceCode: string, postalCode: string): Promise<Agency[]> => {
    const { data, error } = await supabase.functions.invoke<{
      agencies: Agency[]
    }>('correo-cotizar', {
      body: { action: 'agencies', provinceCode, postalCode },
    })
    if (error || !data) throw new ShopError('sucursales')
    return data.agencies ?? []
  },
  instagram: async (): Promise<InstagramPost[]> => {
    const { data, error } = await supabase.functions.invoke<{
      posts: InstagramPost[]
    }>('instagram-feed', { method: 'GET' })
    if (error || !data) return []
    return data.posts ?? []
  },
}

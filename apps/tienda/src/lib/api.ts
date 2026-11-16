import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { takeEarly, type EarlyKey } from './early'
import { quoteFilePath } from './quoteFiles'
import type {
  CreateOrderInput,
  CreateOrderResult,
  Family,
  FilamentLine,
  InstagramPost,
  OrderStatusResult,
  ShopSettings,
} from './types'

// Las funciones shop_* se llaman con fetch directo a PostgREST: así la home no
// carga supabase-js (~100 KB) para pintar. El cliente completo se baja recién
// cuando hace falta (subir archivos o llamar a una edge function).
let client: Promise<SupabaseClient> | null = null
function supabase(): Promise<SupabaseClient> {
  // Cliente propio y sin sesión: la tienda es pública y no debe tomar la
  // sesión del admin aunque se abra en el mismo dominio.
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  )
  return client
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args ?? {}),
    })
  } catch (e) {
    throw new ShopError(e instanceof Error ? e.message : String(e))
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${res.status}`
    throw new ShopError(msg)
  }
  return body as T
}

/** Usa el pedido que ya hizo index.html; si falló, lo repite. */
function early<T>(key: EarlyKey, fn: string): Promise<T> {
  const p = takeEarly<T>(key)
  return p ? p.catch(() => rpc<T>(fn)) : rpc<T>(fn)
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

export const api = {
  // El HTML ya las pidió antes de que cargue el JS (ver index.html)
  catalog: () => early<Family[]>('catalog', 'shop_catalog'),
  filaments: () => rpc<FilamentLine[]>('shop_filaments'),
  settings: () => early<ShopSettings>('settings', 'shop_settings'),
  createOrder: (input: CreateOrderInput) =>
    rpc<CreateOrderResult>('shop_create_order', { p: input }),
  orderStatus: (token: string) =>
    rpc<OrderStatusResult | null>('shop_order_status', { p_token: token }),
  /** Sube un archivo de "Pedido a medida" y devuelve su link público. */
  uploadQuoteFile: async (file: File, type: string): Promise<string> => {
    const path = quoteFilePath(type)
    const bucket = (await supabase()).storage.from('shop-quote-files')
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
    const { data, error } = await (
      await supabase()
    ).functions.invoke<{
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
    const { data, error } = await (
      await supabase()
    ).functions.invoke<{
      preferenceId: string
    }>('mp-preference', { body: { orderToken, returnUrl } })
    if (error || !data?.preferenceId) return null
    return data.preferenceId
  },
  instagram: async (): Promise<InstagramPost[]> => {
    try {
      const { data, error } = await (
        await supabase()
      ).functions.invoke<{
        posts: InstagramPost[]
      }>('instagram-feed', { method: 'GET' })
      if (error || !data) return []
      return data.posts ?? []
    } catch {
      return []
    }
  },
}

import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
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
  instagram: async (): Promise<InstagramPost[]> => {
    const { data, error } = await supabase.functions.invoke<{
      posts: InstagramPost[]
    }>('instagram-feed', { method: 'GET' })
    if (error || !data) return []
    return data.posts ?? []
  },
}

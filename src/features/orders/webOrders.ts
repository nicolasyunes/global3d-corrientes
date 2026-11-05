import { supabase } from '@/lib/supabase'

// Pedidos de la tienda que esperan confirmación del taller (`web_pending`).
// La base los oculta de las vistas normales del admin; acá se leen y se
// manejan con funciones propias (migración 20261105120000).

export interface WebOrderItem {
  description: string
  personalization: string | null
  quantity: number
}

export interface WebOrder {
  id: string
  code: string
  createdAt: string
  customer: string | null
  whatsapp: string | null
  total: number | null
  delivery: { mode: 'retiro' | 'corrientes' | 'pais'; address?: string | null }
  payment: {
    mode: 'sena' | 'total'
    method: 'transfer' | 'cash'
    deposit?: number | null
  }
  notes: string | null
  items: WebOrderItem[]
}

const SEEN_KEY = 'g3d.webOrders.seen'

// Estas funciones no están en los tipos generados de la base.
type Rpc = <T>(
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: T | null; error: { message: string } | null }>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

export async function listPendingWebOrders(): Promise<WebOrder[]> {
  const { data, error } = await rpc<WebOrder[]>('shop_pending_orders')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function confirmWebOrder(id: string): Promise<boolean> {
  const { data, error } = await rpc<boolean>('shop_confirm_order', {
    p_order: id,
  })
  if (error) throw new Error(error.message)
  return data === true
}

export async function discardWebOrder(id: string): Promise<boolean> {
  const { data, error } = await rpc<boolean>('shop_discard_order', {
    p_order: id,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/** Los que entraron después de lo último que se vio en este dispositivo. */
export function unseen(orders: WebOrder[], seenAt: string | null): WebOrder[] {
  if (!seenAt) return orders
  const t = new Date(seenAt).getTime()
  return orders.filter((o) => new Date(o.createdAt).getTime() > t)
}

export function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

/** Marca como vistos todos los pedidos hasta el más nuevo de la lista. */
export function markSeen(orders: WebOrder[]): void {
  const newest = orders.reduce<string | null>(
    (max, o) => (!max || o.createdAt > max ? o.createdAt : max),
    null,
  )
  if (!newest) return
  try {
    localStorage.setItem(SEEN_KEY, newest)
  } catch {
    // Sin storage el aviso vuelve a aparecer al recargar; no es grave.
  }
}

/** Link de WhatsApp al cliente con el código del pedido. */
export function customerWhatsApp(o: WebOrder): string | null {
  const digits = (o.whatsapp ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  const full = digits.startsWith('54') ? digits : `549${digits}`
  const text = `¡Hola ${(o.customer ?? '').split(' ')[0]}! Te escribimos de Global3D por tu pedido ${o.code} de la tienda.`
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

export const DELIVERY_LABEL: Record<WebOrder['delivery']['mode'], string> = {
  retiro: 'Retira en el local',
  corrientes: 'Envío en Corrientes',
  pais: 'Envío al país',
}

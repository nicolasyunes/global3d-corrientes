import { supabase } from '@/lib/supabase'

// Pedidos que entran desde la tienda (`origin_channel = 'web'`) y todavía
// están en estado `new`. El aviso del panel muestra solo los que este
// dispositivo no vio: la última fecha vista se guarda en localStorage.

export interface WebOrder {
  id: string
  createdAt: string
  total: number | null
  customer: string | null
}

const SEEN_KEY = 'g3d.webOrders.seen'

export async function listNewWebOrders(): Promise<WebOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, created_at, total_amount, customers(name)')
    .eq('origin_channel', 'web')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map((o) => ({
    id: o.id,
    createdAt: o.created_at,
    total: o.total_amount,
    customer: (o.customers as { name: string | null } | null)?.name ?? null,
  }))
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

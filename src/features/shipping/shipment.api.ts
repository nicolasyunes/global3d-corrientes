import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  SavedShipping,
  ShipmentRecipient,
  ShipmentRow,
  TrackingEvent,
} from './shipment'

// shop_orders y shop_shipments no están en los tipos generados de la base.
const db = supabase as unknown as SupabaseClient

export interface OrderShipmentData {
  shipping: SavedShipping | null
  shipment: ShipmentRow | null
}

export async function getOrderShipment(
  orderId: string,
): Promise<OrderShipmentData> {
  const [so, sh] = await Promise.all([
    db
      .from('shop_orders')
      .select('delivery')
      .eq('order_id', orderId)
      .maybeSingle(),
    db.from('shop_shipments').select('*').eq('order_id', orderId).maybeSingle(),
  ])
  if (so.error) throw so.error
  const delivery = (so.data?.delivery ?? null) as {
    shipping?: SavedShipping
  } | null
  return {
    shipping: delivery?.shipping ?? null,
    shipment: (sh.data as ShipmentRow | null) ?? null,
  }
}

export type CallResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string | null; message?: string | null }

async function call<T>(body: Record<string, unknown>): Promise<CallResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>('correo-envio', {
    body,
  })
  if (error || !data) {
    const ctx = (error as { context?: unknown } | null)?.context
    if (ctx instanceof Response) {
      const b = await ctx.json().catch(() => null)
      if (b && typeof b.error === 'string')
        return { ok: false, error: b.error, message: b.message ?? null }
    }
    return { ok: false, error: null }
  }
  return { ok: true, ...data }
}

/** Importa el envío en MiCorreo (edge function correo-envio). */
export function importShipment(orderId: string, recipient: ShipmentRecipient) {
  return call<{ imported: boolean; already: boolean; extOrderId: string }>({
    action: 'import',
    orderId,
    recipient,
  })
}

/** Guarda el número de seguimiento (si viene) y trae los eventos. */
export function refreshTracking(orderId: string, trackingNumber?: string) {
  return call<{
    trackingNumber: string
    events: TrackingEvent[]
    checkedAt: string
  }>({
    action: 'tracking',
    orderId,
    ...(trackingNumber !== undefined ? { trackingNumber } : {}),
  })
}

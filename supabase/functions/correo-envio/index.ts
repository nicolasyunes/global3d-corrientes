// correo-envio: importa en MiCorreo el envío de un pedido web cotizado con
// Correo Argentino y trae su seguimiento. Solo para usuarios del admin.
//
// POST { action: 'import', orderId, recipient? } → arma el envío con lo que
//   guardó la tienda (delivery.shipping) y lo que corrija el admin en
//   `recipient`, apila las cajas con /rates/calculate y llama a
//   /shipping/import. Queda en shop_shipments.
// POST { action: 'tracking', orderId, trackingNumber? } → guarda el número
//   (si viene) y trae los eventos de /shipping/tracking.
//
// Secrets: los mismos de correo-cotizar (MICORREO_USER, MICORREO_PASSWORD,
// MICORREO_CUSTOMER_ID, MICORREO_ENV). Sin credenciales responde 503.

import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Box } from '../correo-cotizar/lib.ts'
import {
  buildImport,
  calculateBody,
  checkRecipient,
  fallbackParcel,
  InputError,
  MiCorreoClient,
  MiCorreoError,
  normalizeTracking,
  parseTracking,
  type Parcel,
  type Recipient,
} from './lib.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const client = new MiCorreoClient({
  base:
    Deno.env.get('MICORREO_ENV') === 'prod'
      ? 'https://api.correoargentino.com.ar/micorreo/v1'
      : 'https://apitest.correoargentino.com.ar/micorreo/v1',
  user: Deno.env.get('MICORREO_USER') ?? '',
  password: Deno.env.get('MICORREO_PASSWORD') ?? '',
})

interface SavedShipping {
  carrier?: string
  type?: 'S' | 'D'
  product?: string
  price?: number
  postalCode?: string
  boxes?: Record<string, number>
  agencyCode?: string | null
  recipient?: Partial<Recipient>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  const customerId = Deno.env.get('MICORREO_CUSTOMER_ID')
  if (!customerId || !Deno.env.get('MICORREO_USER'))
    return json({ error: 'correo_no_configurado' }, 503)

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const jwt = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )
  const { data: auth } = await db.auth.getUser(jwt)
  if (!auth?.user) return json({ error: 'no_autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '')
  const orderId = String(body?.orderId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'pedido' }, 400)

  try {
    if (action === 'tracking') {
      const { data: row } = await db
        .from('shop_shipments')
        .select('tracking_number')
        .eq('order_id', orderId)
        .maybeSingle()
      if (!row) return json({ error: 'sin_envio' }, 404)
      let number = row.tracking_number as string | null
      if (body?.trackingNumber !== undefined) {
        number = normalizeTracking(body.trackingNumber)
        if (!number) return json({ error: 'seguimiento' }, 400)
      }
      if (!number) return json({ error: 'seguimiento' }, 400)
      const raw = await client.tracking(number).catch((e) => {
        // Un 404 de MiCorreo es "todavía no hay datos", no un error.
        if (e instanceof MiCorreoError && e.http === 404) return []
        throw e
      })
      const { events } = parseTracking(raw)
      const now = new Date().toISOString()
      const { error } = await db
        .from('shop_shipments')
        .update({
          tracking_number: number,
          tracking_events: events,
          tracking_checked_at: now,
          updated_at: now,
        })
        .eq('order_id', orderId)
      if (error) throw new Error(error.message)
      return json({ trackingNumber: number, events, checkedAt: now })
    }

    if (action !== 'import') return json({ error: 'accion' }, 400)

    const { data: so } = await db
      .from('shop_orders')
      .select(
        'token, delivery, orders(total_amount, customers(name, whatsapp))',
      )
      .eq('order_id', orderId)
      .maybeSingle()
    if (!so) return json({ error: 'pedido' }, 404)
    const shipping = (so.delivery as { shipping?: SavedShipping } | null)
      ?.shipping
    if (!shipping || shipping.carrier !== 'correo_argentino' || !shipping.type)
      return json({ error: 'no_es_correo' }, 400)

    const order = so.orders as unknown as {
      total_amount: number | null
      customers: { name: string | null; whatsapp: string | null } | null
    } | null
    const code = String(so.token).slice(0, 6).toUpperCase()

    const recipient = checkRecipient(
      {
        name: order?.customers?.name ?? '',
        phone: order?.customers?.whatsapp ?? '',
        postalCode: shipping.postalCode ?? '',
        ...(shipping.recipient ?? {}),
      },
      body?.recipient,
      shipping.type,
    )

    const { data: setting } = await db
      .from('shop_settings')
      .select('value')
      .eq('key', 'correo')
      .maybeSingle()
    const boxes = ((setting?.value as { cajas?: Box[] } | null)?.cajas ??
      []) as Box[]
    const counts = shipping.boxes ?? {}
    const fallback = fallbackParcel(counts, boxes)
    const single = Object.values(counts).reduce((a, n) => a + n, 0) === 1
    let parcel: Parcel = fallback
    if (!single) {
      // Apilar varias cajas en un paquete; si falla, el respaldo.
      parcel =
        (await client
          .calculate(calculateBody(Date.now() % 1e9, counts, boxes))
          .catch(() => null)) ?? fallback
    }

    const total = Number(order?.total_amount) || 0
    const payload = buildImport({
      customerId,
      extOrderId: `G3D-${code}`,
      orderNumber: code,
      deliveryType: shipping.type,
      productType: shipping.product ?? 'CP',
      agency: shipping.agencyCode,
      recipient,
      parcel,
      declaredValue: Math.max(1, total - (Number(shipping.price) || 0)),
    })

    const now = new Date().toISOString()
    try {
      const res = await client.importShipping(payload)
      const { error } = await db.from('shop_shipments').upsert({
        order_id: orderId,
        carrier: 'correo',
        ext_order_id: payload.extOrderId,
        import_payload: payload,
        imported_at: now,
        last_error: null,
        updated_at: now,
      })
      if (error) throw new Error(error.message)
      return json({
        imported: true,
        already: res.already,
        extOrderId: payload.extOrderId,
      })
    } catch (e) {
      if (
        e instanceof MiCorreoError &&
        e.http >= 400 &&
        e.http < 500 &&
        e.http !== 401
      ) {
        await db.from('shop_shipments').upsert({
          order_id: orderId,
          carrier: 'correo',
          ext_order_id: payload.extOrderId,
          import_payload: payload,
          last_error: e.message.slice(0, 300),
          updated_at: now,
        })
        return json(
          { error: 'micorreo', message: e.message.slice(0, 300) },
          422,
        )
      }
      throw e
    }
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, 400)
    if (e instanceof MiCorreoError) {
      console.error(
        'micorreo',
        JSON.stringify({ http: e.http, message: e.message }),
      )
      return json({ error: 'correo_caido' }, 502)
    }
    console.error('correo-envio', e instanceof Error ? e.message : e)
    return json({ error: 'interno' }, 500)
  }
})

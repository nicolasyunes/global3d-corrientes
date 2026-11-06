// mp-preference: crea la "preferencia" de Mercado Pago de un pedido de la
// tienda, para que el Payment Brick ofrezca "Pagar con Mercado Pago" (dinero
// en cuenta, tarjetas guardadas, cuotas sin tarjeta). El cliente se loguea en
// Mercado Pago y vuelve a la página del pedido; el pago lo registra
// mp-webhook (external_reference = token del pedido). El monto sale de la
// base, igual que en mp-pay.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// A dónde puede volver el cliente después de pagar.
const RETURN_HOSTS = [
  'www.global3d.com.ar',
  'global3d.com.ar',
  'global3d-corrientes.vercel.app',
  'localhost',
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) return json({ error: 'mp_no_configurado' }, 503)

  const body = await req.json().catch(() => ({}))
  const orderToken = String(body?.orderToken ?? '')
  if (!/^[0-9a-f]{32}$/.test(orderToken))
    return json({ error: 'datos_invalidos' }, 400)

  let returnUrl: URL
  try {
    returnUrl = new URL(String(body?.returnUrl ?? ''))
  } catch {
    return json({ error: 'datos_invalidos' }, 400)
  }
  if (!RETURN_HOSTS.includes(returnUrl.hostname))
    return json({ error: 'datos_invalidos' }, 400)
  returnUrl.search = ''
  returnUrl.hash = ''

  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: shopOrder } = await db
    .from('shop_orders')
    .select('order_id, payment, orders(status)')
    .eq('token', orderToken)
    .maybeSingle()
  if (!shopOrder) return json({ error: 'pedido_inexistente' }, 404)
  const status = (shopOrder.orders as { status: string } | null)?.status
  if (status === 'cancelled') return json({ error: 'pedido_cancelado' }, 409)

  const target = Number(
    (shopOrder.payment as { deposit?: number } | null)?.deposit ?? 0,
  )
  const { data: prev } = await db
    .from('shop_mp_payments')
    .select('amount')
    .eq('order_id', shopOrder.order_id)
    .eq('status', 'approved')
  const paid = (prev ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const amount = Math.round((target - paid) * 100) / 100
  if (amount <= 0) return json({ error: 'ya_pagado' }, 409)

  const code = orderToken.slice(0, 6).toUpperCase()
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          id: code,
          title: `Pedido ${code} · Global3D`,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS',
        },
      ],
      external_reference: orderToken,
      notification_url: `${url}/functions/v1/mp-webhook`,
      back_urls: {
        success: returnUrl.toString(),
        pending: returnUrl.toString(),
        failure: returnUrl.toString(),
      },
      // Mercado Pago vuelve automáticamente solo a direcciones https.
      ...(returnUrl.protocol === 'https:' ? { auto_return: 'approved' } : {}),
      statement_descriptor: 'GLOBAL3D',
    }),
    signal: AbortSignal.timeout(15000),
  })
  const pref = await res.json().catch(() => null)
  if (!res.ok || !pref?.id) {
    console.error(
      'mp-preference rechazo',
      JSON.stringify({ http: res.status, message: pref?.message }),
    )
    return json({ error: 'mp_rechazo' }, 502)
  }
  return json({ preferenceId: pref.id, amount })
})

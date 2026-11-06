// mp-pay: cobra con tarjeta la seña (o el total) de un pedido de la tienda.
// Recibe el token del pedido y los datos que arma el Card Payment Brick de
// Mercado Pago (la tarjeta ya viene tokenizada: acá nunca llega el número).
// El monto sale de la base, nunca del navegador. Necesita el secret
// MP_ACCESS_TOKEN; sin él responde 503 y la tienda no ofrece el pago.

import { createClient } from 'npm:@supabase/supabase-js@2'

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

interface BrickData {
  token?: string
  payment_method_id?: string
  issuer_id?: string | number
  installments?: number
  payer?: {
    email?: string
    identification?: { type?: string; number?: string }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) return json({ error: 'mp_no_configurado' }, 503)

  let body: { orderToken?: string; formData?: BrickData }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'datos_invalidos' }, 400)
  }
  const orderToken = body.orderToken ?? ''
  const f = body.formData ?? {}
  if (
    !/^[0-9a-f]{32}$/.test(orderToken) ||
    !f.token ||
    !f.payment_method_id ||
    !f.payer?.email
  )
    return json({ error: 'datos_invalidos' }, 400)

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

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      // Reintentar el mismo envío no cobra dos veces.
      'X-Idempotency-Key': `${orderToken}-${f.token}`,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      token: f.token,
      description: `Pedido ${orderToken.slice(0, 6).toUpperCase()} · Global3D`,
      installments: f.installments ?? 1,
      payment_method_id: f.payment_method_id,
      issuer_id: f.issuer_id ? Number(f.issuer_id) : undefined,
      payer: {
        email: f.payer.email,
        identification: f.payer.identification,
      },
      external_reference: orderToken,
      notification_url: `${url}/functions/v1/mp-webhook`,
      statement_descriptor: 'GLOBAL3D',
    }),
    signal: AbortSignal.timeout(20000),
  })
  const pay = await res.json().catch(() => null)
  if (!res.ok || !pay?.id) {
    // Solo el motivo que da Mercado Pago, nunca datos de la tarjeta.
    console.error(
      'mp-pay rechazo',
      JSON.stringify({
        http: res.status,
        message: pay?.message,
        error: pay?.error,
        cause: pay?.cause,
      }),
    )
    return json(
      { error: 'mp_rechazo', detail: pay?.message ?? `http_${res.status}` },
      502,
    )
  }

  await db.rpc('shop_record_mp_payment', {
    p_token: orderToken,
    p_mp_id: String(pay.id),
    p_status: pay.status,
    p_detail: pay.status_detail ?? null,
    p_amount: pay.transaction_amount ?? amount,
  })

  return json({
    status: pay.status,
    statusDetail: pay.status_detail ?? null,
    amount,
  })
})

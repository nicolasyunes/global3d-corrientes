// mp-webhook: aviso de Mercado Pago cuando un pago cambia de estado (por si
// el cliente cerró la página antes de la respuesta, o el pago quedó en
// revisión y se aprobó después). No confía en el contenido del aviso: vuelve
// a pedir el pago a Mercado Pago con MP_ACCESS_TOKEN y registra eso.
// Si está el secret MP_WEBHOOK_SECRET, además valida la firma (x-signature).

import { createClient } from 'npm:@supabase/supabase-js@2'

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function validSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  if (!secret) return true
  const header = req.headers.get('x-signature') ?? ''
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.trim().split('=') as [string, string]),
  )
  if (!parts.ts || !parts.v1) return false
  const requestId = req.headers.get('x-request-id') ?? ''
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`
  return (await hmacHex(secret, manifest)) === parts.v1
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) return new Response('mp_no_configurado', { status: 503 })

  const url = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const type = body?.type ?? url.searchParams.get('type')
  const dataId = String(body?.data?.id ?? url.searchParams.get('data.id') ?? '')
  // Otros avisos (órdenes de comerciante, etc.) no interesan: se confirman.
  if (type !== 'payment' || !/^\d+$/.test(dataId))
    return new Response('ignorado', { status: 200 })
  if (!(await validSignature(req, dataId)))
    return new Response('firma', { status: 401 })

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return new Response('consulta', { status: 502 })
  const pay = await res.json()
  const orderToken = String(pay.external_reference ?? '')
  if (!/^[0-9a-f]{32}$/.test(orderToken))
    return new Response('sin_pedido', { status: 200 })

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const { error } = await db.rpc('shop_record_mp_payment', {
    p_token: orderToken,
    p_mp_id: String(pay.id),
    p_status: pay.status,
    p_detail: pay.status_detail ?? null,
    p_amount: pay.transaction_amount,
  })
  if (error) return new Response('registro', { status: 500 })
  return new Response('ok', { status: 200 })
})

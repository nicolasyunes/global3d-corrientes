// andreani-quote: cotiza el envío del carrito con Andreani (a domicilio y a
// sucursal) y lista sucursales. La usa el checkout de la tienda, junto con
// correo-cotizar.
//
// POST { action: 'rates', postalCode, items } → las cajas salen del carrito
//   (shop_shipping_boxes, las mismas que usa Correo), se suman en un bulto y la
//   cotización se guarda en shipping_quotes con carrier 'andreani'; devuelve su
//   id para que shop_create_order cobre ese precio.
// POST { action: 'agencies', postalCode } → sucursales de Andreani más
//   cercanas al CP.
//
// Secrets: ANDREANI_USER, ANDREANI_PASSWORD, ANDREANI_CLIENTE,
// ANDREANI_CONTRATO_DOMICILIO y/o ANDREANI_CONTRATO_SUCURSAL, ANDREANI_ENV
// ("prod" usa apis.andreani.com; cualquier otro valor, apisqa). Opcionales:
// ANDREANI_SUCURSAL_ORIGEN (si Andreani lo pide para el contrato) y
// ANDREANI_BASE_URL (otro host). Sin credenciales responde 503 y la tienda
// sigue solo con Correo (o con "a cotizar").

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  AndreaniClient,
  AndreaniError,
  andreaniBase,
  boxesToBulto,
  buildRates,
  InputError,
  normalizePostalCode,
  parseSucursales,
  sortCounts,
  type Box,
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

const env = (k: string) => (Deno.env.get(k) ?? '').trim()

// Token y sucursales se guardan mientras viva la instancia.
const client = new AndreaniClient({
  base: andreaniBase(env('ANDREANI_ENV'), env('ANDREANI_BASE_URL')),
  user: env('ANDREANI_USER'),
  password: env('ANDREANI_PASSWORD'),
})
let sucursalesCache: { at: number; raw: unknown } | null = null
const SUCURSALES_TTL = 6 * 60 * 60 * 1000

/** Valor declarado: lo que vale el carrito según la base (no el navegador). */
async function declaredValue(
  db: ReturnType<typeof createClient>,
  items: { productId?: string; familySlug?: string; quantity: number }[],
): Promise<number> {
  const ids = items.map((i) => i.productId).filter((x): x is string => !!x)
  const slugs = items.map((i) => i.familySlug).filter((x): x is string => !!x)
  const [prods, fams] = await Promise.all([
    ids.length
      ? db.from('products').select('id, base_price').in('id', ids)
      : Promise.resolve({
          data: [] as { id: string; base_price: number | null }[],
        }),
    slugs.length
      ? db.from('shop_families').select('slug, price_from').in('slug', slugs)
      : Promise.resolve({
          data: [] as { slug: string; price_from: number | null }[],
        }),
  ])
  const price = new Map<string, number>()
  for (const p of (prods.data ?? []) as {
    id: string
    base_price: number | null
  }[])
    price.set(p.id, Number(p.base_price) || 0)
  for (const f of (fams.data ?? []) as {
    slug: string
    price_from: number | null
  }[])
    price.set(f.slug, Number(f.price_from) || 0)
  return items.reduce(
    (sum, i) =>
      sum + (price.get(i.productId ?? i.familySlug ?? '') ?? 0) * i.quantity,
    0,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '')

  try {
    if (action === 'agencies') {
      const cp = normalizePostalCode(body?.postalCode)
      if (
        !sucursalesCache ||
        Date.now() - sucursalesCache.at > SUCURSALES_TTL
      ) {
        sucursalesCache = { at: Date.now(), raw: await client.sucursales() }
      }
      return json({ agencies: parseSucursales(sucursalesCache.raw, cp) })
    }

    if (action !== 'rates') return json({ error: 'accion' }, 400)

    const cliente = env('ANDREANI_CLIENTE')
    const contratos = {
      D: env('ANDREANI_CONTRATO_DOMICILIO'),
      S: env('ANDREANI_CONTRATO_SUCURSAL'),
    }
    if (!env('ANDREANI_USER') || !cliente || (!contratos.D && !contratos.S))
      return json({ error: 'andreani_no_configurado' }, 503)

    const postalCode = normalizePostalCode(body?.postalCode)
    if (!postalCode) return json({ error: 'cp' }, 400)
    const items = body?.items
    if (!Array.isArray(items) || items.length < 1 || items.length > 30)
      return json({ error: 'items' }, 400)

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // Freno simple: como mucho 120 cotizaciones por minuto (todas las empresas).
    const { count } = await db
      .from('shipping_quotes')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', new Date(Date.now() - 60_000).toISOString())
    if ((count ?? 0) > 120) return json({ error: 'demasiadas' }, 429)

    const cleanItems = items.map((it: Record<string, unknown>) => ({
      productId: typeof it?.productId === 'string' ? it.productId : undefined,
      familySlug:
        typeof it?.familySlug === 'string' ? it.familySlug : undefined,
      quantity: Math.max(
        1,
        Math.min(500, Math.round(Number(it?.quantity) || 1)),
      ),
    }))
    const { data: c, error } = await db.rpc('shop_shipping_boxes', {
      p_items: cleanItems,
    })
    if (error) throw new Error(error.message)
    const counts = sortCounts((c ?? {}) as Record<string, number>)

    const { data: setting } = await db
      .from('shop_settings')
      .select('value')
      .eq('key', 'correo')
      .maybeSingle()
    const boxes = ((setting?.value as { cajas?: Box[] } | null)?.cajas ??
      []) as Box[]
    const bulto = boxesToBulto(
      counts,
      boxes,
      await declaredValue(db, cleanItems),
    )

    const sucursalOrigen = env('ANDREANI_SUCURSAL_ORIGEN') || undefined
    const quote = async (t: 'S' | 'D') => {
      if (!contratos[t]) return null
      try {
        return await client.tarifa({
          cpDestino: postalCode,
          contrato: contratos[t],
          cliente,
          sucursalOrigen,
          bulto,
        })
      } catch (e) {
        if (e instanceof AndreaniError) {
          console.error(
            'andreani rechazo',
            JSON.stringify({ t, http: e.http, msg: e.message }),
          )
          // Login fallido o Andreani caído: que lo vea el catch de afuera.
          if (e.http === 401 || e.http === 403 || e.http >= 500) throw e
          return null
        }
        throw e
      }
    }
    const [S, D] = await Promise.all([quote('S'), quote('D')])
    const rates = buildRates({ S, D })
    if (!rates.length) return json({ error: 'sin_cotizacion' }, 422)

    // La tarifa de Andreani no trae vencimiento: vale 12 h (lo controla
    // shop_create_order con created_at).
    const { data: q, error: insErr } = await db
      .from('shipping_quotes')
      .insert({
        carrier: 'andreani',
        postal_code: postalCode,
        boxes: counts,
        rates,
        valid_to: null,
      })
      .select('id')
      .single()
    if (insErr) throw new Error(insErr.message)

    return json({
      quoteId: q.id,
      carrier: 'andreani',
      postalCode,
      boxes: counts,
      rates,
    })
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, 400)
    if (e instanceof AndreaniError) {
      return json({ error: 'andreani_caido' }, 502)
    }
    console.error('andreani-quote', e instanceof Error ? e.message : e)
    return json({ error: 'interno' }, 500)
  }
})

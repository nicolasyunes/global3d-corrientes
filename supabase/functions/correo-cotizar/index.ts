// correo-cotizar: cotiza envíos con la API MiCorreo de Correo Argentino y
// lista sucursales. La usan la tienda (checkout) y el admin (Cotizar envío).
//
// POST { action: 'rates', postalCode, items }        → tienda: las cajas salen
//   del carrito (shop_shipping_boxes) y la cotización se guarda en
//   shipping_quotes; devuelve su id para que shop_create_order cobre ese precio.
// POST { action: 'rates', postalCode, packages }     → solo usuarios del admin:
//   medidas libres, no se guarda.
// POST { action: 'agencies', provinceCode, postalCode? } → sucursales.
//
// Secrets: MICORREO_USER, MICORREO_PASSWORD, MICORREO_CUSTOMER_ID y
// MICORREO_ENV ("prod" usa api.correoargentino.com.ar; cualquier otro valor,
// apitest). Sin credenciales responde 503 y la tienda sigue con "a cotizar".

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  boxesToPackages,
  checkPackage,
  InputError,
  normalizePostalCode,
  parseAgencies,
  parseRates,
  PROVINCES,
  sortCounts,
  type Agency,
  type Box,
  type Package,
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

const BASE =
  Deno.env.get('MICORREO_ENV') === 'prod'
    ? 'https://api.correoargentino.com.ar/micorreo/v1'
    : 'https://apitest.correoargentino.com.ar/micorreo/v1'

// Token y sucursales se guardan mientras viva la instancia.
let token: { value: string; until: number } | null = null
const agencyCache = new Map<string, { at: number; list: Agency[] }>()
const AGENCY_TTL = 6 * 60 * 60 * 1000

class CorreoError extends Error {
  constructor(
    public http: number,
    message: string,
  ) {
    super(message)
  }
}

async function getToken(force = false): Promise<string> {
  if (!force && token && token.until > Date.now()) return token.value
  const user = Deno.env.get('MICORREO_USER') ?? ''
  const pass = Deno.env.get('MICORREO_PASSWORD') ?? ''
  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
    signal: AbortSignal.timeout(10000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.token) throw new CorreoError(res.status, 'token')
  // "expires" viene en hora argentina sin zona; si no se entiende, 30 min.
  const exp = Date.parse(String(body.expires ?? '').replace(' ', 'T') + '-03:00')
  const until = Number.isFinite(exp)
    ? Math.min(exp - 60_000, Date.now() + 12 * 60 * 60 * 1000)
    : Date.now() + 30 * 60 * 1000
  token = { value: body.token, until }
  return token.value
}

async function correo(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> },
): Promise<unknown> {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${await getToken(attempt > 0)}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.json().catch(() => null)
    if (res.status === 401 && attempt === 0) continue
    if (!res.ok) {
      console.error(
        'micorreo rechazo',
        JSON.stringify({ path, http: res.status, message: body?.message }),
      )
      throw new CorreoError(res.status, String(body?.message ?? 'error'))
    }
    return body
  }
  throw new CorreoError(401, 'token')
}

interface CorreoSettings {
  cpOrigen?: string
  cajas?: Box[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405)

  const customerId = Deno.env.get('MICORREO_CUSTOMER_ID')
  if (!customerId || !Deno.env.get('MICORREO_USER'))
    return json({ error: 'correo_no_configurado' }, 503)

  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? '')

  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  try {
    if (action === 'agencies') {
      const province = String(body?.provinceCode ?? '').toUpperCase()
      if (!PROVINCES[province]) return json({ error: 'provincia' }, 400)
      const cp = normalizePostalCode(body?.postalCode)
      let cached = agencyCache.get(province)
      if (!cached || Date.now() - cached.at > AGENCY_TTL) {
        const raw = await correo('/agencies', {
          method: 'GET',
          query: { customerId, provinceCode: province },
        })
        cached = { at: Date.now(), list: parseAgencies(raw, null) }
        agencyCache.set(province, cached)
      }
      // Reordenar por cercanía al CP del cliente sin volver a pedirlas.
      const list = cp
        ? [...cached.list].sort(
            (a, b) =>
              Math.abs(Number(a.postalCode || 99999) - Number(cp)) -
                Math.abs(Number(b.postalCode || 99999) - Number(cp)) ||
              a.name.localeCompare(b.name, 'es'),
          )
        : cached.list
      return json({ agencies: list })
    }

    if (action !== 'rates') return json({ error: 'accion' }, 400)

    const postalCode = normalizePostalCode(body?.postalCode)
    if (!postalCode) return json({ error: 'cp' }, 400)

    const { data: setting } = await db
      .from('shop_settings')
      .select('value')
      .eq('key', 'correo')
      .maybeSingle()
    const cfg = (setting?.value ?? {}) as CorreoSettings
    const origin = normalizePostalCode(cfg.cpOrigen) ?? '3400'
    const boxes = cfg.cajas ?? []

    let packages: Package[]
    let counts: Record<string, number> | null = null

    if (Array.isArray(body?.packages)) {
      // Medidas libres: solo para alguien logueado en el admin.
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: auth } = await db.auth.getUser(jwt)
      if (!auth?.user) return json({ error: 'no_autorizado' }, 401)
      if (body.packages.length < 1 || body.packages.length > 10)
        return json({ error: 'medidas' }, 400)
      packages = (body.packages as Package[]).map(checkPackage)
    } else {
      const items = body?.items
      if (!Array.isArray(items) || items.length < 1 || items.length > 30)
        return json({ error: 'items' }, 400)
      // Freno simple: como mucho 120 cotizaciones por minuto en total.
      const { count } = await db
        .from('shipping_quotes')
        .select('id', { count: 'exact', head: true })
        .gt('created_at', new Date(Date.now() - 60_000).toISOString())
      if ((count ?? 0) > 120) return json({ error: 'demasiadas' }, 429)

      const clean = items.map((it: Record<string, unknown>) => ({
        productId: typeof it?.productId === 'string' ? it.productId : undefined,
        familySlug: typeof it?.familySlug === 'string' ? it.familySlug : undefined,
        quantity: Number(it?.quantity) || 1,
      }))
      const { data: c, error } = await db.rpc('shop_shipping_boxes', {
        p_items: clean,
      })
      if (error) throw new Error(error.message)
      counts = sortCounts((c ?? {}) as Record<string, number>)
      packages = boxesToPackages(counts, boxes)
      if (!packages.length) return json({ error: 'items' }, 400)
    }

    const raw = (await correo('/rates/packages', {
      method: 'POST',
      body: {
        customerId,
        postalCodeOrigin: origin,
        postalCodeDestination: postalCode,
        deliveredType: null,
        dimensions: packages,
      },
    })) as { validTo?: string } | null
    const rates = parseRates(raw)
    if (!rates.length) return json({ error: 'sin_cotizacion' }, 422)
    const validTo = raw?.validTo && Number.isFinite(Date.parse(raw.validTo))
      ? new Date(raw.validTo).toISOString()
      : null

    let quoteId: string | null = null
    if (counts) {
      const { data: q, error } = await db
        .from('shipping_quotes')
        .insert({ postal_code: postalCode, boxes: counts, rates, valid_to: validTo })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      quoteId = q.id
      // De vez en cuando, borrar cotizaciones viejas.
      if (Math.random() < 0.05)
        await db
          .from('shipping_quotes')
          .delete()
          .lt('created_at', new Date(Date.now() - 3 * 86400_000).toISOString())
    }

    return json({ quoteId, postalCode, boxes: counts, rates, validTo })
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, 400)
    if (e instanceof CorreoError) {
      // 4xx de Correo suele ser un CP inexistente o medidas fuera de rango.
      const status = e.http >= 400 && e.http < 500 && e.http !== 401 ? 422 : 502
      return json({ error: status === 422 ? 'sin_cotizacion' : 'correo_caido' }, status)
    }
    console.error('correo-cotizar', e instanceof Error ? e.message : e)
    return json({ error: 'interno' }, 500)
  }
})

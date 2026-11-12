// Lógica de andreani-quote sin Deno, para testearla con vitest: arma el bulto
// con las cajas del carrito, habla con la API de Andreani (login + Cotizador)
// con un fetch inyectable y limpia las respuestas.
//
// API (confirmada en el plugin oficial de Andreani para Magento):
// * GET {base}/login con Basic Auth → el token viene en el header de respuesta
//   x-authorization-token y dura 24 h.
// * GET {base}/v1/tarifas?cpDestino&contrato&cliente&sucursalOrigen
//   &bultos[0][kilos]&bultos[0][volumen]&bultos[0][valorDeclarado]
//   con header x-authorization-token → precio en tarifaConIva.total.
// * GET {base}/v2/sucursales?canal=B2C&seHaceAtencionAlCliente=true (pública).

export interface Box {
  key: string
  label: string
  /** gramos */
  weight: number
  /** cm */
  height: number
  width: number
  length: number
}

/** Misma forma que las tarifas de correo-cotizar (las lee shop_create_order). */
export interface Rate {
  deliveredType: 'S' | 'D'
  productType: string
  productName: string
  price: number
  deliveryTimeMin: string | null
  deliveryTimeMax: string | null
}

export interface Agency {
  code: string
  name: string
  address: string
  city: string
  postalCode: string
  hours: string | null
}

export interface Bulto {
  /** kg */
  kilos: number
  /** cm³ */
  volumen: number
  /** pesos */
  valorDeclarado: number
}

/** productType de Andreani en shipping_quotes.rates (dos letras). */
export const ANDREANI_PRODUCT = 'AN'

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/** Error de datos con un código que la tienda traduce. */
export class InputError extends Error {}

/** Error de la API de Andreani con su status HTTP. */
export class AndreaniError extends Error {
  constructor(
    public http: number,
    message: string,
  ) {
    super(message)
  }
}

/** "3400", "W3400", "W3400ABC" → "3400"; null si no es un CP. */
export function normalizePostalCode(raw: unknown): string | null {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
  const m = /^[A-Z]?(\d{4})[A-Z]{0,3}$/.exec(s)
  if (!m || m[1] === '0000') return null
  return m[1]
}

/**
 * Base de la API según ANDREANI_ENV ("prod" o cualquier otra cosa = QA).
 * ANDREANI_BASE_URL la pisa, por si Andreani le da al cliente otro host.
 */
export function andreaniBase(
  env: string | undefined,
  override?: string,
): string {
  const o = (override ?? '').trim().replace(/\/+$/, '')
  if (o) return o
  return env === 'prod'
    ? 'https://apis.andreani.com'
    : 'https://apisqa.andreani.com'
}

/** Límite simple por bulto; más que esto se cotiza a mano por WhatsApp. */
const MAX_KG = 50
const MAX_CM3 = 200 * 200 * 200

/**
 * {"chica": 2, "grande": 1} + cajas configuradas → un bulto con el peso y el
 * volumen sumados (como hace el plugin oficial). Una caja desconocida cuenta
 * como la primera.
 */
export function boxesToBulto(
  counts: Record<string, number>,
  boxes: Box[],
  declaredValue: number,
): Bulto {
  let grams = 0
  let cm3 = 0
  for (const [key, n] of Object.entries(counts)) {
    const box = boxes.find((b) => b.key === key) ?? boxes[0]
    if (!box || !(n > 0)) continue
    grams += n * Number(box.weight)
    cm3 += n * Number(box.height) * Number(box.width) * Number(box.length)
  }
  if (!(grams > 0) || !(cm3 > 0)) throw new InputError('items')
  const kilos = Math.round(grams / 10) / 100
  if (kilos > MAX_KG) throw new InputError('peso')
  if (cm3 > MAX_CM3) throw new InputError('medidas')
  return {
    kilos: Math.max(0.01, kilos),
    volumen: Math.round(cm3),
    valorDeclarado: Math.max(0, Math.round(Number(declaredValue) || 0)),
  }
}

export interface TarifaParams {
  cpDestino: string
  contrato: string
  cliente: string
  sucursalOrigen?: string
  bulto: Bulto
}

/** Query de /v1/tarifas con el formato bultos[0][campo] que usa Andreani. */
export function tarifasQuery(p: TarifaParams): URLSearchParams {
  const q = new URLSearchParams()
  q.set('cpDestino', p.cpDestino)
  q.set('contrato', p.contrato)
  q.set('cliente', p.cliente)
  if (p.sucursalOrigen) q.set('sucursalOrigen', p.sucursalOrigen)
  q.set('bultos[0][valorDeclarado]', String(p.bulto.valorDeclarado))
  q.set('bultos[0][volumen]', String(p.bulto.volumen))
  q.set('bultos[0][kilos]', String(p.bulto.kilos))
  return q
}

/** Precio final (con IVA) de la respuesta de /v1/tarifas; null si no vino. */
export function parseTarifa(body: unknown): number | null {
  const t = (body as { tarifaConIva?: { total?: unknown } } | null)
    ?.tarifaConIva
  const n = Number(t?.total)
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
}

/** Tarifas en el formato de shipping_quotes: sucursal primero. */
export function buildRates(prices: {
  S?: number | null
  D?: number | null
}): Rate[] {
  const out: Rate[] = []
  for (const t of ['S', 'D'] as const) {
    const price = prices[t]
    if (price == null || !(price > 0)) continue
    out.push({
      deliveredType: t,
      productType: ANDREANI_PRODUCT,
      productName: 'Andreani',
      price: Math.ceil(price),
      deliveryTimeMin: null,
      deliveryTimeMax: null,
    })
  }
  return out
}

function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function title(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
}

/**
 * Limpia /v2/sucursales: solo las que tienen id y CP, ordenadas por cercanía
 * de código postal al del cliente. Devuelve como mucho `limit`.
 */
export function parseSucursales(
  body: unknown,
  postalCode: string | null,
  limit = 40,
): Agency[] {
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { sucursales?: unknown[] } | null)?.sucursales)
      ? (body as { sucursales: unknown[] }).sucursales
      : []
  const out: (Agency & { dist: number })[] = []
  for (const s of list as Record<string, unknown>[]) {
    const code = clean(s.id ?? s.codigo).toUpperCase()
    if (!/^[A-Z0-9]{1,12}$/.test(code)) continue
    const d = (s.direccion ?? {}) as Record<string, unknown>
    const cp = normalizePostalCode(d.codigoPostal) ?? ''
    if (!cp) continue
    const street = [clean(d.calle), clean(d.numero)].filter(Boolean).join(' ')
    const hours = clean(s.horarioDeAtencion)
    out.push({
      code,
      name: title(clean(s.descripcion) || `Sucursal ${code}`),
      address: title(street),
      city: title(clean(d.localidad)),
      postalCode: cp,
      hours: hours || null,
      dist: postalCode ? Math.abs(Number(cp) - Number(postalCode)) : 0,
    })
  }
  out.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, 'es'))
  return out.slice(0, limit).map((a) => ({
    code: a.code,
    name: a.name,
    address: a.address,
    city: a.city,
    postalCode: a.postalCode,
    hours: a.hours,
  }))
}

/** El token dura 24 h; lo renovamos una hora antes. */
const TOKEN_TTL = 23 * 60 * 60 * 1000

/** Cliente de la API de Andreani con el token en memoria. */
export class AndreaniClient {
  private token: { value: string; until: number } | null = null

  constructor(
    private opts: {
      base: string
      user: string
      password: string
      fetch?: Fetch
      now?: () => number
    },
  ) {}

  private get f(): Fetch {
    return this.opts.fetch ?? ((u, i) => fetch(u, i))
  }

  private now(): number {
    return (this.opts.now ?? Date.now)()
  }

  async login(force = false): Promise<string> {
    if (!force && this.token && this.token.until > this.now())
      return this.token.value
    const res = await this.f(`${this.opts.base}/login`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${btoa(`${this.opts.user}:${this.opts.password}`)}`,
      },
      signal: AbortSignal.timeout(10000),
    })
    const value = res.headers.get('x-authorization-token')?.trim()
    // Algunas versiones devuelven el token también en el cuerpo.
    const body = value ? null : await res.json().catch(() => null)
    const tok = value || (typeof body?.token === 'string' ? body.token : '')
    if (!res.ok || !tok) {
      this.token = null
      throw new AndreaniError(res.status || 502, 'login')
    }
    this.token = { value: tok, until: this.now() + TOKEN_TTL }
    return tok
  }

  /** Cotiza un bulto; reintenta una vez con token nuevo si da 401. */
  async tarifa(p: TarifaParams): Promise<number | null> {
    const url = `${this.opts.base}/v1/tarifas?${tarifasQuery(p).toString()}`
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.f(url, {
        method: 'GET',
        headers: { 'x-authorization-token': await this.login(attempt > 0) },
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.json().catch(() => null)
      if ((res.status === 401 || res.status === 403) && attempt === 0) continue
      if (!res.ok) {
        throw new AndreaniError(
          res.status,
          String(body?.detail ?? body?.title ?? body?.message ?? 'error'),
        )
      }
      return parseTarifa(body)
    }
    throw new AndreaniError(401, 'login')
  }

  /** Sucursales B2C con atención al público (no pide token). */
  async sucursales(): Promise<unknown> {
    const res = await this.f(
      `${this.opts.base}/v2/sucursales?canal=B2C&seHaceAtencionAlCliente=true`,
      { method: 'GET', signal: AbortSignal.timeout(15000) },
    )
    if (!res.ok) throw new AndreaniError(res.status, 'sucursales')
    return res.json()
  }
}

/** {"chica": 2} ordenado, para que coincida con shop_shipping_boxes. */
export function sortCounts(c: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(c)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

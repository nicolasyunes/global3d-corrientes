// Lógica de correo-envio sin Deno, para testearla con vitest: cliente de la
// API MiCorreo (token + /shipping/import + /shipping/tracking +
// /rates/calculate) con fetch inyectable, y armado/limpieza de datos.
//
// Según la doc de MiCorreo (2026-05-18):
// * POST /token con Basic Auth → { token, expires }.
// * POST /shipping/import → 200 { createdAt } o 402 { message }. No devuelve
//   número de seguimiento: aparece en MiCorreo al generar la etiqueta.
// * GET /shipping/tracking { shippingId } → [{ trackingNumber, events: [...] }]
//   o { error, code } si no existe.
// * POST /rates/calculate { orders: [{ id, dimensions: [...] }] } → apila los
//   paquetes en uno solo lógico.

import {
  normalizePostalCode,
  PROVINCES,
  type Box,
} from '../correo-cotizar/lib.ts'

export { normalizePostalCode }

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/** Error de datos con un código que el admin traduce. */
export class InputError extends Error {}

export class MiCorreoError extends Error {
  constructor(
    public http: number,
    message: string,
  ) {
    super(message)
  }
}

/** Datos del destinatario (los guarda la tienda o los completa el admin). */
export interface Recipient {
  name: string
  email: string
  phone?: string
  street?: string
  number?: string
  floor?: string
  apartment?: string
  city?: string
  province?: string
  postalCode: string
}

export interface Parcel {
  /** gramos */
  weight: number
  /** cm */
  height: number
  width: number
  length: number
}

export interface ImportInput {
  customerId: string
  extOrderId: string
  orderNumber: string
  deliveryType: 'S' | 'D'
  productType: string
  agency?: string | null
  recipient: Recipient
  parcel: Parcel
  declaredValue: number
}

const clip = (s: unknown, n: number) =>
  String(s ?? '')
    .trim()
    .slice(0, n)

/**
 * Combina lo que guardó la tienda con lo que corrigió el admin (lo del admin
 * gana si viene con texto) y valida lo que exige MiCorreo.
 */
export function checkRecipient(
  saved: Partial<Recipient>,
  edits: Partial<Recipient> | null | undefined,
  deliveryType: 'S' | 'D',
): Recipient {
  const pick = (k: keyof Recipient) => {
    const e = edits?.[k]
    return typeof e === 'string' && e.trim() ? e : saved[k]
  }
  const r: Recipient = {
    name: clip(pick('name'), 80),
    email: clip(pick('email'), 120).toLowerCase(),
    phone: clip(pick('phone'), 20).replace(/\D/g, ''),
    street: clip(pick('street'), 80),
    number: clip(pick('number'), 10),
    floor: clip(pick('floor'), 3),
    apartment: clip(pick('apartment'), 3),
    city: clip(pick('city'), 60),
    province: clip(pick('province'), 1).toUpperCase(),
    postalCode: normalizePostalCode(pick('postalCode')) ?? '',
  }
  if (r.name.length < 2) throw new InputError('nombre')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) throw new InputError('email')
  if (!r.postalCode) throw new InputError('cp')
  if (deliveryType === 'D') {
    if (r.street!.length < 2 || !r.number || r.city!.length < 2)
      throw new InputError('direccion')
    if (!PROVINCES[r.province!]) throw new InputError('provincia')
  }
  return r
}

/** Paquete de respaldo si /rates/calculate no responde: suma pesos, caja más grande. */
export function fallbackParcel(
  counts: Record<string, number>,
  boxes: Box[],
): Parcel {
  let weight = 0
  let big: Box | null = null
  const vol = (b: Box) => b.height * b.width * b.length
  for (const [key, n] of Object.entries(counts)) {
    const box = boxes.find((b) => b.key === key) ?? boxes[0]
    if (!box || !(n > 0)) continue
    weight += n * box.weight
    if (!big || vol(box) > vol(big)) big = box
  }
  if (!big || !(weight > 0)) throw new InputError('cajas')
  return {
    weight: Math.round(weight),
    height: Math.round(big.height),
    width: Math.round(big.width),
    length: Math.round(big.length),
  }
}

/** {"chica": 2} + cajas → dimensions de /rates/calculate. */
export function calculateBody(
  id: number,
  counts: Record<string, number>,
  boxes: Box[],
) {
  const dimensions = []
  for (const [key, n] of Object.entries(counts)) {
    const box = boxes.find((b) => b.key === key) ?? boxes[0]
    if (!box || !(n > 0)) continue
    dimensions.push({
      quantity: n,
      weight: Math.round(box.weight),
      height: Math.round(box.height),
      width: Math.round(box.width),
      length: Math.round(box.length),
    })
  }
  return { orders: [{ id, dimensions }] }
}

/** Respuesta de /rates/calculate → paquete; null si no sirve. */
export function parseCalculate(body: unknown): Parcel | null {
  const d = (Array.isArray(body) ? body[0] : null)?.dimensions as
    Record<string, unknown> | undefined
  if (!d) return null
  const p = {
    weight: Math.round(Number(d.weight)),
    height: Math.ceil(Number(d.height)),
    width: Math.ceil(Number(d.width)),
    length: Math.ceil(Number(d.length)),
  }
  return Object.values(p).every((n) => Number.isFinite(n) && n > 0) ? p : null
}

/** Body de /shipping/import. */
export function buildImport(i: ImportInput) {
  const r = i.recipient
  const home = i.deliveryType === 'D'
  return {
    customerId: i.customerId,
    extOrderId: i.extOrderId,
    orderNumber: i.orderNumber,
    // El remitente sale de la cuenta de MiCorreo.
    sender: {
      name: null,
      phone: null,
      cellPhone: null,
      email: null,
      originAddress: {
        streetName: null,
        streetNumber: null,
        floor: null,
        apartment: null,
        city: null,
        provinceCode: null,
        postalCode: null,
      },
    },
    recipient: {
      name: r.name,
      phone: '',
      cellPhone: r.phone ?? '',
      email: r.email,
    },
    shipping: {
      deliveryType: i.deliveryType,
      productType: /^[A-Z]{2}$/.test(i.productType) ? i.productType : 'CP',
      agency: home ? null : (i.agency ?? null),
      address: {
        streetName: home ? r.street : '',
        streetNumber: home ? r.number : '',
        floor: home ? (r.floor ?? '') : '',
        apartment: home ? (r.apartment ?? '') : '',
        city: home ? r.city : '',
        provinceCode: home ? r.province : '',
        postalCode: r.postalCode,
      },
      weight: i.parcel.weight,
      declaredValue: Math.max(1, Math.round(i.declaredValue * 100) / 100),
      height: i.parcel.height,
      length: i.parcel.length,
      width: i.parcel.width,
    },
  }
}

export interface TrackingEvent {
  event: string
  date: string
  branch: string
  status: string
}

/** Respuesta de /shipping/tracking → eventos, el más nuevo primero. */
export function parseTracking(body: unknown): {
  found: boolean
  events: TrackingEvent[]
} {
  if (!Array.isArray(body)) return { found: false, events: [] }
  const events: TrackingEvent[] = []
  for (const item of body as Record<string, unknown>[]) {
    for (const e of (item?.events as Record<string, unknown>[] | undefined) ??
      []) {
      events.push({
        event: clip(e.event, 80),
        date: clip(e.date, 20),
        branch: clip(e.branch, 80),
        status: clip(e.status, 80),
      })
    }
  }
  // "dd-mm-aaaa hh:mm" → ordenable
  const key = (d: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/.exec(d)
    return m ? `${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}` : ''
  }
  events.sort((a, b) => key(b.date).localeCompare(key(a.date)))
  return { found: true, events }
}

/** Número de seguimiento: letras y números, sin espacios. */
export function normalizeTracking(raw: unknown): string | null {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
  return /^[A-Z0-9]{8,40}$/.test(s) ? s : null
}

/** Cliente MiCorreo con el token en memoria y un reintento si vence. */
export class MiCorreoClient {
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

  private now() {
    return (this.opts.now ?? Date.now)()
  }

  async getToken(force = false): Promise<string> {
    if (!force && this.token && this.token.until > this.now())
      return this.token.value
    const res = await this.f(`${this.opts.base}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.opts.user}:${this.opts.password}`)}`,
      },
      signal: AbortSignal.timeout(10000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.token)
      throw new MiCorreoError(res.status || 502, 'token')
    // "expires" viene en hora argentina sin zona; si no se entiende, 30 min.
    const exp = Date.parse(
      String(body.expires ?? '').replace(' ', 'T') + '-03:00',
    )
    const until = Number.isFinite(exp)
      ? Math.min(exp - 60_000, this.now() + 12 * 60 * 60 * 1000)
      : this.now() + 30 * 60 * 1000
    this.token = { value: body.token, until }
    return body.token
  }

  async call(
    path: string,
    init: {
      method: 'GET' | 'POST'
      body?: unknown
      query?: Record<string, string>
    },
  ): Promise<unknown> {
    const url = new URL(this.opts.base + path)
    for (const [k, v] of Object.entries(init.query ?? {}))
      url.searchParams.set(k, v)
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.f(url.toString(), {
        method: init.method,
        headers: {
          Authorization: `Bearer ${await this.getToken(attempt > 0)}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(20000),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 401 && attempt === 0) continue
      if (!res.ok) {
        throw new MiCorreoError(
          res.status,
          String(body?.message ?? body?.error ?? 'error'),
        )
      }
      return body
    }
    throw new MiCorreoError(401, 'token')
  }

  /** Importa el envío. "Ya fue importada" cuenta como éxito. */
  async importShipping(
    body: unknown,
  ): Promise<{ createdAt: string | null; already: boolean }> {
    try {
      const res = (await this.call('/shipping/import', {
        method: 'POST',
        body,
      })) as {
        createdAt?: string
      } | null
      return { createdAt: res?.createdAt ?? null, already: false }
    } catch (e) {
      if (e instanceof MiCorreoError && /ya fue importada/i.test(e.message))
        return { createdAt: null, already: true }
      throw e
    }
  }

  /**
   * Seguimiento. La doc lo muestra como GET con cuerpo JSON, que fetch no
   * permite: se manda como query (?shippingId=). Confirmar en el ambiente de
   * test de MiCorreo.
   */
  tracking(shippingId: string): Promise<unknown> {
    return this.call('/shipping/tracking', {
      method: 'GET',
      query: { shippingId },
    })
  }

  async calculate(body: unknown): Promise<Parcel | null> {
    return parseCalculate(
      await this.call('/rates/calculate', { method: 'POST', body }),
    )
  }
}

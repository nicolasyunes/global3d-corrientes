import { describe, expect, it, vi } from 'vitest'
import type { Box } from '../correo-cotizar/lib.ts'
import {
  buildImport,
  calculateBody,
  checkRecipient,
  fallbackParcel,
  MiCorreoClient,
  normalizeTracking,
  parseCalculate,
  parseTracking,
} from './lib.ts'

const BOXES: Box[] = [
  {
    key: 'chica',
    label: 'Chica',
    weight: 500,
    height: 10,
    width: 15,
    length: 20,
  },
  {
    key: 'grande',
    label: 'Grande',
    weight: 4000,
    height: 30,
    width: 30,
    length: 40,
  },
]

const SAVED = {
  name: 'Ana Gómez',
  phone: '379 412-3456',
  postalCode: '1842',
  email: 'ana@mail.com',
  province: 'B',
  street: 'Vicente Lopez',
  number: '448',
  city: 'Monte Grande',
}

describe('destinatario', () => {
  it('usa lo guardado y lo que corrige el admin gana', () => {
    const r = checkRecipient(SAVED, { email: 'Otra@Mail.com', floor: '1' }, 'D')
    expect(r).toMatchObject({
      name: 'Ana Gómez',
      email: 'otra@mail.com',
      phone: '3794123456',
      floor: '1',
      postalCode: '1842',
      province: 'B',
    })
  })
  it('un campo vacío del admin no borra lo guardado', () => {
    expect(checkRecipient(SAVED, { email: '  ' }, 'D').email).toBe(
      'ana@mail.com',
    )
  })
  it('a domicilio exige calle, número, ciudad y provincia', () => {
    expect(() => checkRecipient({ ...SAVED, street: '' }, null, 'D')).toThrow(
      'direccion',
    )
    expect(() =>
      checkRecipient({ ...SAVED, province: 'I' }, null, 'D'),
    ).toThrow('provincia')
    // A sucursal alcanza con nombre, email y CP.
    expect(
      checkRecipient(
        { name: 'Ana', email: 'a@b.co', postalCode: '1842' },
        null,
        'S',
      ).name,
    ).toBe('Ana')
  })
  it('sin email no se puede importar', () => {
    expect(() =>
      checkRecipient({ ...SAVED, email: undefined }, null, 'S'),
    ).toThrow('email')
  })
})

describe('paquete', () => {
  it('respaldo: suma pesos y usa la caja más grande', () => {
    expect(fallbackParcel({ chica: 2, grande: 1 }, BOXES)).toEqual({
      weight: 5000,
      height: 30,
      width: 30,
      length: 40,
    })
  })
  it('arma el pedido de apilamiento y lee la respuesta', () => {
    expect(calculateBody(7, { chica: 2 }, BOXES)).toEqual({
      orders: [
        {
          id: 7,
          dimensions: [
            { quantity: 2, weight: 500, height: 10, width: 15, length: 20 },
          ],
        },
      ],
    })
    expect(
      parseCalculate([
        {
          id: 7,
          dimensions: {
            quantity: 0,
            weight: 1000.0,
            height: 20.0,
            width: 15.0,
            length: 20.4,
          },
        },
      ]),
    ).toEqual({ weight: 1000, height: 20, width: 15, length: 21 })
    expect(parseCalculate({ code: 401 })).toBeNull()
  })
})

describe('import', () => {
  const base = {
    customerId: '0005000033',
    extOrderId: 'G3D-ABC123',
    orderNumber: 'ABC123',
    productType: 'CP',
    parcel: { weight: 1000, height: 20, width: 20, length: 40 },
    declaredValue: 15000,
  }
  it('a domicilio manda la dirección y sin sucursal', () => {
    const b = buildImport({
      ...base,
      deliveryType: 'D',
      agency: 'B0107',
      recipient: checkRecipient(SAVED, null, 'D'),
    })
    expect(b.shipping).toMatchObject({
      deliveryType: 'D',
      agency: null,
      productType: 'CP',
      address: {
        streetName: 'Vicente Lopez',
        streetNumber: '448',
        city: 'Monte Grande',
        provinceCode: 'B',
        postalCode: '1842',
      },
      weight: 1000,
      declaredValue: 15000,
    })
    expect(b.recipient).toEqual({
      name: 'Ana Gómez',
      phone: '',
      cellPhone: '3794123456',
      email: 'ana@mail.com',
    })
    expect(b.sender.name).toBeNull()
  })
  it('a sucursal manda el código de sucursal', () => {
    const b = buildImport({
      ...base,
      deliveryType: 'S',
      agency: 'B0107',
      recipient: checkRecipient(SAVED, null, 'S'),
    })
    expect(b.shipping.agency).toBe('B0107')
    expect(b.shipping.address.streetName).toBe('')
  })
})

describe('seguimiento', () => {
  it('ordena los eventos del más nuevo al más viejo', () => {
    const { found, events } = parseTracking([
      {
        id: '1',
        trackingNumber: '000500076393019A3G0C701',
        events: [
          {
            event: 'PREIMPOSICION',
            date: '28-08-2024 10:33',
            branch: 'CORREO ARGENTINO',
            status: '',
            sign: '',
          },
          {
            event: 'EN CAMINO',
            date: '02-09-2024 08:00',
            branch: 'CORRIENTES',
            status: '',
            sign: '',
          },
        ],
      },
    ])
    expect(found).toBe(true)
    expect(events.map((e) => e.event)).toEqual(['EN CAMINO', 'PREIMPOSICION'])
  })
  it('pedido inexistente → sin eventos', () => {
    expect(
      parseTracking({ error: 'No existe el cliente o pedido', code: '0' }),
    ).toEqual({ found: false, events: [] })
  })
  it('limpia el número', () => {
    expect(normalizeTracking(' 000500076393019a3g0c701 ')).toBe(
      '000500076393019A3G0C701',
    )
    expect(normalizeTracking('12')).toBeNull()
  })
})

/** MiCorreo simulado. */
function fakeCorreo(
  opts: { importError?: string; expireFirst?: boolean } = {},
) {
  let expired = !!opts.expireFirst
  const calls: string[] = []
  const bodies: unknown[] = []
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    calls.push(`${init?.method} ${u.pathname}${u.search}`)
    if (u.pathname.endsWith('/token'))
      return new Response(
        JSON.stringify({ token: 'jwt', expires: '2099-01-01 00:00:00' }),
      )
    if (new Headers(init?.headers).get('Authorization') !== 'Bearer jwt')
      return new Response('{}', { status: 401 })
    if (expired) {
      expired = false
      return new Response('{"code":"401"}', { status: 401 })
    }
    if (init?.body) bodies.push(JSON.parse(String(init.body)))
    if (u.pathname.endsWith('/shipping/import')) {
      if (opts.importError)
        return new Response(
          JSON.stringify({ code: '402', message: opts.importError }),
          { status: 402 },
        )
      return new Response(
        JSON.stringify({ createdAt: '2026-11-12T16:15:04.996-03:00' }),
      )
    }
    if (u.pathname.endsWith('/shipping/tracking'))
      return new Response(
        JSON.stringify([
          { trackingNumber: u.searchParams.get('shippingId'), events: [] },
        ]),
      )
    if (u.pathname.endsWith('/rates/calculate'))
      return new Response(
        JSON.stringify([
          {
            id: 1,
            dimensions: { weight: 1000, height: 20, width: 15, length: 20 },
          },
        ]),
      )
    return new Response('{}', { status: 404 })
  })
  const client = new MiCorreoClient({
    base: 'https://apitest.test/micorreo/v1',
    user: 'u',
    password: 'p',
    fetch: fetchFn,
  })
  return { client, calls, bodies }
}

describe('MiCorreoClient (API simulada)', () => {
  it('saca el token una vez e importa', async () => {
    const { client, calls, bodies } = fakeCorreo()
    expect(await client.importShipping({ a: 1 })).toEqual({
      createdAt: '2026-11-12T16:15:04.996-03:00',
      already: false,
    })
    await client.calculate(calculateBody(1, { chica: 2 }, BOXES))
    expect(calls).toEqual([
      'POST /micorreo/v1/token',
      'POST /micorreo/v1/shipping/import',
      'POST /micorreo/v1/rates/calculate',
    ])
    expect(bodies[0]).toEqual({ a: 1 })
  })
  it('si el token venció, lo renueva y reintenta', async () => {
    const { client, calls } = fakeCorreo({ expireFirst: true })
    await client.importShipping({})
    expect(calls.filter((c) => c.endsWith('/token'))).toHaveLength(2)
  })
  it('"ya fue importada" cuenta como importado', async () => {
    const { client } = fakeCorreo({
      importError: 'La orden ya fue importada con anterioridad.',
    })
    expect(await client.importShipping({})).toEqual({
      createdAt: null,
      already: true,
    })
  })
  it('otro error de MiCorreo se propaga con su mensaje', async () => {
    const { client } = fakeCorreo({
      importError: 'Verifique la sucursal de destino',
    })
    await expect(client.importShipping({})).rejects.toMatchObject({
      http: 402,
      message: 'Verifique la sucursal de destino',
    })
  })
  it('el seguimiento va con shippingId en la query', async () => {
    const { client, calls } = fakeCorreo()
    await client.tracking('000500076393019A3G0C701')
    expect(calls.at(-1)).toBe(
      'GET /micorreo/v1/shipping/tracking?shippingId=000500076393019A3G0C701',
    )
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  AndreaniClient,
  AndreaniError,
  andreaniBase,
  boxesToBulto,
  buildRates,
  parseSucursales,
  parseTarifa,
  tarifasQuery,
  type Box,
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

const BULTO = { kilos: 5, volumen: 42000, valorDeclarado: 30000 }

describe('base de la API', () => {
  it('QA salvo que ANDREANI_ENV sea prod, y se puede pisar', () => {
    expect(andreaniBase(undefined)).toBe('https://apisqa.andreani.com')
    expect(andreaniBase('prod')).toBe('https://apis.andreani.com')
    expect(andreaniBase('prod', 'https://api.andreani.com/')).toBe(
      'https://api.andreani.com',
    )
  })
})

describe('bulto', () => {
  it('suma peso (kg) y volumen (cm³) de todas las cajas', () => {
    expect(boxesToBulto({ chica: 2, grande: 1 }, BOXES, 30000.4)).toEqual({
      kilos: 5,
      volumen: 2 * 3000 + 36000,
      valorDeclarado: 30000,
    })
  })
  it('una caja desconocida usa la primera', () => {
    expect(boxesToBulto({ vieja: 1 }, BOXES, 0).kilos).toBe(0.5)
  })
  it('sin cajas o demasiado pesado no cotiza', () => {
    expect(() => boxesToBulto({}, BOXES, 0)).toThrow('items')
    expect(() => boxesToBulto({ grande: 13 }, BOXES, 0)).toThrow('peso')
  })
})

describe('query del Cotizador', () => {
  it('usa los nombres de Andreani y bultos[0][...]', () => {
    const q = tarifasQuery({
      cpDestino: '1842',
      contrato: 'C-DOM',
      cliente: 'CL-1',
      sucursalOrigen: '15',
      bulto: BULTO,
    })
    expect(Object.fromEntries(q)).toEqual({
      cpDestino: '1842',
      contrato: 'C-DOM',
      cliente: 'CL-1',
      sucursalOrigen: '15',
      'bultos[0][valorDeclarado]': '30000',
      'bultos[0][volumen]': '42000',
      'bultos[0][kilos]': '5',
    })
  })
  it('sin sucursal de origen no la manda', () => {
    const q = tarifasQuery({
      cpDestino: '1842',
      contrato: 'C',
      cliente: 'X',
      bulto: BULTO,
    })
    expect(q.has('sucursalOrigen')).toBe(false)
  })
})

describe('respuestas', () => {
  it('toma tarifaConIva.total redondeado para arriba', () => {
    expect(
      parseTarifa({
        tarifaSinIva: { total: '100' },
        tarifaConIva: { total: '7890.12' },
      }),
    ).toBe(7891)
    expect(parseTarifa({ tarifaConIva: {} })).toBeNull()
    expect(parseTarifa(null)).toBeNull()
  })
  it('arma las tarifas con la forma de shipping_quotes, sucursal primero', () => {
    expect(buildRates({ D: 9000, S: 6500.5 })).toEqual([
      {
        deliveredType: 'S',
        productType: 'AN',
        productName: 'Andreani',
        price: 6501,
        deliveryTimeMin: null,
        deliveryTimeMax: null,
      },
      {
        deliveredType: 'D',
        productType: 'AN',
        productName: 'Andreani',
        price: 9000,
        deliveryTimeMin: null,
        deliveryTimeMax: null,
      },
    ])
    expect(buildRates({ S: null, D: 0 })).toEqual([])
  })
  it('sucursales: ordena por cercanía de CP y limpia nombres', () => {
    const list = parseSucursales(
      [
        {
          id: 'X1',
          descripcion: 'CORRIENTES CENTRO',
          direccion: {
            calle: 'SAN JUAN',
            numero: '1234',
            codigoPostal: '3400',
            localidad: 'CORRIENTES',
          },
          horarioDeAtencion: 'Lun a Vie 8 a 18',
        },
        {
          id: 'X2',
          descripcion: 'RESISTENCIA',
          direccion: {
            calle: 'Av. Sarmiento',
            numero: '50',
            codigoPostal: '3500',
            localidad: 'Resistencia',
          },
        },
        { id: '', descripcion: 'Sin id', direccion: { codigoPostal: '3400' } },
        { id: 'X3', descripcion: 'Sin CP', direccion: {} },
      ],
      '3503',
    )
    expect(list.map((a) => a.code)).toEqual(['X2', 'X1'])
    expect(list[1]).toEqual({
      code: 'X1',
      name: 'Corrientes Centro',
      address: 'San Juan 1234',
      city: 'Corrientes',
      postalCode: '3400',
      hours: 'Lun a Vie 8 a 18',
    })
  })
})

/** fetch simulado: login devuelve el token en el header, tarifas cobra según contrato. */
function fakeAndreani(
  opts: { expireFirst?: boolean; loginFails?: boolean } = {},
) {
  let tokenN = 0
  let expired = !!opts.expireFirst
  const calls: string[] = []
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    const h = new Headers(init?.headers)
    calls.push(u.pathname)
    if (u.pathname === '/login') {
      if (
        opts.loginFails ||
        h.get('Authorization') !== `Basic ${btoa('user:pass')}`
      )
        return new Response('{}', { status: 401 })
      tokenN++
      return new Response('{}', {
        headers: { 'x-authorization-token': `tok${tokenN}` },
      })
    }
    if (u.pathname === '/v1/tarifas') {
      if (!h.get('x-authorization-token'))
        return new Response('{}', { status: 401 })
      if (expired) {
        expired = false
        return new Response('{}', { status: 401 })
      }
      if (u.searchParams.get('cpDestino') === '9999')
        return new Response(JSON.stringify({ detail: 'CP inexistente' }), {
          status: 400,
        })
      const total =
        u.searchParams.get('contrato') === 'SUC' ? '6500.10' : '9100'
      return new Response(JSON.stringify({ tarifaConIva: { total } }))
    }
    return new Response('{}', { status: 404 })
  })
  return { fetchFn, calls }
}

describe('AndreaniClient (API simulada)', () => {
  const params = (contrato: string, cp = '1842') => ({
    cpDestino: cp,
    contrato,
    cliente: 'CL',
    bulto: BULTO,
  })

  it('hace login una vez y reusa el token', async () => {
    const { fetchFn, calls } = fakeAndreani()
    const c = new AndreaniClient({
      base: 'https://qa.test',
      user: 'user',
      password: 'pass',
      fetch: fetchFn,
    })
    expect(await c.tarifa(params('SUC'))).toBe(6501)
    expect(await c.tarifa(params('DOM'))).toBe(9100)
    expect(calls).toEqual(['/login', '/v1/tarifas', '/v1/tarifas'])
  })

  it('renueva el token pasadas 23 h', async () => {
    const { fetchFn, calls } = fakeAndreani()
    let now = 0
    const c = new AndreaniClient({
      base: 'https://qa.test',
      user: 'user',
      password: 'pass',
      fetch: fetchFn,
      now: () => now,
    })
    await c.tarifa(params('DOM'))
    now = 23 * 60 * 60 * 1000 + 1
    await c.tarifa(params('DOM'))
    expect(calls.filter((p) => p === '/login')).toHaveLength(2)
  })

  it('si el token venció (401) vuelve a loguearse y reintenta una vez', async () => {
    const { fetchFn, calls } = fakeAndreani({ expireFirst: true })
    const c = new AndreaniClient({
      base: 'https://qa.test',
      user: 'user',
      password: 'pass',
      fetch: fetchFn,
    })
    expect(await c.tarifa(params('DOM'))).toBe(9100)
    expect(calls).toEqual(['/login', '/v1/tarifas', '/login', '/v1/tarifas'])
  })

  it('credenciales malas → AndreaniError 401', async () => {
    const { fetchFn } = fakeAndreani({ loginFails: true })
    const c = new AndreaniClient({
      base: 'https://qa.test',
      user: 'user',
      password: 'mal',
      fetch: fetchFn,
    })
    await expect(c.tarifa(params('DOM'))).rejects.toMatchObject({ http: 401 })
  })

  it('CP que Andreani no cotiza → AndreaniError 400 con el detalle', async () => {
    const { fetchFn } = fakeAndreani()
    const c = new AndreaniClient({
      base: 'https://qa.test',
      user: 'user',
      password: 'pass',
      fetch: fetchFn,
    })
    const err = await c.tarifa(params('DOM', '9999')).catch((e) => e)
    expect(err).toBeInstanceOf(AndreaniError)
    expect(err).toMatchObject({ http: 400, message: 'CP inexistente' })
  })
})

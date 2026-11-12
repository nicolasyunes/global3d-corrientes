import { describe, expect, it } from 'vitest'
import {
  boxesToPackages,
  checkPackage,
  formatHours,
  normalizePostalCode,
  parseAgencies,
  parseRates,
  type Box,
} from './lib.ts'

const BOXES: Box[] = [
  { key: 'chica', label: 'Chica', weight: 500, height: 10, width: 15, length: 20 },
  { key: 'grande', label: 'Grande', weight: 4000, height: 30, width: 30, length: 40 },
]

describe('normalizePostalCode', () => {
  it('acepta CP viejo y CPA', () => {
    expect(normalizePostalCode('3400')).toBe('3400')
    expect(normalizePostalCode('w3400abc')).toBe('3400')
    expect(normalizePostalCode(' B 1842 ZAB ')).toBe('1842')
  })
  it('rechaza lo que no es un CP', () => {
    expect(normalizePostalCode('340')).toBeNull()
    expect(normalizePostalCode('0000')).toBeNull()
    expect(normalizePostalCode('abc')).toBeNull()
    expect(normalizePostalCode(undefined)).toBeNull()
  })
})

describe('paquetes', () => {
  it('arma un paquete por tipo de caja con su cantidad', () => {
    expect(boxesToPackages({ chica: 2, grande: 1 }, BOXES)).toEqual([
      { quantity: 2, weight: 500, height: 10, width: 15, length: 20 },
      { quantity: 1, weight: 4000, height: 30, width: 30, length: 40 },
    ])
  })
  it('una caja desconocida usa la primera', () => {
    expect(boxesToPackages({ vieja: 1 }, BOXES)[0].weight).toBe(500)
  })
  it('respeta los límites de MiCorreo', () => {
    const ok = { quantity: 1, weight: 1000, height: 10, width: 10, length: 10 }
    expect(() => checkPackage({ ...ok, weight: 60000 })).toThrow('peso')
    expect(() => checkPackage({ ...ok, height: 201 })).toThrow('medidas')
    expect(() => checkPackage({ ...ok, height: 150, width: 100, length: 60 })).toThrow(
      'medidas',
    )
    expect(checkPackage({ ...ok, weight: 999.6 }).weight).toBe(1000)
  })
})

describe('parseRates', () => {
  it('ordena sucursal primero y redondea para arriba', () => {
    const rates = parseRates({
      rates: [
        { deliveredType: 'D', productType: 'CP', productName: 'Clásico', price: 598.06, deliveryTimeMin: '2', deliveryTimeMax: '5' },
        { deliveredType: 'S', productType: 'EP', productName: 'Expreso', price: 900, deliveryTimeMin: '1', deliveryTimeMax: '3' },
        { deliveredType: 'S', productType: 'CP', productName: 'Clásico', price: 398.06, deliveryTimeMin: '2', deliveryTimeMax: '5' },
        { deliveredType: 'X', price: 1 },
      ],
    })
    expect(rates.map((r) => `${r.deliveredType}${r.productType}${r.price}`)).toEqual([
      'SCP399',
      'SEP900',
      'DCP599',
    ])
  })
  it('respuesta rara → lista vacía', () => {
    expect(parseRates(null)).toEqual([])
    expect(parseRates({ rates: 'x' })).toEqual([])
  })
})

describe('sucursales', () => {
  const agency = (code: string, cp: string, extra = {}) => ({
    code,
    name: `Suc ${code}`,
    status: 'ACTIVE',
    services: { packageReception: true, pickupAvailability: true },
    location: { address: { streetName: 'Calle', streetNumber: '1', locality: 'X', postalCode: cp } },
    hours: {
      monday: { start: '0930', end: '1800' },
      tuesday: { start: '0930', end: '1800' },
      wednesday: { start: '0930', end: '1800' },
      thursday: { start: '0930', end: '1800' },
      friday: { start: '0930', end: '1800' },
      saturday: { start: '0900', end: '1300' },
    },
    ...extra,
  })

  it('ordena por cercanía de CP y saca inactivas o sin retiro', () => {
    const list = parseAgencies(
      [
        agency('W0001', 'W3400AAA'),
        agency('W0002', 'W3402AAA'),
        agency('W0003', 'W3401AAA', { status: 'CLOSED' }),
        agency('W0004', 'W3401AAA', { services: { pickupAvailability: false } }),
      ],
      '3403',
    )
    expect(list.map((a) => a.code)).toEqual(['W0002', 'W0001'])
    expect(list[0]).toMatchObject({ address: 'Calle 1', city: 'X', postalCode: '3402' })
  })

  it('agrupa los horarios iguales', () => {
    expect(formatHours(agency('A1', '1').hours)).toBe(
      'Lun a Vie 09:30–18:00 · Sáb 09:00–13:00',
    )
    expect(formatHours(null)).toBeNull()
  })
})

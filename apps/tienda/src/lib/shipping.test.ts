import { describe, expect, it } from 'vitest'
import type { CartItem } from './cart'
import {
  addressError,
  addressText,
  cartShippingKey,
  validEmail,
  cheapestByType,
  deliveryTime,
  normalizePostalCode,
  provinceFromPostalCode,
  quoteErrorMessage,
  quoteUnavailable,
  rateLabel,
  shippingItems,
  type ShippingRate,
} from './shipping'

const rate = (
  deliveredType: 'S' | 'D',
  productType: string,
  price: number,
): ShippingRate => ({
  deliveredType,
  productType,
  productName:
    productType === 'EP' ? 'Correo Argentino Expreso' : 'Correo Argentino Clasico',
  price,
  deliveryTimeMin: productType === 'EP' ? '1' : '2',
  deliveryTimeMax: productType === 'EP' ? '3' : '5',
})

const item = (over: Partial<CartItem>): CartItem => ({
  key: 'k',
  familySlug: 'vaso-camiseta',
  productId: null,
  name: 'Vaso',
  variantLabel: '',
  image: null,
  unitPrice: 1000,
  minQty: 1,
  leadDays: 3,
  stock: 5,
  quantity: 1,
  personalization: {},
  personalizationText: '',
  ...over,
})

describe('código postal', () => {
  it('acepta el viejo y el CPA', () => {
    expect(normalizePostalCode('3400')).toBe('3400')
    expect(normalizePostalCode(' w3400abc ')).toBe('3400')
    expect(normalizePostalCode('340')).toBeNull()
  })

  it('saca la provincia del CPA', () => {
    expect(provinceFromPostalCode('W3400ABC')).toBe('W')
    expect(provinceFromPostalCode('B1842ZAB')).toBe('B')
    // "I" no es código de provincia
    expect(provinceFromPostalCode('I1842ZAB')).toBeNull()
    expect(provinceFromPostalCode('3400')).toBeNull()
  })
})

describe('carrito', () => {
  it('manda productId o familySlug con la cantidad', () => {
    expect(
      shippingItems([
        item({ productId: 'p1', quantity: 2 }),
        item({ productId: null, familySlug: 'llavero' }),
      ]),
    ).toEqual([
      { productId: 'p1', familySlug: undefined, quantity: 2 },
      { productId: undefined, familySlug: 'llavero', quantity: 1 },
    ])
  })

  it('la clave cambia solo si cambia qué y cuánto', () => {
    const a = cartShippingKey([item({ productId: 'p1', quantity: 2 })])
    expect(cartShippingKey([item({ productId: 'p1', quantity: 2, name: 'Otro' })])).toBe(a)
    expect(cartShippingKey([item({ productId: 'p1', quantity: 3 })])).not.toBe(a)
  })
})

describe('tarifas', () => {
  it('nombra el servicio y el tipo de entrega', () => {
    expect(rateLabel(rate('S', 'CP', 100))).toBe('Clásico a sucursal')
    expect(rateLabel(rate('D', 'EP', 100))).toBe('Expreso a domicilio')
  })

  it('escribe la demora', () => {
    expect(deliveryTime(rate('S', 'CP', 1))).toBe('2 a 5 días hábiles')
    expect(
      deliveryTime({ ...rate('S', 'CP', 1), deliveryTimeMin: '1', deliveryTimeMax: '1' }),
    ).toBe('1 día hábil')
  })

  it('elige la más barata de cada tipo', () => {
    const { S, D } = cheapestByType([
      rate('S', 'EP', 11250),
      rate('S', 'CP', 6890),
      rate('D', 'CP', 9420),
    ])
    expect(S?.price).toBe(6890)
    expect(D?.price).toBe(9420)
  })
})

describe('errores', () => {
  it('traduce los que conoce y tiene un texto por defecto', () => {
    expect(quoteErrorMessage('cp')).toMatch(/código postal/)
    expect(quoteErrorMessage(null)).toMatch(/No pudimos cotizar/)
  })

  it('solo "no configurado" apaga el cotizador', () => {
    expect(quoteUnavailable('correo_no_configurado')).toBe(true)
    expect(quoteUnavailable('correo_caido')).toBe(false)
    expect(quoteUnavailable('cp')).toBe(false)
  })
})

describe('dirección para Correo', () => {
  const a = { street: 'Vicente Lopez', number: '448', floor: '', apartment: '', city: 'Monte Grande' }
  it('arma el texto con piso y depto si hay', () => {
    expect(addressText(a)).toBe('Vicente Lopez 448, Monte Grande')
    expect(addressText({ ...a, floor: '1', apartment: 'D' })).toBe('Vicente Lopez 448 piso 1 D, Monte Grande')
  })
  it('dice qué falta', () => {
    expect(addressError(a, 'B')).toBeNull()
    expect(addressError({ ...a, number: '' }, 'B')).toMatch(/altura/)
    expect(addressError(a, undefined)).toMatch(/provincia/)
  })
  it('valida el email', () => {
    expect(validEmail(' ana@mail.com ')).toBe(true)
    expect(validEmail('ana@mail')).toBe(false)
  })
})

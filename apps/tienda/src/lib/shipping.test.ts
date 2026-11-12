import { describe, expect, it } from 'vitest'
import type { CartItem } from './cart'
import {
  cartShippingKey,
  cheapestByType,
  choiceText,
  mergeQuotes,
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
  carrier: 'correo',
  quoteId: 'q-correo',
  deliveredType,
  productType,
  productName:
    productType === 'EP'
      ? 'Correo Argentino Expreso'
      : 'Correo Argentino Clasico',
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
    expect(
      cartShippingKey([item({ productId: 'p1', quantity: 2, name: 'Otro' })]),
    ).toBe(a)
    expect(cartShippingKey([item({ productId: 'p1', quantity: 3 })])).not.toBe(
      a,
    )
  })
})

describe('tarifas', () => {
  it('nombra el servicio y el tipo de entrega', () => {
    expect(rateLabel(rate('S', 'CP', 100))).toBe('Clásico a sucursal')
    expect(rateLabel(rate('D', 'EP', 100))).toBe('Expreso a domicilio')
    expect(
      rateLabel({
        ...rate('S', 'AN', 100),
        carrier: 'andreani',
        productName: 'Andreani',
      }),
    ).toBe('Andreani a sucursal')
  })
  it('en el pedido nombra la empresa', () => {
    expect(choiceText({ carrier: 'correo', label: 'Clásico a sucursal' })).toBe(
      'Correo Argentino, Clásico a sucursal',
    )
    expect(
      choiceText({ carrier: 'andreani', label: 'Andreani a domicilio' }),
    ).toBe('Andreani a domicilio')
  })

  it('escribe la demora', () => {
    expect(deliveryTime(rate('S', 'CP', 1))).toBe('2 a 5 días hábiles')
    expect(
      deliveryTime({
        ...rate('S', 'CP', 1),
        deliveryTimeMin: '1',
        deliveryTimeMax: '1',
      }),
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
    expect(quoteUnavailable('andreani_no_configurado')).toBe(true)
    expect(quoteUnavailable('correo_caido')).toBe(false)
    expect(quoteUnavailable('cp')).toBe(false)
  })
})

describe('juntar Correo y Andreani', () => {
  const plain = (
    deliveredType: 'S' | 'D',
    productType: string,
    price: number,
  ) => {
    const r: Partial<ShippingRate> = rate(deliveredType, productType, price)
    delete r.carrier
    delete r.quoteId
    return r as Omit<ShippingRate, 'carrier' | 'quoteId'>
  }
  const correo = {
    carrier: 'correo' as const,
    ok: true as const,
    quote: {
      quoteId: 'qc',
      postalCode: '1842',
      rates: [plain('S', 'CP', 6890), plain('D', 'CP', 9420)],
    },
  }
  const andreani = {
    carrier: 'andreani' as const,
    ok: true as const,
    quote: {
      quoteId: 'qa',
      postalCode: '1842',
      rates: [
        { ...plain('S', 'AN', 6100), productName: 'Andreani' },
        { ...plain('D', 'AN', 9900), productName: 'Andreani' },
      ],
    },
  }

  it('junta las tarifas con su empresa y cotización, sucursal y más barata primero', () => {
    const res = mergeQuotes([correo, andreani])
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.quote.postalCode).toBe('1842')
    expect(
      res.quote.rates.map(
        (r) => `${r.carrier}:${r.quoteId}:${r.deliveredType}${r.price}`,
      ),
    ).toEqual([
      'andreani:qa:S6100',
      'correo:qc:S6890',
      'correo:qc:D9420',
      'andreani:qa:D9900',
    ])
  })

  it('si una empresa falla, alcanza con la otra', () => {
    const res = mergeQuotes([
      correo,
      { carrier: 'andreani', ok: false, error: 'andreani_caido' },
    ])
    expect(res.ok && res.quote.rates.every((r) => r.carrier === 'correo')).toBe(
      true,
    )
  })

  it('ninguna configurada → "no configurado" (vuelve a cotizar por WhatsApp)', () => {
    const res = mergeQuotes([
      { carrier: 'correo', ok: false, error: 'correo_no_configurado' },
      { carrier: 'andreani', ok: false, error: 'andreani_no_configurado' },
    ])
    expect(res.ok).toBe(false)
    expect(!res.ok && quoteUnavailable(res.error)).toBe(true)
  })

  it('una sin configurar y la otra con error → muestra el error útil', () => {
    expect(
      mergeQuotes([
        { carrier: 'correo', ok: false, error: 'sin_cotizacion' },
        { carrier: 'andreani', ok: false, error: 'andreani_no_configurado' },
      ]),
    ).toEqual({ ok: false, error: 'sin_cotizacion' })
    expect(
      mergeQuotes([
        { carrier: 'correo', ok: false, error: null },
        { carrier: 'andreani', ok: false, error: 'cp' },
      ]),
    ).toEqual({ ok: false, error: 'cp' })
  })
})

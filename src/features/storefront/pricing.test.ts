import { describe, expect, it } from 'vitest'
import {
  cashPrice,
  fmt,
  installmentPrice,
  leadTimeText,
  lineDiscountRate,
  lineTotal,
  shippingCost,
} from './pricing'
import type { Product } from './data/products'
import type { CartLine } from './cart-types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  cat: 'llaveros',
  name: 'Producto',
  price: 10000,
  personalizable: false,
  colors: null,
  stock: 'in',
  desc: '',
  specs: [],
  ...overrides,
})

const cartLine = (overrides: Partial<CartLine> = {}): CartLine => ({
  id: 'p1||',
  productId: 'p1',
  cat: 'llaveros',
  name: 'Producto',
  price: 10000,
  color: null,
  engraving: '',
  qty: 1,
  ...overrides,
})

describe('fmt', () => {
  it('formats a number as an es-AR peso amount', () => {
    expect(fmt(10000)).toBe('$10.000')
  })

  it('rounds to the nearest integer', () => {
    expect(fmt(999.6)).toBe('$1.000')
  })
})

describe('cashPrice', () => {
  it('applies the 9% cash discount', () => {
    expect(cashPrice(10000)).toBeCloseTo(9100)
  })
})

describe('installmentPrice', () => {
  it('divides the price by 3', () => {
    expect(installmentPrice(9000)).toBe(3000)
  })
})

describe('leadTimeText', () => {
  it('extracts the lead time from a spec line', () => {
    expect(leadTimeText(product({ specs: ['Material: PLA', 'Tiempo estimado: 2-3 días'] }))).toBe('2-3 días')
  })

  it('returns null when there is no lead-time spec', () => {
    expect(leadTimeText(product({ specs: ['Material: PLA'] }))).toBeNull()
  })
})

describe('lineDiscountRate / lineTotal', () => {
  it('gives filamentos a 10% discount at qty >= 3', () => {
    const line = cartLine({ cat: 'filamentos', price: 16500, qty: 3 })
    expect(lineDiscountRate(line)).toBe(0.1)
    expect(lineTotal(line)).toBeCloseTo(16500 * 3 * 0.9)
  })

  it('gives no discount below the bulk threshold', () => {
    const line = cartLine({ cat: 'filamentos', price: 16500, qty: 2 })
    expect(lineDiscountRate(line)).toBe(0)
    expect(lineTotal(line)).toBe(16500 * 2)
  })

  it('never discounts non-filament categories regardless of qty', () => {
    const line = cartLine({ cat: 'llaveros', price: 2000, qty: 5 })
    expect(lineDiscountRate(line)).toBe(0)
  })
})

describe('shippingCost', () => {
  it('is free on pickup ("retiro")', () => {
    expect(shippingCost('retiro', 100)).toBe(0)
  })

  it('is free once the subtotal reaches the free-shipping threshold', () => {
    expect(shippingCost('domicilio', 30000)).toBe(0)
  })

  it('charges the flat rate below the threshold', () => {
    expect(shippingCost('domicilio', 1000)).toBe(3500)
  })
})

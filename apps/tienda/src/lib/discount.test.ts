import { describe, expect, it } from 'vitest'
import {
  cashDiscount,
  cashDiscountPct,
  cashPrice,
  discountFor,
} from './discount'

describe('descuento por efectivo o transferencia', () => {
  it('solo aplica a efectivo y transferencia', () => {
    expect(discountFor('transfer')).toBe(true)
    expect(discountFor('cash')).toBe(true)
    expect(discountFor('mercadopago')).toBe(false)
  })

  it('redondea como el servidor', () => {
    expect(cashDiscount(24800, 10)).toBe(2480)
    expect(cashPrice(24800, 10)).toBe(22320)
    expect(cashDiscount(1875, 10)).toBe(188)
    expect(cashDiscount(1000, 0)).toBe(0)
  })

  it('porcentaje inválido o ausente es 0', () => {
    expect(cashDiscountPct({})).toBe(0)
    expect(cashDiscountPct({ descuento_efectivo: { porcentaje: 10 } })).toBe(10)
    expect(cashDiscountPct({ descuento_efectivo: { porcentaje: 150 } })).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  PAYMENT_KIND_LABELS,
  activePayments,
  methodLabel,
  paidTotal,
  paymentKindFor,
  validatePayment,
  type PaymentRow,
} from './payments'

const row = (over: Partial<PaymentRow>): PaymentRow =>
  ({
    id: 'p1', type: '3d_service', order_id: 'o1', amount: 1000, method: 'cash',
    payment_kind: 'deposit', transacted_at: '2026-10-09T12:00:00Z', note: null,
    operator_id: null, voided_at: null, voided_by: null, void_reason: null,
    ...over,
  }) as PaymentRow

describe('paymentKindFor', () => {
  it('primer cobro que cubre todo es pago total; parcial es seña; los siguientes son saldo', () => {
    expect(paymentKindFor(10000, 0, 10000)).toBe('full')
    expect(paymentKindFor(10000, 0, 4000)).toBe('deposit')
    expect(paymentKindFor(10000, 4000, 6000)).toBe('balance')
    expect(paymentKindFor(10000, 4000, 2000)).toBe('balance')
  })
})

describe('totales', () => {
  const rows = [
    row({ id: 'a', amount: 4000 }),
    row({ id: 'b', amount: 1500, payment_kind: 'balance' }),
    row({ id: 'c', amount: 999, voided_at: '2026-10-10T00:00:00Z', void_reason: 'error' }),
  ]
  it('los anulados no cuentan', () => {
    expect(activePayments(rows).map((r) => r.id)).toEqual(['a', 'b'])
    expect(paidTotal(rows)).toBe(5500)
    expect(paidTotal([])).toBe(0)
  })
})

describe('etiquetas', () => {
  it('medio y tipo en castellano', () => {
    expect(methodLabel('cash')).toBe('Efectivo')
    expect(methodLabel('mercadopago')).toBe('Mercado Pago')
    expect(methodLabel(null)).toBe('Sin medio')
    expect(methodLabel('bitcoin')).toBe('Sin medio')
    expect(PAYMENT_KIND_LABELS).toEqual({ deposit: 'Seña', balance: 'Saldo', full: 'Pago total' })
  })
})

describe('validatePayment', () => {
  it('pide monto, medio y que no supere el saldo', () => {
    expect(validatePayment({ amount: '', method: 'cash', balance: 5000 })).toBe('Escribí el monto que pagó.')
    expect(validatePayment({ amount: 'abc', method: 'cash', balance: 5000 })).toBe('Revisá el monto.')
    expect(validatePayment({ amount: '0', method: 'cash', balance: 5000 })).toBe('Escribí el monto que pagó.')
    expect(validatePayment({ amount: '1000', method: null, balance: 5000 })).toBe('Elegí cómo pagó.')
    expect(validatePayment({ amount: '6.000', method: 'cash', balance: 5000 })).toBe('El cobro supera el saldo.')
    expect(validatePayment({ amount: '5.000', method: 'transfer', balance: 5000 })).toBeNull()
  })
})

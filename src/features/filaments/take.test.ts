import { describe, expect, it } from 'vitest'
import {
  emptyTake,
  parseAmount,
  paymentSplit,
  paymentText,
  takeError,
  takeToast,
  type TakeDraft,
} from './take'

const d = (over: Partial<TakeDraft>): TakeDraft => ({ ...emptyTake('sale'), ...over })

describe('takeError', () => {
  it('pide cantidad válida', () => {
    expect(takeError(d({ qty: 0, payment: 'cash' }), 3, 1000)).toBe(
      'La cantidad tiene que ser 1 o más.',
    )
  })
  it('no deja sacar más de lo que hay', () => {
    expect(takeError(d({ qty: 4, payment: 'cash' }), 3, 1000)).toBe('Solo quedan 3.')
    expect(takeError(d({ qty: 1, payment: 'cash' }), 0, 1000)).toBe(
      'No hay stock de este color.',
    )
  })
  it('venta: exige precio de lista y forma de cobro', () => {
    expect(takeError(d({ payment: 'cash' }), 3, null)).toMatch(/precio de lista/)
    expect(takeError(d({ payment: null }), 3, 1000)).toBe('Elegí cómo te pagaron.')
    expect(takeError(d({ payment: 'transfer' }), 3, 1000)).toBeNull()
  })
  it('pago mixto: el efectivo tiene que ser más que 0 y menos que el total', () => {
    const mixed = (cash: string) => d({ qty: 2, payment: 'mixed', cash })
    expect(takeError(mixed(''), 3, 20000)).toBe('Escribí cuánto te dieron en efectivo.')
    expect(takeError(mixed('0'), 3, 20000)).toBe('Escribí cuánto te dieron en efectivo.')
    expect(takeError(mixed('40.000'), 3, 20000)).toMatch(/menos que el total/)
    expect(takeError(mixed('20.000'), 3, 20000)).toBeNull()
  })
  it('uso personal y ajuste exigen motivo', () => {
    expect(takeError({ ...emptyTake('personal'), note: ' ' }, 3, null)).toBe(
      'Escribí el motivo.',
    )
    expect(takeError({ ...emptyTake('adjust'), note: 'rollo fallado' }, 3, null)).toBeNull()
  })
  it('a producción no pide nada más', () => {
    expect(takeError(emptyTake('used'), 1, null)).toBeNull()
  })
  it('sumar (available = Infinity) no se limita por stock', () => {
    expect(takeError({ ...emptyTake('adjust'), qty: 50, note: 'conteo' }, Infinity, null)).toBeNull()
  })
})

describe('takeToast', () => {
  it('venta muestra total y forma de cobro', () => {
    expect(takeToast(d({ qty: 2, payment: 'cash' }), 'Rojo · 3N3 PLA', 12000)).toBe(
      'Venta · 2 × Rojo · 3N3 PLA · $24.000 efectivo',
    )
  })
  it('pago mixto muestra las dos partes', () => {
    expect(
      takeToast(d({ qty: 2, payment: 'mixed', cash: '15000' }), 'Rojo · 3N3 PLA', 12000),
    ).toBe('Venta · 2 × Rojo · 3N3 PLA · $15.000 efectivo + $9.000 transferencia MP')
  })
  it('otras salidas muestran el motivo', () => {
    expect(takeToast(emptyTake('transfer'), 'Rojo · 3N3 PLA', null)).toBe(
      'A la otra sede · 1 × Rojo · 3N3 PLA',
    )
  })
})

describe('montos y pago mixto', () => {
  it('parseAmount entiende puntos de miles y coma decimal', () => {
    expect(parseAmount('20.000')).toBe(20000)
    expect(parseAmount('$ 20000,50')).toBe(20000.5)
    expect(parseAmount('veinte')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
  it('paymentSplit y paymentText', () => {
    expect(paymentSplit({ payment: 'cash', total: 100 })).toEqual({ cash: 100, transfer: 0 })
    expect(paymentSplit({ payment: 'transfer', total: 100 })).toEqual({ cash: 0, transfer: 100 })
    const mixed = { payment: 'mixed', total: 40000, cash_amount: 15000 }
    expect(paymentSplit(mixed)).toEqual({ cash: 15000, transfer: 25000 })
    expect(paymentText(mixed)).toBe('Mixto: $15.000 efectivo + $25.000 transf.')
    expect(paymentText({ payment: 'cash', total: 1 })).toBe('Efectivo')
  })
})

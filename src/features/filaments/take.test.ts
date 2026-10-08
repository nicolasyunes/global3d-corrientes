import { describe, expect, it } from 'vitest'
import { emptyTake, takeError, takeToast, type TakeDraft } from './take'

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
  it('otras salidas muestran el motivo', () => {
    expect(takeToast(emptyTake('transfer'), 'Rojo · 3N3 PLA', null)).toBe(
      'A la otra sede · 1 × Rojo · 3N3 PLA',
    )
  })
})

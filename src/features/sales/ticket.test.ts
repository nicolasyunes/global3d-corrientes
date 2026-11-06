import { describe, expect, it } from 'vitest'
import {
  emptyTicket,
  freeLine,
  lineFromProduct,
  ticketErrors,
  ticketTotals,
  toPayload,
} from './ticket'

const vaso = { id: 'p1', name: 'Vaso Boca', base_price: 24800 }

function draftWith(lines = [lineFromProduct(vaso)]) {
  return { ...emptyTicket(), lines, method: 'cash' as const }
}

describe('ticket', () => {
  it('suma líneas a precio de lista sin descuento', () => {
    const d = draftWith([{ ...lineFromProduct(vaso), quantity: '2' }])
    expect(ticketTotals(d)).toEqual({
      listTotal: 49600,
      subtotal: 49600,
      discount: 0,
      amount: 49600,
    })
  })

  it('precio unitario cambiado cuenta como descuento sobre la lista', () => {
    const d = draftWith([{ ...lineFromProduct(vaso), unitPrice: '13.200' }])
    expect(ticketTotals(d)).toMatchObject({
      listTotal: 24800,
      subtotal: 13200,
      amount: 13200,
    })
  })

  it('descuento en pesos con formato argentino', () => {
    const d = { ...draftWith(), discount: '1.800' }
    expect(ticketTotals(d)).toMatchObject({ discount: 1800, amount: 23000 })
  })

  it('descuento en porcentaje redondea a peso', () => {
    const d = {
      ...draftWith(),
      discountMode: 'percent' as const,
      discount: '15',
    }
    expect(ticketTotals(d)).toMatchObject({ discount: 3720, amount: 21080 })
  })

  it('errores: sin líneas, sin medio, cantidad inválida, descuento mayor al total', () => {
    expect(ticketErrors(emptyTicket())).toEqual(
      expect.arrayContaining([
        'Agregá al menos un producto',
        'Elegí el medio de pago',
      ]),
    )
    const bad = draftWith([{ ...lineFromProduct(vaso), quantity: '0' }])
    expect(ticketErrors(bad)).toContain('Revisá la cantidad de Vaso Boca')
    expect(ticketErrors({ ...draftWith(), discount: '30000' })).toContain(
      'El descuento es mayor que el total',
    )
  })

  it('payload para la base, con texto libre y descuento en pesos', () => {
    const d = {
      ...draftWith([
        lineFromProduct(vaso),
        { ...freeLine('Llavero'), unitPrice: '3000' },
      ]),
      discount: '10',
      discountMode: 'percent' as const,
    }
    const p = toPayload(d)
    expect(p.items).toEqual([
      {
        product_id: 'p1',
        description: 'Vaso Boca',
        quantity: 1,
        list_unit_price: 24800,
        unit_price: 24800,
      },
      {
        product_id: null,
        description: 'Llavero',
        quantity: 1,
        list_unit_price: 3000,
        unit_price: 3000,
      },
    ])
    expect(p.discount).toBe(2780)
    expect(p.channel).toBe('local')
  })
})

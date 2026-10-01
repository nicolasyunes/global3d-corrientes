import { describe, expect, it } from 'vitest'
import {
  deliveryLine,
  deliveryNote,
  hasDelivery,
  normalizeTime,
  type DeliveryFields,
} from './delivery'

const none: DeliveryFields = {
  delivery_kind: null,
  delivery_place: null,
  delivery_time: null,
  delivery_person: null,
  delivery_note: null,
}

describe('deliveryLine', () => {
  it('is empty when nothing was filled in', () => {
    expect(hasDelivery(none)).toBe(false)
    expect(deliveryLine(none)).toBe('')
  })

  it('describes a shipment', () => {
    const o = {
      ...none,
      delivery_kind: 'shipping',
      delivery_place: 'Av. Libertad 1234',
      delivery_person: 'Marta',
      delivery_time: '17:00',
    }
    expect(hasDelivery(o)).toBe(true)
    expect(deliveryLine(o)).toBe(
      'Envío · Av. Libertad 1234 · recibe Marta · a las 17:00',
    )
  })

  it('describes who picks it up', () => {
    expect(
      deliveryLine({
        ...none,
        delivery_kind: 'pickup',
        delivery_person: 'Ana',
        delivery_time: '16:30',
      }),
    ).toBe('Retira Ana · a las 16:30')
    expect(deliveryLine({ ...none, delivery_kind: 'pickup' })).toBe(
      'Retira en el local',
    )
  })

  it('keeps the note apart', () => {
    expect(deliveryNote({ ...none, delivery_note: '  tocar timbre 2B ' })).toBe(
      'tocar timbre 2B',
    )
    expect(hasDelivery({ ...none, delivery_note: 'solo una nota' })).toBe(true)
  })
})

describe('normalizeTime', () => {
  it('accepts the usual ways to type an hour', () => {
    expect(normalizeTime('17')).toBe('17:00')
    expect(normalizeTime('9:30')).toBe('09:30')
    expect(normalizeTime('1730')).toBe('17:30')
    expect(normalizeTime('930')).toBe('09:30')
    expect(normalizeTime('17.45')).toBe('17:45')
    expect(normalizeTime('8h15')).toBe('08:15')
  })

  it('rejects what is not a time', () => {
    expect(normalizeTime('')).toBe('')
    expect(normalizeTime('25:00')).toBe('')
    expect(normalizeTime('12:75')).toBe('')
    expect(normalizeTime('tarde')).toBe('')
  })
})

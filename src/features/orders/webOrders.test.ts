import { beforeEach, describe, expect, it } from 'vitest'
import {
  customerWhatsApp,
  markSeen,
  readSeen,
  unseen,
  type WebOrder,
} from './webOrders'

const order = (id: string, createdAt: string, whatsapp = '3794123456') =>
  ({
    id,
    code: 'ABC123',
    createdAt,
    customer: 'Ana López',
    whatsapp,
    total: 1000,
    delivery: { mode: 'retiro' },
    payment: { mode: 'total', method: 'cash' },
    notes: null,
    items: [],
  }) as WebOrder

describe('pedidos web por confirmar', () => {
  beforeEach(() => localStorage.clear())

  it('sin nada visto, todos son nuevos', () => {
    const list = [order('a', '2026-11-04T10:00:00Z')]
    expect(unseen(list, null)).toEqual(list)
  })

  it('después de marcar, solo aparecen los que entran más tarde', () => {
    const before = [
      order('b', '2026-11-04T11:00:00Z'),
      order('a', '2026-11-04T10:00:00Z'),
    ]
    markSeen(before)
    expect(readSeen()).toBe('2026-11-04T11:00:00Z')
    const later = [order('c', '2026-11-04T12:00:00Z'), ...before]
    expect(unseen(later, readSeen()).map((o) => o.id)).toEqual(['c'])
  })

  it('marcar una lista vacía no cambia nada', () => {
    markSeen([])
    expect(readSeen()).toBeNull()
  })

  it('arma el WhatsApp del cliente con prefijo 549 y el código', () => {
    const url = customerWhatsApp(order('a', '2026-11-04T10:00:00Z'))!
    expect(url.startsWith('https://wa.me/5493794123456?text=')).toBe(true)
    expect(decodeURIComponent(url)).toContain('¡Hola Ana!')
    expect(decodeURIComponent(url)).toContain('ABC123')
    expect(
      customerWhatsApp(order('b', '2026-11-04T10:00:00Z', '5493794123456')),
    ).toContain('wa.me/5493794123456')
    expect(
      customerWhatsApp(order('c', '2026-11-04T10:00:00Z', '12')),
    ).toBeNull()
  })
})

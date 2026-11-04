import { beforeEach, describe, expect, it } from 'vitest'
import { markSeen, readSeen, unseen, type WebOrder } from './webOrders'

const order = (id: string, createdAt: string): WebOrder => ({
  id,
  createdAt,
  total: 1000,
  customer: 'Ana',
})

describe('pedidos web sin ver', () => {
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
})

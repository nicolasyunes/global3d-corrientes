import { describe, expect, it } from 'vitest'
import type { OrderStatus } from '@/lib/domain-constants'
import { nextOrderStatus, ORDER_STATUS_FLOW } from './status'

describe('nextOrderStatus', () => {
  it('walks the production flow in enum order', () => {
    const flow: OrderStatus[] = [
      'new',
      'printing',
      'post_processing',
      'finished',
    ]
    for (let i = 0; i < flow.length - 1; i += 1) {
      expect(nextOrderStatus(flow[i])).toBe(flow[i + 1])
    }
  })

  it('returns null for terminal and off-flow statuses', () => {
    expect(nextOrderStatus('finished')).toBeNull()
    expect(nextOrderStatus('cancelled')).toBeNull()
  })

  it('ORDER_STATUS_FLOW matches the forward production sequence', () => {
    expect(ORDER_STATUS_FLOW).toEqual([
      'new',
      'printing',
      'post_processing',
      'finished',
    ])
  })

  it('treats the retired in_queue status as terminal (never advanced into or out of)', () => {
    expect(nextOrderStatus('in_queue')).toBeNull()
  })
})

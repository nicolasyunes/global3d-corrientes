import { describe, expect, it } from 'vitest'
import {
  ORIGIN_CHANNEL,
  ORDER_STATUS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD,
  PRODUCT_TYPE,
  TRANSACTION_TYPE,
  URGENCY_COLORS,
} from './domain-constants'

describe('open-list constants', () => {
  it('PAYMENT_METHOD matches the CHECK constraint list', () => {
    expect(PAYMENT_METHOD).toEqual([
      'cash',
      'transfer',
      'uala',
      'brubank',
      'mercadopago',
      'other',
    ])
  })

  it('PRODUCT_TYPE matches the CHECK constraint list', () => {
    expect(PRODUCT_TYPE).toEqual(['cup', 'trophy', 'keychain', 'other'])
  })

  it('ORIGIN_CHANNEL matches the CHECK constraint list', () => {
    expect(ORIGIN_CHANNEL).toEqual([
      'facebook',
      'whatsapp',
      'instagram',
      'other',
    ])
  })
})

describe('enum constants', () => {
  it('ORDER_STATUS covers every order_status value', () => {
    expect(ORDER_STATUS).toEqual([
      'new',
      'in_queue',
      'printing',
      'post_processing',
      'finished',
      'cancelled',
    ])
  })

  it('TRANSACTION_TYPE covers both transaction_type values', () => {
    expect(TRANSACTION_TYPE).toEqual(['3d_service', 'supplies_sale'])
  })
})

describe('color mappings', () => {
  const tokenPattern = /^var\(--[\w-]+\)$/

  it('ORDER_STATUS_COLORS references tokens, not raw hex', () => {
    for (const value of Object.values(ORDER_STATUS_COLORS)) {
      expect(value).toMatch(tokenPattern)
    }
  })

  it('ORDER_STATUS_COLORS maps each status to its assigned token', () => {
    expect(ORDER_STATUS_COLORS).toEqual({
      new: 'var(--status-amber)',
      in_queue: 'var(--color-orange)',
      printing: 'var(--color-orange)',
      post_processing: 'var(--color-orange)',
      finished: 'var(--color-teal)',
      cancelled: 'var(--color-carbon)',
    })
  })

  it('ORDER_STATUS_COLORS does not reference the removed gray/black tokens', () => {
    for (const value of Object.values(ORDER_STATUS_COLORS)) {
      expect(value).not.toMatch(/--color-(gray|black)/)
    }
  })

  it('URGENCY_COLORS references tokens, not raw hex', () => {
    for (const value of Object.values(URGENCY_COLORS)) {
      expect(value).toMatch(tokenPattern)
    }
  })

  it('URGENCY_COLORS covers the four semaphore buckets', () => {
    expect(Object.keys(URGENCY_COLORS).sort()).toEqual([
      'comfortable',
      'finished',
      'overdue',
      'upcoming',
    ])
  })
})

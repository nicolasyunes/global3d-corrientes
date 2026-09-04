import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  buildOrderItems,
  defaultDueDate,
  draftFromOrder,
  emptyDraft,
  emptyItemDraft,
  emptyQuickOrderDraft,
  inferProductType,
  itemsSubtotal,
  parseMoney,
  parseQuantity,
  quickOrderItem,
  quickOrderPendingBalance,
  resolvedPendingBalance,
  toISODate,
  validateOrder,
  validateQuickOrder,
  DEFAULT_LEAD_TIME_DAYS,
  type OrderDraft,
  type OrderItemDraft,
  type QuickOrderDraft,
} from './validation'
import type { OrderWithCustomer } from './orders.api'

function draftWith(overrides: Partial<OrderDraft>): OrderDraft {
  return { ...emptyDraft(), ...overrides }
}

function quickDraftWith(overrides: Partial<QuickOrderDraft>): QuickOrderDraft {
  return { ...emptyQuickOrderDraft(), ...overrides }
}

// Minimal persisted order fixture for draftFromOrder tests — mirrors the
// shape of order() in list.test.ts (same OrderWithCustomer type), kept local
// since validation.test.ts didn't previously need one.
const baseOrder: OrderWithCustomer = {
  id: 'id',
  customer_id: 'customer',
  product_type: 'cup',
  color_spec: {},
  personalization: null,
  measurements: null,
  observations: null,
  order_date: '2026-01-01',
  due_date: '2026-01-05',
  total_amount: null,
  deposit: null,
  pending_balance: null,
  payment_method: null,
  status: 'new',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  origin_channel: null,
  reference_link: null,
  customers: { name: 'Ada', phone: null },
}

describe('validateOrder — required fields', () => {
  it('blocks submission when customer, product type, or due date are missing', () => {
    const errors = validateOrder(
      draftWith({ customerName: '', productType: '', dueDate: '' }),
    )
    expect(errors.customerName).toBeTruthy()
    expect(errors.productType).toBeTruthy()
    expect(errors.dueDate).toBeTruthy()
  })

  it('passes when the required fields are complete', () => {
    const errors = validateOrder(
      draftWith({
        customerName: 'Ada',
        productType: 'cup',
        dueDate: '2099-01-01',
      }),
    )
    expect(errors).toEqual({})
  })

  it('rejects a malformed due date', () => {
    const errors = validateOrder(draftWith({ dueDate: 'not-a-date' }))
    expect(errors.dueDate).toBeTruthy()
  })
})

describe('validateOrder — numeric fields', () => {
  it('rejects a non-numeric total', () => {
    const errors = validateOrder(draftWith({ totalAmount: 'abc' }))
    expect(errors.totalAmount).toBeTruthy()
  })

  it('rejects a negative total', () => {
    const errors = validateOrder(draftWith({ totalAmount: '-5' }))
    expect(errors.totalAmount).toBeTruthy()
  })

  it('rejects a deposit that exceeds the total', () => {
    const errors = validateOrder(
      draftWith({ totalAmount: '100', deposit: '150' }),
    )
    expect(errors.deposit).toBeTruthy()
  })

  it('rejects a deposit set without a total', () => {
    const errors = validateOrder(draftWith({ deposit: '50' }))
    expect(errors.deposit).toBeTruthy()
  })

  it('accepts an empty total and deposit (both optional)', () => {
    const errors = validateOrder(draftWith({ totalAmount: '', deposit: '' }))
    expect(errors.totalAmount).toBeUndefined()
    expect(errors.deposit).toBeUndefined()
  })

  it('rejects an invalid pending balance override', () => {
    const errors = validateOrder(draftWith({ pendingBalance: 'nope' }))
    expect(errors.pendingBalance).toBeTruthy()
  })
})

describe('validateOrder — reference link', () => {
  it('accepts a valid https:// URL', () => {
    const errors = validateOrder(
      draftWith({ referenceLink: 'https://makerworld.com/en/models/12345' }),
    )
    expect(errors.referenceLink).toBeUndefined()
  })

  it('accepts an empty reference link (optional field)', () => {
    const errors = validateOrder(draftWith({ referenceLink: '' }))
    expect(errors.referenceLink).toBeUndefined()
  })

  it('rejects a schemeless value', () => {
    const errors = validateOrder(
      draftWith({ referenceLink: 'makerworld.com/model' }),
    )
    expect(errors.referenceLink).toBeTruthy()
  })
})

describe('parseMoney', () => {
  it('parses a valid decimal', () => {
    expect(parseMoney('12.50')).toBe(12.5)
  })

  it('returns null for empty input', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
  })

  it('returns null for invalid or negative input', () => {
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('-1')).toBeNull()
  })
})

describe('resolvedPendingBalance', () => {
  it('defaults to total − deposit', () => {
    expect(
      resolvedPendingBalance(draftWith({ totalAmount: '100', deposit: '30' })),
    ).toBe(70)
  })

  it('returns null when nothing is set', () => {
    expect(resolvedPendingBalance(emptyDraft())).toBeNull()
  })

  it('honors an explicit override over the computed value', () => {
    expect(
      resolvedPendingBalance(
        draftWith({ totalAmount: '100', deposit: '30', pendingBalance: '40' }),
      ),
    ).toBe(40)
  })
})

describe('parseQuantity', () => {
  it('parses a positive integer', () => {
    expect(parseQuantity('20')).toBe(20)
  })

  it('returns null for empty, zero, negative, or fractional input', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('0')).toBeNull()
    expect(parseQuantity('-3')).toBeNull()
    expect(parseQuantity('2.5')).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
  })
})

describe('buildOrderItems', () => {
  function itemWith(overrides: Partial<OrderItemDraft>): OrderItemDraft {
    return { ...emptyItemDraft(), ...overrides }
  }

  it('returns an empty list when no rows were added', () => {
    expect(buildOrderItems([])).toEqual([])
  })

  it('drops rows left blank (description empty) — abandoned "+ agregar ítem" taps never block submit', () => {
    expect(buildOrderItems([emptyItemDraft()])).toEqual([])
  })

  it('builds a full item, computing line_total from unit_price × quantity', () => {
    const [built] = buildOrderItems([
      itemWith({
        productType: 'trophy',
        description: 'Trophy #1 — engraved "Campeón 2026"',
        personalization: 'Team A',
        quantity: '3',
        unitPrice: '15.5',
      }),
    ])
    expect(built).toEqual({
      product_type: 'trophy',
      description: 'Trophy #1 — engraved "Campeón 2026"',
      personalization: 'Team A',
      quantity: 3,
      unit_price: 15.5,
      line_total: 46.5,
      position: 0,
    })
  })

  it('defaults quantity to 1 and leaves line_total null when no unit price is set', () => {
    const [built] = buildOrderItems([
      itemWith({ description: 'Keychain, no price yet', quantity: '' }),
    ])
    expect(built.quantity).toBe(1)
    expect(built.unit_price).toBeNull()
    expect(built.line_total).toBeNull()
  })

  it('preserves entry order via position, skipping blank rows in between', () => {
    const built = buildOrderItems([
      itemWith({ description: 'First' }),
      emptyItemDraft(),
      itemWith({ description: 'Second' }),
    ])
    expect(built.map((item) => [item.description, item.position])).toEqual([
      ['First', 0],
      ['Second', 1],
    ])
  })
})

describe('itemsSubtotal', () => {
  function itemWith(overrides: Partial<OrderItemDraft>): OrderItemDraft {
    return { ...emptyItemDraft(), ...overrides }
  }

  it('returns null when no item has a price', () => {
    expect(
      itemsSubtotal(buildOrderItems([itemWith({ description: 'Sin precio' })])),
    ).toBeNull()
  })

  it('sums line_total across priced items, ignoring unpriced ones', () => {
    const built = buildOrderItems([
      itemWith({ description: 'A', quantity: '2', unitPrice: '10' }),
      itemWith({ description: 'B (sin precio)' }),
      itemWith({ description: 'C', quantity: '1', unitPrice: '5.5' }),
    ])
    expect(itemsSubtotal(built)).toBe(25.5)
  })
})

describe('smart defaults', () => {
  it('toISODate formats a date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('addBusinessDays skips weekends', () => {
    // Friday + 1 business day -> Monday.
    const friday = new Date(2026, 0, 2) // 2026-01-02 is a Friday
    expect(toISODate(addBusinessDays(friday, 1))).toBe('2026-01-05')
  })

  it('defaultDueDate is DEFAULT_LEAD_TIME_DAYS business days out and never a weekend', () => {
    const result = defaultDueDate(new Date(2026, 0, 5)) // Monday
    expect(result).toBe('2026-01-08') // Wed +3 business days (Tue, Wed, Thu)
    const weekday = new Date(`${result}T00:00:00`).getDay()
    expect([0, 6]).not.toContain(weekday)
  })

  it('emptyDraft applies the default due date and empty optional fields', () => {
    const draft = emptyDraft()
    expect(draft.dueDate).toBe(defaultDueDate())
    expect(draft.productType).toBe('')
    expect(draft.totalAmount).toBe('')
    expect(DEFAULT_LEAD_TIME_DAYS).toBeGreaterThan(0)
  })

  it('emptyDraft starts with an empty referenceLink', () => {
    expect(emptyDraft().referenceLink).toBe('')
  })

  it('draftFromOrder carries over a stored reference_link', () => {
    const order = {
      ...baseOrder,
      reference_link: 'https://makerworld.com/en/models/12345',
    }
    expect(draftFromOrder(order).referenceLink).toBe(
      'https://makerworld.com/en/models/12345',
    )
  })

  it('draftFromOrder maps a null reference_link to an empty string', () => {
    const order = { ...baseOrder, reference_link: null }
    expect(draftFromOrder(order).referenceLink).toBe('')
  })
})

describe('inferProductType', () => {
  it('infers cup from a "taza" mention', () => {
    expect(inferProductType('Taza personalizada con foto de perro')).toBe(
      'cup',
    )
  })

  it('infers trophy from a "trofeo" mention', () => {
    expect(inferProductType('2 trofeos para el torneo del sábado')).toBe(
      'trophy',
    )
  })

  it('infers keychain from a "llavero" mention', () => {
    expect(inferProductType('Llavero con nombre grabado')).toBe('keychain')
  })

  it('matches case-insensitively', () => {
    expect(inferProductType('TAZA GRANDE NEGRA')).toBe('cup')
  })

  it('falls back to other when no keyword matches', () => {
    expect(inferProductType('Soporte para celular, base redonda')).toBe(
      'other',
    )
  })

  it('falls back to other for blank text', () => {
    expect(inferProductType('')).toBe('other')
    expect(inferProductType('   ')).toBe('other')
  })
})

describe('emptyQuickOrderDraft', () => {
  it('defaults the due date to the standard lead time', () => {
    const monday = new Date(2026, 0, 5)
    expect(emptyQuickOrderDraft(monday).dueDate).toBe(defaultDueDate(monday))
  })

  it('leaves every other field blank', () => {
    const draft = emptyQuickOrderDraft()
    expect(draft.customerName).toBe('')
    expect(draft.detail).toBe('')
    expect(draft.totalAmount).toBe('')
    expect(draft.deposit).toBe('')
    expect(draft.originChannel).toBe('')
  })
})

describe('validateQuickOrder', () => {
  it('requires a customer name', () => {
    const errors = validateQuickOrder(quickDraftWith({ customerName: '' }))
    expect(errors.customerName).toBeTruthy()
  })

  it('passes with only a customer name set', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada' }),
    )
    expect(errors).toEqual({})
  })

  it('rejects a non-numeric total', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', totalAmount: 'abc' }),
    )
    expect(errors.totalAmount).toBeTruthy()
  })

  it('rejects a negative deposit', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', deposit: '-5' }),
    )
    expect(errors.deposit).toBeTruthy()
  })

  it('rejects a deposit set without a total', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', deposit: '50' }),
    )
    expect(errors.deposit).toBeTruthy()
  })

  it('rejects a deposit greater than the total', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', totalAmount: '100', deposit: '150' }),
    )
    expect(errors.deposit).toBeTruthy()
  })

  it('rejects a malformed due date', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', dueDate: 'not-a-date' }),
    )
    expect(errors.dueDate).toBeTruthy()
  })

  it('accepts a valid origin channel', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', originChannel: 'whatsapp' }),
    )
    expect(errors).toEqual({})
  })

  it('rejects an invalid origin channel', () => {
    const errors = validateQuickOrder(
      quickDraftWith({ customerName: 'Ada', originChannel: 'carrier-pigeon' }),
    )
    expect(errors.originChannel).toBeTruthy()
  })
})

describe('quickOrderPendingBalance', () => {
  it('is null when neither total nor deposit is set', () => {
    expect(quickOrderPendingBalance(quickDraftWith({}))).toBeNull()
  })

  it('is the total when no deposit is set', () => {
    expect(
      quickOrderPendingBalance(quickDraftWith({ totalAmount: '100' })),
    ).toBe(100)
  })

  it('is total minus deposit', () => {
    expect(
      quickOrderPendingBalance(
        quickDraftWith({ totalAmount: '100', deposit: '30' }),
      ),
    ).toBe(70)
  })
})

describe('quickOrderItem', () => {
  it('returns null for a blank detail', () => {
    expect(quickOrderItem('   ')).toBeNull()
  })

  it('builds a single item with the inferred product type', () => {
    expect(quickOrderItem('Taza con foto de perro')).toEqual({
      product_type: 'cup',
      description: 'Taza con foto de perro',
      personalization: null,
      quantity: 1,
      unit_price: null,
      line_total: null,
      position: 0,
    })
  })

  it('trims the detail text before storing it', () => {
    expect(quickOrderItem('  Llavero grabado  ')?.description).toBe(
      'Llavero grabado',
    )
  })
})

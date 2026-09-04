import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderRow, OrderWithCustomer } from './orders.api'
import { useQuickOrderDraft } from './useQuickOrderDraft'

// The API layer is mocked so the hook's own logic (validate → upsert
// customer → create order → attach the item, or bail with an error) is
// exercised without a network, mirroring how LoginPage.test.tsx mocks
// @/lib/supabase.

const { upsertCustomerMock, createOrderMock, replaceOrderItemsMock } =
  vi.hoisted(() => ({
    upsertCustomerMock: vi.fn(),
    createOrderMock: vi.fn(),
    replaceOrderItemsMock: vi.fn(),
  }))

vi.mock('./orders.api', () => ({
  upsertCustomer: upsertCustomerMock,
  createOrder: createOrderMock,
  replaceOrderItems: replaceOrderItemsMock,
}))

const CUSTOMER = { id: 'cust-1', name: 'Ada', phone: null }

function baseOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'order-1',
    customer_id: CUSTOMER.id,
    product_type: 'other',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-08',
    total_amount: null,
    deposit: null,
    pending_balance: null,
    payment_method: null,
    status: 'new',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    ...overrides,
  } as OrderRow
}

beforeEach(() => {
  vi.clearAllMocks()
  upsertCustomerMock.mockResolvedValue(CUSTOMER)
  createOrderMock.mockResolvedValue(baseOrderRow())
  replaceOrderItemsMock.mockResolvedValue(undefined)
})

describe('useQuickOrderDraft', () => {
  it('blocks submit and reports an error when the customer name is blank', async () => {
    const { result } = renderHook(() => useQuickOrderDraft())

    let created: OrderWithCustomer | null = null
    await act(async () => {
      created = await result.current.submit()
    })

    expect(created).toBeNull()
    expect(result.current.errors.customerName).toBeTruthy()
    expect(upsertCustomerMock).not.toHaveBeenCalled()
  })

  it('creates the customer and order, attaches the item, and resets the draft', async () => {
    const { result } = renderHook(() => useQuickOrderDraft())

    act(() => {
      result.current.setField('customerName', 'Ada')
      result.current.setField('detail', 'Taza con foto de perro')
      result.current.setField('totalAmount', '100')
      result.current.setField('deposit', '30')
    })

    let created: OrderWithCustomer | null = null
    await act(async () => {
      created = await result.current.submit()
    })

    expect(upsertCustomerMock).toHaveBeenCalledWith({ name: 'Ada' })
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cust-1',
        product_type: 'cup',
        total_amount: 100,
        deposit: 30,
        pending_balance: 70,
        status: 'new',
      }),
    )
    expect(replaceOrderItemsMock).toHaveBeenCalledWith('order-1', [
      expect.objectContaining({ description: 'Taza con foto de perro' }),
    ])
    expect(created).toEqual(
      expect.objectContaining({
        id: 'order-1',
        customers: { name: 'Ada', phone: null },
      }),
    )
    expect(result.current.draft.customerName).toBe('')
    expect(result.current.draft.detail).toBe('')
  })

  it('passes originChannel through as origin_channel, defaulting to null', async () => {
    const { result } = renderHook(() => useQuickOrderDraft())

    act(() => {
      result.current.setField('customerName', 'Ada')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ origin_channel: null }),
    )

    act(() => {
      result.current.setField('customerName', 'Beto')
      result.current.setField('originChannel', 'whatsapp')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(createOrderMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ origin_channel: 'whatsapp' }),
    )
  })

  it('skips replaceOrderItems when the detail is left blank', async () => {
    const { result } = renderHook(() => useQuickOrderDraft())
    act(() => {
      result.current.setField('customerName', 'Beto')
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(replaceOrderItemsMock).not.toHaveBeenCalled()
  })

  it('surfaces a submit error and keeps the draft when the API call fails', async () => {
    createOrderMock.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useQuickOrderDraft())
    act(() => {
      result.current.setField('customerName', 'Ada')
    })

    let created: OrderWithCustomer | null = null
    await act(async () => {
      created = await result.current.submit()
    })

    expect(created).toBeNull()
    expect(result.current.submitError).toBe('network down')
    expect(result.current.draft.customerName).toBe('Ada')
  })

  it('clears a field-level error as soon as that field changes', async () => {
    const { result } = renderHook(() => useQuickOrderDraft())
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.errors.customerName).toBeTruthy()

    act(() => {
      result.current.setField('customerName', 'Ada')
    })
    expect(result.current.errors.customerName).toBeUndefined()
  })

  it('reset() restores the empty draft and clears errors', () => {
    const { result } = renderHook(() => useQuickOrderDraft())
    act(() => {
      result.current.setField('customerName', 'Ada')
      result.current.setField('detail', 'Llavero')
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.draft.customerName).toBe('')
    expect(result.current.draft.detail).toBe('')
  })
})

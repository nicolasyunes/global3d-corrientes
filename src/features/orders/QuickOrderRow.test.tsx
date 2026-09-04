import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderRow } from './orders.api'
import QuickOrderRow from './QuickOrderRow'

// Same mocking strategy as useQuickOrderDraft.test.ts — the row is a thin
// presentation over that hook, so these tests exercise the actual submit
// wiring (Enter/click → save → onCreated) without a network.

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

describe('QuickOrderRow', () => {
  it('renders the six capture fields and the submit button', () => {
    render(<QuickOrderRow onCreated={vi.fn()} />)
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument()
    expect(screen.getByLabelText('Detalle')).toBeInTheDocument()
    expect(screen.getByLabelText('Medio')).toBeInTheDocument()
    expect(screen.getByLabelText('Entrega')).toBeInTheDocument()
    expect(screen.getByLabelText('Total')).toBeInTheDocument()
    expect(screen.getByLabelText('Seña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('passes the selected origin channel through to createOrder', async () => {
    const onCreated = vi.fn()
    render(<QuickOrderRow onCreated={onCreated} />)

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.change(screen.getByLabelText('Medio'), {
      target: { value: 'whatsapp' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await act(async () => {})

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ origin_channel: 'whatsapp' }),
    )
  })

  it('saves on submit, calls onCreated, and clears the row for the next entry', async () => {
    const onCreated = vi.fn()
    render(<QuickOrderRow onCreated={onCreated} />)

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Taza con foto de perro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await act(async () => {})

    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ product_type: 'cup' }),
    )
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
    )
    expect((screen.getByLabelText('Cliente') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Detalle') as HTMLInputElement).value).toBe('')
  })

  it('blocks submit and shows an error when the customer name is blank', async () => {
    const onCreated = vi.fn()
    render(<QuickOrderRow onCreated={onCreated} />)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await act(async () => {})

    expect(onCreated).not.toHaveBeenCalled()
    expect(createOrderMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ingresá el nombre del cliente.',
    )
  })

  it('shows the submit error banner when saving fails', async () => {
    createOrderMock.mockRejectedValue(new Error('network down'))
    render(<QuickOrderRow onCreated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await act(async () => {})

    expect(screen.getByRole('alert')).toHaveTextContent('network down')
  })

  it('clears the row on Escape without saving', () => {
    render(<QuickOrderRow onCreated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Llavero' },
    })
    fireEvent.keyDown(screen.getByLabelText('Cliente'), { key: 'Escape' })

    expect((screen.getByLabelText('Cliente') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Detalle') as HTMLInputElement).value).toBe('')
    expect(createOrderMock).not.toHaveBeenCalled()
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderRow } from './orders.api'
import QuickOrderSheet from './QuickOrderSheet'

// Same mocking strategy as QuickOrderRow.test.ts — the sheet is the mobile
// presentation over the same useQuickOrderDraft save path.

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

function renderSheet(props: Partial<React.ComponentProps<typeof QuickOrderSheet>> = {}) {
  return render(
    <MemoryRouter>
      <QuickOrderSheet
        open
        onClose={vi.fn()}
        onCreated={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('QuickOrderSheet', () => {
  it('renders nothing when closed', () => {
    renderSheet({ open: false })
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument()
  })

  it('renders the capture fields and a link to the full form when open', () => {
    renderSheet()
    expect(screen.getByLabelText('Cliente')).toBeInTheDocument()
    expect(screen.getByLabelText('Detalle')).toBeInTheDocument()
    expect(screen.getByLabelText('Entrega')).toBeInTheDocument()
    expect(screen.getByLabelText('Total')).toBeInTheDocument()
    expect(screen.getByLabelText('Seña')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Guardar y seguir' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /formulario completo/i })).toHaveAttribute(
      'href',
      '/admin/orders/new',
    )
  })

  it('saves on submit, calls onCreated, and keeps the sheet open', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    renderSheet({ onCreated, onClose })

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y seguir' }))
    await act(async () => {})

    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Cliente') as HTMLInputElement).value).toBe('')
  })

  it('blocks submit and shows an error when the customer name is blank', async () => {
    const onCreated = vi.fn()
    renderSheet({ onCreated })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar y seguir' }))
    await act(async () => {})

    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresá el nombre del cliente.')).toBeInTheDocument()
  })

  it('shows the submit error banner when saving fails', async () => {
    createOrderMock.mockRejectedValue(new Error('network down'))
    renderSheet()

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y seguir' }))
    await act(async () => {})

    expect(screen.getByRole('alert')).toHaveTextContent('network down')
  })

  it('calls onClose when the close button is tapped', () => {
    const onClose = vi.fn()
    renderSheet({ onClose })

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    renderSheet({ onClose })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

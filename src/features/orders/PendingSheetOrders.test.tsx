import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PendingSheetOrder } from './pendingSheet.api'
import type { OrderWithCustomer } from './orders.api'
import PendingSheetOrders from './PendingSheetOrders'

// listPendingSheetOrders + listAllOrders are mocked (no Edge Function / DB in
// tests); the real appOrderToSheetRow / mergeSheetOrders run so the merge and
// optimistic-add mapping are exercised.
const { listPendingSheetOrdersMock } = vi.hoisted(() => ({
  listPendingSheetOrdersMock: vi.fn(),
}))

vi.mock('./pendingSheet.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pendingSheet.api')>()),
  listPendingSheetOrders: listPendingSheetOrdersMock,
}))

const {
  upsertCustomerMock,
  createOrderMock,
  replaceOrderItemsMock,
  listAllOrdersMock,
} = vi.hoisted(() => ({
  upsertCustomerMock: vi.fn(),
  createOrderMock: vi.fn(),
  replaceOrderItemsMock: vi.fn(),
  listAllOrdersMock: vi.fn(),
}))

vi.mock('./orders.api', () => ({
  upsertCustomer: upsertCustomerMock,
  createOrder: createOrderMock,
  replaceOrderItems: replaceOrderItemsMock,
  listAllOrders: listAllOrdersMock,
}))

function sheetOrder(overrides: Partial<PendingSheetOrder> = {}): PendingSheetOrder {
  return {
    id: '',
    nombre: 'Ada',
    producto: 'Taza',
    detalles: '',
    fechaEntrega: '05/08/2026',
    fechaEntregaSortKey: '2026-08-05',
    total: 1000,
    saldo: 500,
    canal: 'WhatsApp',
    estado: '',
    ...overrides,
  }
}

const CUSTOMER = { id: 'cust-1', name: 'Grace', phone: null }

function createdOrder(
  overrides: Partial<OrderWithCustomer> = {},
): OrderWithCustomer {
  return {
    id: 'order-9',
    customer_id: CUSTOMER.id,
    product_type: 'trophy',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: '2026-09-01',
    due_date: '2026-09-15',
    total_amount: 4000,
    deposit: 1000,
    pending_balance: 3000,
    payment_method: null,
    status: 'new',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    origin_channel: 'whatsapp',
    reference_link: null,
    customers: { name: CUSTOMER.name, phone: null },
    ...overrides,
  } as OrderWithCustomer
}

beforeEach(() => {
  vi.clearAllMocks()
  upsertCustomerMock.mockResolvedValue(CUSTOMER)
  createOrderMock.mockResolvedValue(createdOrder())
  replaceOrderItemsMock.mockResolvedValue(undefined)
  listAllOrdersMock.mockResolvedValue([])
})

function renderTab() {
  return render(
    <MemoryRouter>
      <PendingSheetOrders />
    </MemoryRouter>,
  )
}

describe('PendingSheetOrders', () => {
  it('renders the sheet rows once loaded', async () => {
    listPendingSheetOrdersMock.mockResolvedValue([
      sheetOrder({ nombre: 'Ada' }),
      sheetOrder({ nombre: 'Linus', fechaEntregaSortKey: '2026-09-10' }),
    ])
    renderTab()

    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Linus')).toBeInTheDocument()
  })

  it('filters by delivery month', async () => {
    listPendingSheetOrdersMock.mockResolvedValue([
      sheetOrder({ nombre: 'August', fechaEntregaSortKey: '2026-08-05' }),
      sheetOrder({ nombre: 'September', fechaEntregaSortKey: '2026-09-10' }),
    ])
    renderTab()
    await screen.findByText('August')

    fireEvent.change(screen.getByLabelText('Filtrar por mes de entrega'), {
      target: { value: '2026-09' },
    })

    expect(screen.queryByText('August')).not.toBeInTheDocument()
    expect(screen.getByText('September')).toBeInTheDocument()
  })

  it('filters by estado, including cancelled rows', async () => {
    listPendingSheetOrdersMock.mockResolvedValue([
      sheetOrder({ nombre: 'Abierta', estado: '' }),
      sheetOrder({ nombre: 'Anulada', estado: 'Cancelado' }),
    ])
    renderTab()
    await screen.findByText('Anulada')

    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'cancelado' },
    })

    expect(screen.queryByText('Abierta')).not.toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
  })

  it('shows a "no coincide" message when filters exclude everything', async () => {
    listPendingSheetOrdersMock.mockResolvedValue([
      sheetOrder({ nombre: 'Ada', fechaEntregaSortKey: '2026-08-05' }),
    ])
    renderTab()
    await screen.findByText('Ada')

    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'entregado' },
    })

    expect(
      screen.getByText('Ningún pedido coincide con los filtros'),
    ).toBeInTheDocument()
  })

  it('merges app orders with the sheet, without duplicating the synced row', async () => {
    listAllOrdersMock.mockResolvedValue([
      createdOrder({
        id: 'order-9',
        due_date: '2026-09-15',
        customers: { name: 'Katherine', phone: null },
      }),
    ])
    listPendingSheetOrdersMock.mockResolvedValue([
      // stale mirror of order-9, already written to the sheet by the sync
      sheetOrder({ id: 'order-9', nombre: 'Katherine (vieja)' }),
      // a row typed straight into Google, no id
      sheetOrder({ id: '', nombre: 'Manual', fechaEntregaSortKey: '2026-09-20' }),
    ])
    renderTab()

    expect(await screen.findByText('Katherine')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.queryByText('Katherine (vieja)')).not.toBeInTheDocument()
  })

  it('adds a saved order to the list immediately (before the sheet sync)', async () => {
    listPendingSheetOrdersMock.mockResolvedValue([sheetOrder({ nombre: 'Ada' })])
    renderTab()
    await screen.findByText('Ada')

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: 'Grace' },
    })
    fireEvent.change(screen.getByLabelText('Entrega'), {
      target: { value: '2026-09-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    await act(async () => {})

    expect(createOrderMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument())
    const table = screen.getByRole('table')
    expect(within(table).getByText('Grace')).toBeInTheDocument()
  })
})

import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrderProduction from './OrderProduction'

const { getOrderMock, listOrderItemsMock, updateOrderMock } = vi.hoisted(() => ({
  getOrderMock: vi.fn(),
  listOrderItemsMock: vi.fn(),
  updateOrderMock: vi.fn(),
}))

vi.mock('./orders.api', () => ({
  getOrder: getOrderMock,
  listOrderItems: listOrderItemsMock,
  updateOrder: updateOrderMock,
}))
vi.mock('./OrderImages', () => ({ default: () => <div>IMAGES</div> }))
vi.mock('./ProductionChecklist', () => ({ default: () => <div>CHECKLIST</div> }))

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: { tapa: 'negro', base: 'blanco' },
    personalization: 'Feliz cumple Ada',
    measurements: '10x10 cm',
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-08',
    total_amount: 5000,
    deposit: 2000,
    pending_balance: 3000,
    payment_method: 'cash',
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: 'whatsapp',
    reference_link: 'https://makerworld.com/x',
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

async function renderAt(id = 'order-1') {
  const view = render(
    <MemoryRouter initialEntries={[`/admin/orders/${id}`]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderProduction />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  getOrderMock.mockResolvedValue(order())
  listOrderItemsMock.mockResolvedValue([])
  updateOrderMock.mockResolvedValue(order({ status: 'post_processing' }))
})

describe('OrderProduction', () => {
  it('shows the production spec: colours, measurements, engraving text', async () => {
    await renderAt()
    expect(screen.getByText('Qué hay que hacer')).toBeInTheDocument()
    expect(screen.getByText(/tapa:/)).toBeInTheDocument()
    expect(screen.getByText(/negro/)).toBeInTheDocument()
    expect(screen.getByText('10x10 cm')).toBeInTheDocument()
    expect(screen.getByText('Feliz cumple Ada')).toBeInTheDocument()
  })

  it('omits a spec row when its field is empty', async () => {
    getOrderMock.mockResolvedValue(
      order({ measurements: null, color_spec: {}, personalization: null }),
    )
    await renderAt()
    expect(screen.queryByText('Medidas')).not.toBeInTheDocument()
    expect(screen.queryByText('Colores')).not.toBeInTheDocument()
  })

  it('does not render commercial fields', async () => {
    await renderAt()
    expect(screen.queryByText(/Método de pago/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Canal de origen/i)).not.toBeInTheDocument()
    // status is 'printing' → saldo hidden
    expect(screen.queryByText(/Saldo pendiente/)).not.toBeInTheDocument()
  })

  it('shows the pending balance only when the order is finished', async () => {
    getOrderMock.mockResolvedValue(order({ status: 'finished' }))
    await renderAt()
    expect(screen.getByText(/Saldo pendiente: \$3\.000,00/)).toBeInTheDocument()
  })

  it('advances the production stage', async () => {
    await renderAt()
    const btn = screen.getByRole('button', {
      name: /Avanzar a Post-procesado/i,
    })
    await act(async () => {
      btn.click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'post_processing',
    })
  })

  it('links to the edit screen', async () => {
    await renderAt()
    expect(
      screen.getByRole('link', { name: /Datos y edición/i }),
    ).toHaveAttribute('href', '/admin/orders/order-1/editar')
  })
})

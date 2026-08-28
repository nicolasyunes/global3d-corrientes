import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrderEdit from './OrderEdit'

const { getOrderMock } = vi.hoisted(() => ({ getOrderMock: vi.fn() }))
vi.mock('./orders.api', () => ({ getOrder: getOrderMock }))
vi.mock('./OrderForm', () => ({
  default: ({
    initialOrder,
    onSaved,
  }: {
    initialOrder: OrderWithCustomer
    onSaved: (o: OrderWithCustomer) => void
  }) => (
    <div>
      <span>FORM {initialOrder.customers?.name}</span>
      <button type="button" onClick={() => onSaved(initialOrder)}>
        save
      </button>
    </div>
  ),
}))

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
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
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

async function renderEdit() {
  render(
    <MemoryRouter initialEntries={['/admin/orders/order-1/editar']}>
      <Routes>
        <Route path="/admin/orders/:id/editar" element={<OrderEdit />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
  getOrderMock.mockResolvedValue(order())
})

describe('OrderEdit', () => {
  it('renders OrderForm seeded with the loaded order', async () => {
    await renderEdit()
    expect(screen.getByText('FORM Ada')).toBeInTheDocument()
  })

  it('has no production stage controls', async () => {
    await renderEdit()
    expect(
      screen.queryByRole('button', { name: /Avanzar a/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Cancelar pedido/i }),
    ).not.toBeInTheDocument()
  })

  it('re-fetches the order after a save', async () => {
    await renderEdit()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      screen.getByRole('button', { name: 'save' }).click()
    })
    expect(getOrderMock).toHaveBeenCalledTimes(2)
  })

  it('links back to the production screen', async () => {
    await renderEdit()
    expect(
      screen.getByRole('link', { name: /Volver a producción/i }),
    ).toHaveAttribute('href', '/admin/orders/order-1')
  })
})

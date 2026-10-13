import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeliveredOrdersList from './DeliveredOrdersList'

const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: operator.isAdmin }),
}))
vi.mock('./orders.api', () => ({
  listDeliveredOrders: vi.fn().mockResolvedValue([
    {
      id: 'o1',
      due_date: '2026-10-07',
      total_amount: 55000,
      customers: { name: 'María', phone: null },
      title: null,
      product_type: 'cup',
      origin_channel: null,
    },
  ]),
}))
vi.mock('./productSales.api', () => ({
  listProductSales: vi.fn().mockResolvedValue([]),
  deleteProductSale: vi.fn(),
}))

function renderList() {
  return render(
    <MemoryRouter>
      <DeliveredOrdersList />
    </MemoryRouter>,
  )
}

describe('DeliveredOrdersList', () => {
  beforeEach(() => {
    operator.isAdmin = false
  })

  it('un operador ve el pedido pero no montos ni totales', async () => {
    renderList()
    expect(await screen.findByText(/María/)).toBeInTheDocument()
    expect(screen.queryByText(/\$55\.000/)).toBeNull()
    expect(screen.queryByText(/55\.000/)).toBeNull()
    expect(screen.queryByText('Total vendido')).toBeNull()
  })

  it('el admin ve los montos', async () => {
    operator.isAdmin = true
    renderList()
    expect(await screen.findAllByText(/55\.000/)).not.toHaveLength(0)
    expect(screen.getByText('Total vendido')).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { now } = vi.hoisted(() => ({ now: new Date().toISOString() }))

vi.mock('./sales.api', () => ({
  listSales: vi.fn().mockResolvedValue([
    {
      id: 'a',
      sold_at: now,
      channel: 'local',
      method: 'cash',
      amount: 23000,
      list_total: 24800,
      discount: 1800,
      operator_id: 'op1',
      voided_at: null,
      order_id: null,
      customer_id: null,
      customers: null,
      orders: null,
      sale_items: [{ description: 'Vaso Boca', quantity: 1, position: 0 }],
    },
    {
      id: 'b',
      sold_at: now,
      channel: 'web',
      method: 'transfer',
      amount: 10000,
      list_total: 10000,
      discount: 0,
      operator_id: null,
      voided_at: null,
      order_id: 'o1',
      customer_id: 'c1',
      customers: { name: 'Juan', wholesale: true },
      orders: { id: 'o1', title: 'Trofeos' },
      sale_items: [{ description: 'Trofeos', quantity: 1, position: 0 }],
    },
  ]),
  getSaleLog: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/products/products.api', () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op1' },
    isAdmin: true,
    operators: [{ id: 'op1', name: 'Nico', active: true }],
    byId: () => ({ name: 'Nico' }),
  }),
}))

import SalesPage from './SalesPage'

describe('SalesPage', () => {
  it('lista ventas de hoy con totales y filtra por canal', async () => {
    render(
      <MemoryRouter>
        <SalesPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Vaso Boca')).toBeInTheDocument()
    expect(screen.getByText('2 ventas')).toBeInTheDocument()
    expect(screen.getByText('$33.000')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Canal'), {
      target: { value: 'web' },
    })
    expect(screen.queryByText('Vaso Boca')).toBeNull()
    expect(screen.getByText('1 venta')).toBeInTheDocument()
  })

  it('solo mayoristas', async () => {
    render(
      <MemoryRouter>
        <SalesPage />
      </MemoryRouter>,
    )
    await screen.findByText('Vaso Boca')
    fireEvent.click(screen.getByLabelText('Solo mayoristas'))
    expect(screen.queryByText('Vaso Boca')).toBeNull()
    expect(screen.getByText('Trofeos')).toBeInTheDocument()
  })
})

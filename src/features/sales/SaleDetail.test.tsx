import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getSaleLog: vi.fn(),
  voidSale: vi.fn(),
  editSale: vi.fn(),
  createSale: vi.fn(),
  setCustomerWholesale: vi.fn(),
  searchSaleCustomers: vi.fn(),
}))
vi.mock('./sales.api', () => api)
vi.mock('@/features/products/products.api', () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}))
const op = vi.hoisted(() => ({
  value: {
    current: { id: 'adm' },
    isAdmin: true,
    byId: () => ({ name: 'Nico' }),
  } as unknown,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => op.value,
}))

import SaleDetail from './SaleDetail'

const sale = {
  id: 's1',
  sold_at: '2026-11-06T15:00:00Z',
  channel: 'local',
  method: 'cash',
  amount: 23000,
  list_total: 24800,
  discount: 1800,
  order_id: null,
  customer_id: null,
  voided_at: null,
  void_reason: null,
  operator_id: 'adm',
  note: null,
  sale_items: [
    {
      id: 'i1',
      sale_id: 's1',
      description: 'Vaso Boca',
      quantity: 1,
      list_unit_price: 24800,
      unit_price: 24800,
      position: 0,
      product_id: 'p1',
    },
  ],
  customers: null,
  orders: null,
} as never

function renderDetail(onChanged = vi.fn()) {
  render(
    <MemoryRouter>
      <SaleDetail sale={sale} onClose={() => {}} onChanged={onChanged} />
    </MemoryRouter>,
  )
  return onChanged
}

describe('SaleDetail', () => {
  beforeEach(() => {
    op.value = {
      current: { id: 'adm' },
      isAdmin: true,
      byId: () => ({ name: 'Nico' }),
    }
    api.getSaleLog.mockReset().mockResolvedValue([
      {
        id: 'l1',
        kind: 'created',
        operator_id: 'adm',
        reason: null,
        created_at: '2026-11-06T15:00:00Z',
      },
    ])
    api.voidSale.mockReset().mockResolvedValue('s1')
  })

  it('muestra líneas, totales e historial', async () => {
    renderDetail()
    expect(screen.getByText('Vaso Boca')).toBeInTheDocument()
    expect(screen.getByText('Cobrado $23.000')).toBeInTheDocument()
    expect(await screen.findByText('Creada por Nico')).toBeInTheDocument()
  })

  it('un admin anula con motivo', async () => {
    const onChanged = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect(
      screen.getByText('Escribí el motivo de la anulación.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'cargada dos veces' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    await waitFor(() =>
      expect(api.voidSale).toHaveBeenCalledWith(
        's1',
        'adm',
        'cargada dos veces',
      ),
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('quien no es admin ve el aviso y no los botones', () => {
    op.value = {
      current: { id: 'op1' },
      isAdmin: false,
      byId: () => ({ name: 'Ana' }),
    }
    renderDetail()
    expect(
      screen.getByText('Solo un admin puede corregir o anular'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull()
  })
})

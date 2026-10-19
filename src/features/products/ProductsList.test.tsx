import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from './products.api'

const { listProductsMock, listAllPartsMock, moveProductStockMock, operator } =
  vi.hoisted(() => ({
    listProductsMock: vi.fn(),
    listAllPartsMock: vi.fn(),
    moveProductStockMock: vi.fn(),
    operator: { isAdmin: false },
  }))

vi.mock('./products.api', () => ({
  listProducts: listProductsMock,
  listAllParts: listAllPartsMock,
  moveProductStock: moveProductStockMock,
}))

vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: operator.isAdmin }),
}))

import ProductsList from './ProductsList'

function row(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1',
    name: 'Vaso milkshake Spiderman',
    description: null,
    base_price: 15000,
    stock_quantity: 2,
    image_url: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listProductsMock.mockResolvedValue([
    row(),
    row({ id: 'p2', name: 'Llavero Zelda' }),
  ])
  listAllPartsMock.mockResolvedValue({
    p1: [
      { label: 'cabeza', color: 'rojo', quantity: 1 },
      { label: 'ojos', color: 'negro', quantity: 2 },
    ],
  })
  operator.isAdmin = false
  moveProductStockMock.mockResolvedValue(row({ stock_quantity: 3 }))
})

function renderList() {
  return render(
    <MemoryRouter>
      <ProductsList />
    </MemoryRouter>,
  )
}

describe('ProductsList', () => {
  it('muestra el resumen de piezas de cada producto', async () => {
    renderList()
    expect(await screen.findByText('2 piezas · rojo, negro')).toBeVisible()
    expect(screen.getByText('Sin piezas')).toBeVisible()
  })

  it('filtra por nombre', async () => {
    renderList()
    await screen.findByText('Llavero Zelda')
    fireEvent.change(screen.getByLabelText('Buscar producto'), {
      target: { value: 'zelda' },
    })
    expect(screen.queryByText('Vaso milkshake Spiderman')).toBeNull()
  })

  it('suma stock desde la fila, a nombre de quien está trabajando', async () => {
    renderList()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Sumar stock de Vaso milkshake Spiderman',
      }),
    )
    await waitFor(() =>
      expect(moveProductStockMock).toHaveBeenCalledWith('p1', 1, 'op-1'),
    )
  })

  it('a quien no es admin no le muestra precios ni movimientos', async () => {
    renderList()
    await screen.findByText('Llavero Zelda')
    expect(screen.queryByText(/15\.000/)).toBeNull()
    expect(screen.queryByText('Movimientos')).toBeNull()
  })

  it('al admin le muestra precios y el link a movimientos', async () => {
    operator.isAdmin = true
    renderList()
    await screen.findByText('Llavero Zelda')
    expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0)
    expect(screen.getByText('Movimientos')).toBeVisible()
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from './products.api'

const {
  listProductsMock,
  listAllPartsMock,
  moveProductStockMock,
  listProductLogMock,
  operator,
} = vi.hoisted(() => ({
  listProductsMock: vi.fn(),
  listAllPartsMock: vi.fn(),
  moveProductStockMock: vi.fn(),
  listProductLogMock: vi.fn(),
  operator: { isAdmin: false },
}))

vi.mock('./products.api', () => ({
  listProducts: listProductsMock,
  listAllParts: listAllPartsMock,
  moveProductStock: moveProductStockMock,
  listProductLog: listProductLogMock,
}))

vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    isAdmin: operator.isAdmin,
    byId: (id: string | null) =>
      id === 'op-1'
        ? { id: 'op-1', name: 'nicolas', initials: 'NI', color: '#f60' }
        : undefined,
  }),
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
    ship_box: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  operator.isAdmin = false
  listProductLogMock.mockResolvedValue([])
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

  it('todo el equipo ve los precios; el link a movimientos es solo del admin', async () => {
    renderList()
    await screen.findByText('Llavero Zelda')
    expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Movimientos')).toBeNull()
  })

  it('al admin le muestra el link a movimientos', async () => {
    operator.isAdmin = true
    renderList()
    await screen.findByText('Llavero Zelda')
    expect(screen.getByText('Movimientos')).toBeVisible()
  })

  it('muestra quién creó o cambió cada producto', async () => {
    listProductsMock.mockResolvedValue([row()])
    listAllPartsMock.mockResolvedValue({})
    listProductLogMock.mockResolvedValue([
      {
        id: 'l1',
        created_at: new Date().toISOString(),
        operator_id: 'op-1',
        kind: 'created',
        product_id: 'p1',
        product_label: 'Vaso milkshake Spiderman',
        delta: 2,
        stock_after: 2,
        note: null,
      },
    ])
    render(
      <MemoryRouter>
        <ProductsList />
      </MemoryRouter>,
    )
    const activity = await screen.findByRole('region', { name: 'Actividad' })
    await waitFor(() =>
      expect(activity.textContent).toContain(
        'nicolas creó Vaso milkshake Spiderman',
      ),
    )
    expect(activity.textContent).toContain('Stock inicial 2')
  })
})

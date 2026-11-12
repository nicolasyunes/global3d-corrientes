import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from './products.api'

const {
  listProductsMock,
  listAllPartsMock,
  moveProductStockMock,
  listProductLogMock,
  listProductCatalogMock,
  operator,
} = vi.hoisted(() => ({
  listProductCatalogMock: vi.fn(),
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
  listProductCatalog: listProductCatalogMock,
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
  listProductCatalogMock.mockResolvedValue({ byProduct: {}, families: [] })
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
    await waitFor(() =>
      expect(screen.queryByText('Vaso milkshake Spiderman')).toBeNull(),
    )
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

  it('busca por familia sin acentos y combina con los filtros', async () => {
    const vasos = {
      id: 'f1',
      name: 'Vasos Pistón',
      slug: 'vasos-piston',
      category: 'vasos',
      saleMode: 'stock',
      leadDays: 3,
    }
    listProductsMock.mockResolvedValue([
      row(),
      row({ id: 'p2', name: 'Llavero Zelda' }),
      row({ id: 'p3', name: 'Vaso rojo', stock_quantity: 0 }),
    ])
    listProductCatalogMock.mockResolvedValue({
      byProduct: {
        p1: { family: vasos, mlStatus: 'active' },
        p3: { family: vasos, mlStatus: null },
      },
      families: [vasos],
    })
    renderList()
    await screen.findByText('Llavero Zelda')
    fireEvent.change(screen.getByLabelText('Buscar producto'), {
      target: { value: 'PISTON' },
    })
    await waitFor(() => expect(screen.queryByText('Llavero Zelda')).toBeNull())
    expect(screen.getByText('Vaso rojo')).toBeVisible()
    fireEvent.change(screen.getByLabelText('MercadoLibre'), {
      target: { value: 'active' },
    })
    expect(screen.queryByText('Vaso rojo')).toBeNull()
    expect(screen.getByText('Vaso milkshake Spiderman')).toBeVisible()
    expect(screen.getByText('1 de 3 productos')).toBeVisible()
    fireEvent.click(screen.getAllByText('Limpiar filtros')[0])
    expect(await screen.findByText('Llavero Zelda')).toBeVisible()
  })

  it('ya no muestra la actividad abajo de la lista', async () => {
    renderList()
    await screen.findByText('Llavero Zelda')
    expect(screen.queryByRole('region', { name: 'Actividad' })).toBeNull()
  })
})

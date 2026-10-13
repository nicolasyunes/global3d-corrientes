import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from './products.api'

const { listProductsMock, listAllPartsMock, updateProductMock } = vi.hoisted(
  () => ({
    listProductsMock: vi.fn(),
    listAllPartsMock: vi.fn(),
    updateProductMock: vi.fn(),
  }),
)

vi.mock('./products.api', () => ({
  listProducts: listProductsMock,
  listAllParts: listAllPartsMock,
  updateProduct: updateProductMock,
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
  updateProductMock.mockResolvedValue(row())
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

  it('suma stock desde la fila', async () => {
    renderList()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Sumar stock de Vaso milkshake Spiderman',
      }),
    )
    await waitFor(() =>
      expect(updateProductMock).toHaveBeenCalledWith('p1', {
        stock_quantity: 3,
      }),
    )
  })
})

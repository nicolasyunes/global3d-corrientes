import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from './products.api'

const {
  listProductsMock,
  listCategoriesMock,
  updateProductMock,
  createProductMock,
  bulkUpdateProductsMock,
} = vi.hoisted(() => ({
  listProductsMock: vi.fn(),
  listCategoriesMock: vi.fn(),
  updateProductMock: vi.fn(),
  createProductMock: vi.fn(),
  bulkUpdateProductsMock: vi.fn(),
}))

vi.mock('./products.api', () => ({
  listProducts: listProductsMock,
  listCategories: listCategoriesMock,
  updateProduct: updateProductMock,
  createProduct: createProductMock,
  bulkUpdateProducts: bulkUpdateProductsMock,
}))

import ProductsList from './ProductsList'

function row(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1',
    name: 'Llavero Zelda',
    description: null,
    base_price: 1500,
    compare_at_price: null,
    stock_quantity: 10,
    image_url: null,
    active: true,
    slug: 'llavero-zelda',
    sku: null,
    custom_on_request: false,
    personalizable: false,
    weight_grams: null,
    category_id: 'c1',
    subcategory: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}
const CATS = [
  {
    id: 'c1',
    slug: 'llaveros',
    name: 'Llaveros',
    icon: '🔑',
    position: 5,
    featured: false,
    created_at: '',
    updated_at: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  listProductsMock.mockResolvedValue([row()])
  listCategoriesMock.mockResolvedValue(CATS)
  updateProductMock.mockImplementation((_id, patch) =>
    Promise.resolve({ ...row(), ...patch }),
  )
  createProductMock.mockResolvedValue(
    row({ id: 'p2', name: 'Nuevo', slug: 'nuevo' }),
  )
  bulkUpdateProductsMock.mockResolvedValue(undefined)
})

function renderList() {
  return render(
    <MemoryRouter>
      <ProductsList />
    </MemoryRouter>,
  )
}

describe('ProductsList (grilla)', () => {
  it('edita el precio inline y autoguarda al blur', async () => {
    renderList()
    const priceInput = await screen.findByLabelText('Precio de Llavero Zelda')
    fireEvent.change(priceInput, { target: { value: '1800' } })
    fireEvent.blur(priceInput)
    await waitFor(() =>
      expect(updateProductMock).toHaveBeenCalledWith('p1', {
        base_price: 1800,
      }),
    )
  })

  it('la fila de alta rápida crea un producto', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: /\+ producto/i }))
    fireEvent.change(screen.getByLabelText('Nombre del nuevo producto'), {
      target: { value: 'Nuevo' },
    })
    fireEvent.change(screen.getByLabelText('Precio del nuevo producto'), {
      target: { value: '999' },
    })
    fireEvent.submit(screen.getByTestId('quick-add-form'))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))
    expect(createProductMock.mock.calls[0][0]).toMatchObject({
      name: 'Nuevo',
      slug: 'nuevo',
      base_price: 999,
      stock_quantity: 0,
      active: true,
    })
  })

  it('desactiva en masa las filas tildadas', async () => {
    listProductsMock.mockResolvedValue([row(), row({ id: 'p2', name: 'Otro' })])
    renderList()
    const checks = await screen.findAllByLabelText(/seleccionar/i)
    fireEvent.click(checks[0])
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }))
    await waitFor(() =>
      expect(bulkUpdateProductsMock).toHaveBeenCalledWith(['p1'], {
        active: false,
      }),
    )
  })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getProductMock,
  createProductMock,
  updateProductMock,
  listProductImagesMock,
  listProductPartsMock,
  saveProductPartsMock,
  uploadProductImageMock,
} = vi.hoisted(() => ({
  uploadProductImageMock: vi.fn(),
  getProductMock: vi.fn(),
  createProductMock: vi.fn(),
  updateProductMock: vi.fn(),
  listProductImagesMock: vi.fn(),
  listProductPartsMock: vi.fn(),
  saveProductPartsMock: vi.fn(),
}))

vi.mock('./products.api', () => ({
  getProduct: getProductMock,
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  listProductImages: listProductImagesMock,
  listProductParts: listProductPartsMock,
  saveProductParts: saveProductPartsMock,
  uploadProductImage: uploadProductImageMock,
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
}))

import ProductForm from './ProductForm'

beforeEach(() => {
  vi.clearAllMocks()
  listProductImagesMock.mockResolvedValue([])
  listProductPartsMock.mockResolvedValue([])
  createProductMock.mockResolvedValue({ id: 'new-1' })
  updateProductMock.mockResolvedValue({ id: 'p1' })
  saveProductPartsMock.mockResolvedValue(undefined)
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/productos/nuevo" element={<ProductForm />} />
        <Route path="/admin/productos" element={<div>lista</div>} />
        <Route path="/admin/productos/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProductForm', () => {
  it('bloquea el guardado si falta el nombre', async () => {
    renderAt('/admin/productos/nuevo')
    fireEvent.click(await screen.findByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument()
    expect(createProductMock).not.toHaveBeenCalled()
  })

  it('crea el producto con sus piezas y colores', async () => {
    renderAt('/admin/productos/nuevo')
    fireEvent.change(await screen.findByLabelText('Nombre del producto'), {
      target: { value: 'Vaso milkshake Spiderman' },
    })
    fireEvent.change(screen.getByLabelText('Precio de lista ($)'), {
      target: { value: '15.000' },
    })
    fireEvent.change(screen.getByLabelText('Pieza 1'), {
      target: { value: 'cabeza' },
    })
    fireEvent.change(screen.getByLabelText('Color de la pieza 1'), {
      target: { value: 'rojo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /agregar pieza/i }))
    fireEvent.change(screen.getByLabelText('Pieza 2'), {
      target: { value: 'ojos' },
    })
    fireEvent.change(screen.getByLabelText('Color de la pieza 2'), {
      target: { value: 'negro' },
    })
    fireEvent.change(
      screen.getByLabelText('Cantidad por unidad de la pieza 2'),
      { target: { value: '2' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(saveProductPartsMock).toHaveBeenCalledTimes(1))
    expect(createProductMock.mock.calls[0][0]).toMatchObject({
      name: 'Vaso milkshake Spiderman',
      base_price: 15000,
    })
    expect(saveProductPartsMock).toHaveBeenCalledWith('new-1', [
      { label: 'cabeza', color: 'rojo', quantity: 1 },
      { label: 'ojos', color: 'negro', quantity: 2 },
    ])
  })

  it('carga las piezas guardadas al editar', async () => {
    getProductMock.mockResolvedValue({
      id: 'p1',
      name: 'Vaso Spiderman',
      description: null,
      base_price: null,
      stock_quantity: 0,
      active: true,
    })
    listProductPartsMock.mockResolvedValue([
      {
        id: 'x',
        product_id: 'p1',
        label: 'manos',
        color: 'rojo',
        quantity: 2,
        position: 0,
        created_at: '',
      },
    ])
    renderAt('/admin/productos/p1')
    expect(await screen.findByDisplayValue('manos')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Cantidad por unidad de la pieza 1'),
    ).toHaveValue(2)
  })

  it('sube las fotos elegidas después de crear el producto', async () => {
    renderAt('/admin/productos/nuevo')
    fireEvent.change(await screen.findByLabelText('Nombre del producto'), {
      target: { value: 'Vasos buddy' },
    })
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/agregar fotos/i), {
      target: { files: [file] },
    })
    expect(await screen.findByText('Portada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))
    await waitFor(() =>
      expect(uploadProductImageMock).toHaveBeenCalledWith('new-1', file, 0),
    )
    expect(await screen.findByText('lista')).toBeInTheDocument()
  })
})

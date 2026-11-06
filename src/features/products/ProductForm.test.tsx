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

vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    byId: (id: string | null) =>
      id === 'op-1'
        ? { id: 'op-1', name: 'nicolas', initials: 'NI', color: '#f60' }
        : undefined,
  }),
}))

vi.mock('./products.api', () => ({
  getProduct: getProductMock,
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  listProductImages: listProductImagesMock,
  listProductParts: listProductPartsMock,
  saveProductParts: saveProductPartsMock,
  uploadProductImage: uploadProductImageMock,
  listProductLog: () => Promise.resolve([]),
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
}))

const { listShopFamiliesMock, saveProductShopLinkMock } = vi.hoisted(() => ({
  listShopFamiliesMock: vi.fn(),
  saveProductShopLinkMock: vi.fn(),
}))

vi.mock('./shopLink.api', async (orig) => ({
  ...(await orig<typeof import('./shopLink.api')>()),
  listShopFamilies: listShopFamiliesMock,
  saveProductShopLink: saveProductShopLinkMock,
}))

const VASO = {
  id: 'fam-vaso',
  slug: 'vaso-camiseta',
  name: 'Vaso camiseta',
  category: 'vasos',
  published: true,
  axes: [
    { key: 'tamano', label: 'Tamaño' },
    { key: 'diseno', label: 'Equipo' },
  ],
  members: [
    {
      productId: 'p1',
      values: { tamano: '650 ml', diseno: 'River' },
      position: 0,
    },
    { productId: 'p2', values: { tamano: '1 L', diseno: 'Boca' }, position: 1 },
  ],
}

import ProductForm from './ProductForm'

beforeEach(() => {
  vi.clearAllMocks()
  listShopFamiliesMock.mockResolvedValue([VASO])
  saveProductShopLinkMock.mockResolvedValue(undefined)
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

  it('asigna un producto nuevo a una ficha de la tienda con sus opciones', async () => {
    renderAt('/admin/productos/nuevo')
    fireEvent.change(await screen.findByLabelText('Nombre del producto'), {
      target: { value: 'Vaso camiseta 1L River' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'En una ficha que ya existe' }),
    )
    fireEvent.change(screen.getByLabelText('Ficha de la tienda'), {
      target: { value: 'fam-vaso' },
    })
    fireEvent.change(screen.getByLabelText('Tamaño'), {
      target: { value: '1 L' },
    })
    fireEvent.change(screen.getByLabelText('Equipo'), {
      target: { value: 'River' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(saveProductShopLinkMock).toHaveBeenCalledWith(
        'new-1',
        expect.objectContaining({
          mode: 'existing',
          familyId: 'fam-vaso',
          options: { tamano: '1 L', diseno: 'River' },
        }),
        [VASO],
      ),
    )
  })

  it('no guarda si falta una opción o repite la de otro producto', async () => {
    renderAt('/admin/productos/nuevo')
    fireEvent.change(await screen.findByLabelText('Nombre del producto'), {
      target: { value: 'Otro vaso' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'En una ficha que ya existe' }),
    )
    fireEvent.change(screen.getByLabelText('Ficha de la tienda'), {
      target: { value: 'fam-vaso' },
    })
    fireEvent.change(screen.getByLabelText('Tamaño'), {
      target: { value: '650 ml' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('Completá equipo.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Equipo'), {
      target: { value: 'river' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(
      await screen.findByText(
        /Ya hay otro producto con Tamaño 650 ml y Equipo river/,
      ),
    ).toBeInTheDocument()
    expect(createProductMock).not.toHaveBeenCalled()
  })

  it('cambia el precio de un producto que ya tuvo ventas sin tocar su stock', async () => {
    getProductMock.mockResolvedValue({
      id: 'p1',
      name: 'Vaso Camiseta 650 ml BOCA',
      description: null,
      base_price: 24800,
      stock_quantity: 0, // la venta lo dejó en 0
      active: true,
    })
    renderAt('/admin/productos/p1')
    const price = await screen.findByLabelText('Precio de lista ($)')
    expect(price).toHaveValue('24800')
    fireEvent.change(price, { target: { value: '26.500' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar producto/i }))
    await waitFor(() => expect(updateProductMock).toHaveBeenCalledTimes(1))
    const [id, patch] = updateProductMock.mock.calls[0]
    expect(id).toBe('p1')
    expect(patch).toMatchObject({ base_price: 26500, updated_by: 'op-1' })
    expect(patch).not.toHaveProperty('stock_quantity')
    expect(await screen.findByText('lista')).toBeInTheDocument()
  })

  it('al editar muestra la ficha en la que ya está el producto', async () => {
    getProductMock.mockResolvedValue({
      id: 'p1',
      name: 'Vaso camiseta 650 River',
      description: null,
      base_price: 22500,
      stock_quantity: 1,
      active: true,
    })
    renderAt('/admin/productos/p1')
    expect(await screen.findByLabelText('Ficha de la tienda')).toHaveValue(
      'fam-vaso',
    )
    expect(screen.getByLabelText('Equipo')).toHaveValue('River')
  })
})

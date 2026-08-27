import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getProductMock,
  createProductMock,
  updateProductMock,
  listCategoriesMock,
  listProductImagesMock,
} = vi.hoisted(() => ({
  getProductMock: vi.fn(),
  createProductMock: vi.fn(),
  updateProductMock: vi.fn(),
  listCategoriesMock: vi.fn(),
  listProductImagesMock: vi.fn(),
}))

vi.mock('./products.api', () => ({
  getProduct: getProductMock,
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  listCategories: listCategoriesMock,
  listProductImages: listProductImagesMock,
  uploadProductImage: vi.fn(),
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
}))

import ProductForm from './ProductForm'

const CATS = [
  {
    id: 'c1',
    slug: 'llaveros',
    name: 'Llaveros y Merch',
    icon: '🔑',
    position: 5,
    featured: false,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'c2',
    slug: 'trofeos',
    name: 'Trofeos y Premios',
    icon: '🏆',
    position: 6,
    featured: false,
    created_at: '',
    updated_at: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  listCategoriesMock.mockResolvedValue(CATS)
  listProductImagesMock.mockResolvedValue([])
  createProductMock.mockResolvedValue({ id: 'new-1' })
  updateProductMock.mockResolvedValue({ id: 'new-1' })
})

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/admin/productos/nuevo']}>
      <Routes>
        <Route path="/admin/productos/nuevo" element={<ProductForm />} />
        <Route path="/admin/productos" element={<div>lista</div>} />
        <Route path="/admin/productos/:id" element={<div>editor detalle</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProductForm (alta)', () => {
  it('autogenera el slug desde el nombre', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Vaso Fernetero Boca' },
    })
    expect(screen.getByLabelText('Slug')).toHaveValue('vaso-fernetero-boca')
  })

  it('bloquea el guardado si falta el nombre', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument()
    expect(createProductMock).not.toHaveBeenCalled()
  })

  it('guarda y crea el producto con la organización elegida', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Trofeo pádel' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'c2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))
    expect(createProductMock.mock.calls[0][0]).toMatchObject({
      name: 'Trofeo pádel',
      category_id: 'c2',
      slug: 'trofeo-padel',
    })
  })

  it('las opciones de subcategoría dependen de la categoría', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'c2' },
    })
    const sub = screen.getByLabelText('Subcategoría') as HTMLSelectElement
    const opts = Array.from(sub.options).map((o) => o.value)
    expect(opts).toEqual(['', 'deportivos', 'placas'])
  })
})

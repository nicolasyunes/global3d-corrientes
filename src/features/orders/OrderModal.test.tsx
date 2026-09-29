import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createMock, uploadMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  uploadMock: vi.fn(),
}))

vi.mock('./orderSave.api', () => ({
  createOrderFromDraft: createMock,
  updateOrderFromDraft: vi.fn(),
  loadDraft: vi.fn(),
  listProductSuggestions: vi.fn().mockResolvedValue([]),
  searchCustomers: vi.fn().mockResolvedValue([]),
}))
vi.mock('./orderImages.api', async () => {
  const actual =
    await vi.importActual<typeof import('./orderImages.api')>(
      './orderImages.api',
    )
  return {
    ...actual,
    uploadOrderImage: uploadMock,
    listOrderImages: vi.fn().mockResolvedValue([]),
    deleteOrderImage: vi.fn(),
    publicImageUrl: (p: string) => `https://files/${p}`,
  }
})
vi.mock('@/features/products/products.api', () => ({
  listProductTemplates: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' } }),
}))

import OrderModal from './OrderModal'

beforeEach(() => {
  vi.clearAllMocks()
  createMock.mockResolvedValue({ id: 'order-9' })
  uploadMock.mockResolvedValue({})
})

function fillRequired() {
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'Juan Pérez' },
  })
  fireEvent.change(screen.getByLabelText('Producto'), {
    target: { value: 'Vaso Boca' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Mañana' }))
}

describe('OrderModal — archivos', () => {
  it('guarda el pedido y después sube los archivos con su tipo', async () => {
    const onSaved = vi.fn()
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={onSaved} />)
    fillRequired()

    fireEvent.click(screen.getByRole('button', { name: 'Comprobante' }))
    fireEvent.change(screen.getByLabelText('Nota del archivo'), {
      target: { value: 'seña' },
    })
    const file = new File(['x'], 'recibo.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/agregar archivo/i), {
      target: { files: [file] },
    })
    expect(screen.getByText('Comprobante · seña')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar pedido y 1 archivo' }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0]).toMatchObject({
      customerName: 'Juan Pérez',
    })
    expect(uploadMock).toHaveBeenCalledWith(
      'order-9',
      file,
      'Comprobante · seña',
    )
    expect(onSaved.mock.calls[0][1]).toBeUndefined()
  })

  it('si un archivo falla, el pedido queda guardado y avisa', async () => {
    uploadMock.mockRejectedValue(new Error('storage down'))
    const onSaved = vi.fn()
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={onSaved} />)
    fillRequired()
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/agregar archivo/i), {
      target: { files: [file] },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar pedido y 1 archivo' }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onSaved.mock.calls[0][1]).toMatch(/no se pudo subir: foto\.jpg/)
  })

  it('rechaza archivos que no son imagen ni PDF', () => {
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    const file = new File(['x'], 'datos.zip', { type: 'application/zip' })
    fireEvent.change(screen.getByLabelText(/agregar archivo/i), {
      target: { files: [file] },
    })
    expect(
      screen.getByText('Solo imágenes (JPG, PNG, WEBP…) o PDF.'),
    ).toBeInTheDocument()
  })
})

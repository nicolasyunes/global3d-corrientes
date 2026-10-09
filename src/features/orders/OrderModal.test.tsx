import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createMock, uploadMock, updateMock, loadDraftMock } = vi.hoisted(
  () => ({
    createMock: vi.fn(),
    uploadMock: vi.fn(),
    updateMock: vi.fn(),
    loadDraftMock: vi.fn(),
  }),
)

vi.mock('./orderSave.api', () => ({
  createOrderFromDraft: createMock,
  updateOrderFromDraft: updateMock,
  loadDraft: loadDraftMock,
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
import { emptyDraft, emptyItem } from './orderDraft'

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
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Canal' })).getByRole('button', {
      name: 'WhatsApp negocio',
    }),
  )
}

function fillWithoutChannel() {
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

describe('OrderModal — cobros y canal', () => {
  const save = () =>
    fireEvent.click(screen.getByRole('button', { name: /^Guardar pedido/ }))

  it('al crear, no deja guardar sin canal', async () => {
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    fillWithoutChannel()
    expect(screen.getByText('Canal (obligatorio)')).toBeInTheDocument()
    save()
    expect(await screen.findByText('Elegí el canal.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('con seña pide el medio de pago', async () => {
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    fillRequired()
    fireEvent.change(screen.getByLabelText('Total ($)'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByLabelText('Seña ($)'), {
      target: { value: '3000' },
    })
    save()
    expect(
      await screen.findByText('Elegí cómo pagó la seña.'),
    ).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Medio de la seña' })).getByRole(
        'button',
        { name: 'Efectivo' },
      ),
    )
    save()
    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deposit: '3000',
        depositMethod: 'cash',
        channel: expect.any(String),
      }),
      expect.anything(),
    )
  })

  it('el grupo de medios no aparece sin seña', () => {
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByRole('group', { name: 'Medio de la seña' })).toBeNull()
  })

  it('al editar, la seña no se puede cambiar y no pide canal', async () => {
    loadDraftMock.mockResolvedValue({
      ...emptyDraft(),
      customerName: 'Juan Pérez',
      items: [{ ...emptyItem(), id: 'i1', product: 'Vaso Boca' }],
      dueDate: '2026-12-01',
      total: '5000',
      deposit: '2000',
      channel: null,
    })
    updateMock.mockResolvedValue({ id: 'o1' })
    render(<OrderModal orderId="o1" onClose={vi.fn()} onSaved={vi.fn()} />)
    const deposit = await screen.findByLabelText('Seña ($)')
    expect(deposit).toBeDisabled()
    expect(
      screen.getByText('Los cobros se registran desde el pedido.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Medio de la seña' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(screen.queryByText('Elegí el canal.')).toBeNull()
  })

  it('muestra el aviso si la seña no se pudo registrar', async () => {
    createMock.mockResolvedValue({
      id: 'o1',
      paymentWarning:
        'Pedido guardado, pero no se pudo registrar la seña: x. Registrala desde el pedido.',
    })
    const onSaved = vi.fn()
    render(<OrderModal orderId={null} onClose={vi.fn()} onSaved={onSaved} />)
    fillRequired()
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('no se pudo registrar la seña'),
    )
  })
})

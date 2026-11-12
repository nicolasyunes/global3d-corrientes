import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  createSale: vi.fn(),
  editSale: vi.fn(),
  setCustomerWholesale: vi.fn(),
  searchSaleCustomers: vi.fn(),
}))
vi.mock('./sales.api', () => api)
vi.mock('@/features/products/products.api', () => ({
  listProducts: vi.fn().mockResolvedValue([
    {
      id: 'p1',
      name: 'Vaso Camiseta 650 ml BOCA',
      base_price: 24800,
      stock_quantity: 3,
      active: true,
      description: null,
    },
    {
      id: 'p2',
      name: 'Llavero River',
      base_price: 3000,
      stock_quantity: 10,
      active: true,
      description: null,
    },
  ]),
}))
const op = vi.hoisted(() => ({
  value: { current: { id: 'op1', name: 'Nico' }, isAdmin: false } as {
    current: { id: string; name: string } | null
    isAdmin: boolean
  },
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => op.value,
}))

import NewSaleSheet from './NewSaleSheet'

function typeEnter(el: HTMLElement, text: string) {
  fireEvent.change(el, { target: { value: text } })
  fireEvent.keyDown(el, { key: 'Enter' })
}

describe('NewSaleSheet', () => {
  beforeEach(() => {
    api.createSale.mockReset().mockResolvedValue('s1')
    api.editSale.mockReset().mockResolvedValue('s1')
    api.searchSaleCustomers.mockReset().mockResolvedValue([])
    op.value = { current: { id: 'op1', name: 'Nico' }, isAdmin: false }
  })

  it('busca por palabras, agrega con Enter, aplica descuento y guarda', async () => {
    const onSaved = vi.fn()
    render(<NewSaleSheet open onClose={() => {}} onSaved={onSaved} />)
    const search = await screen.findByLabelText('Buscar producto')
    await screen.findByPlaceholderText('Buscá o escribí un producto')
    typeEnter(search, 'vaso boca')
    expect(
      screen.getByLabelText('Cantidad de Vaso Camiseta 650 ml BOCA'),
    ).toBeInTheDocument()
    typeEnter(screen.getByLabelText('Descuento'), '1.800')
    expect(screen.getByText('Cobrás $23.000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('s1'))
    expect(api.createSale).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'cash',
        discount: 1800,
        channel: 'local',
        items: [
          expect.objectContaining({
            product_id: 'p1',
            quantity: 1,
            unit_price: 24800,
          }),
        ],
      }),
      'op1',
    )
  })

  it('muestra los errores y no guarda sin medio de pago', async () => {
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    await screen.findByPlaceholderText('Buscá o escribí un producto')
    fireEvent.change(screen.getByLabelText('Buscar producto'), {
      target: { value: 'llavero' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    expect(screen.getByText('Elegí el medio de pago')).toBeInTheDocument()
    expect(api.createSale).not.toHaveBeenCalled()
  })

  it('texto libre cuando no hay coincidencias', async () => {
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    await screen.findByPlaceholderText('Buscá o escribí un producto')
    typeEnter(screen.getByLabelText('Buscar producto'), 'Cartel a medida')
    expect(screen.getByDisplayValue('Cartel a medida')).toBeInTheDocument()
  })

  it('el error de la base se muestra tal cual', async () => {
    api.createSale.mockRejectedValue(new Error('No hay stock suficiente de X'))
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    await screen.findByPlaceholderText('Buscá o escribí un producto')
    typeEnter(screen.getByLabelText('Buscar producto'), 'llavero')
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    expect(
      await screen.findByText('No hay stock suficiente de X'),
    ).toBeInTheDocument()
  })

  it('sin persona activa pide el PIN y no deja guardar', async () => {
    op.value = { current: null, isAdmin: false }
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    expect(
      await screen.findByText('Poné tu PIN para cargar ventas'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar venta' })).toBeDisabled()
  })

  it('en modo corregir arranca con la venta y llama a editSale', async () => {
    const onSaved = vi.fn()
    const editing = {
      id: 's9',
      channel: 'local',
      method: 'transfer',
      customer_id: null,
      note: null,
      discount: 0,
      customers: null,
      sale_items: [
        {
          id: 'i1',
          sale_id: 's9',
          position: 0,
          product_id: 'p2',
          description: 'Llavero River',
          quantity: 2,
          list_unit_price: 3000,
          unit_price: 3000,
        },
      ],
    } as never
    render(
      <NewSaleSheet
        open
        onClose={() => {}}
        onSaved={onSaved}
        editing={editing}
      />,
    )
    expect(await screen.findByText('Corregir venta')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad de Llavero River')).toHaveValue('2')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await waitFor(() =>
      expect(api.editSale).toHaveBeenCalledWith(
        's9',
        expect.objectContaining({ method: 'transfer' }),
        'op1',
      ),
    )
  })
})

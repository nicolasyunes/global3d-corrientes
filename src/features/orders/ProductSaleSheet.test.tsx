import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductRow } from '@/features/products/products.api'
import ProductSaleSheet from './ProductSaleSheet'

// Same strategy as QuickOrderRow.test.tsx: mock the api modules, exercise the
// real hook + validation wiring without a network.

const { listSellableProductsMock, createProductSaleMock, upsertCustomerMock } =
  vi.hoisted(() => ({
    listSellableProductsMock: vi.fn(),
    createProductSaleMock: vi.fn(),
    upsertCustomerMock: vi.fn(),
  }))

vi.mock('./productSales.api', () => ({
  listSellableProducts: listSellableProductsMock,
  createProductSale: createProductSaleMock,
}))

vi.mock('./orders.api', () => ({
  upsertCustomer: upsertCustomerMock,
}))

const PRODUCT: ProductRow = {
  id: 'prod-1',
  name: 'Llavero Batman',
  description: null,
  base_price: 1500,
  stock_quantity: 4,
  image_url: null,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  slug: null,
  sku: null,
  compare_at_price: null,
  custom_on_request: false,
  personalizable: false,
  weight_grams: null,
  category_id: null,
  subcategory: null,
}

function createdRow(overrides = {}) {
  return {
    id: 'tx-1',
    type: 'product_sale',
    order_id: null,
    amount: 3000,
    payment_account: null,
    method: null,
    note: null,
    transacted_at: '2026-01-10T12:00:00Z',
    created_at: '2026-01-10T12:00:00Z',
    updated_at: '2026-01-10T12:00:00Z',
    inventory_id: null,
    quantity_grams: null,
    product_id: 'prod-1',
    quantity: 2,
    customer_id: null,
    ...overrides,
  }
}

async function renderOpen(
  props: { onClose?: () => void; onCreated?: (sale: unknown) => void } = {},
) {
  const result = render(
    <ProductSaleSheet
      open
      onClose={props.onClose ?? vi.fn()}
      onCreated={props.onCreated ?? vi.fn()}
    />,
  )
  await act(async () => {})
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  listSellableProductsMock.mockResolvedValue([PRODUCT])
  createProductSaleMock.mockResolvedValue(createdRow())
  upsertCustomerMock.mockResolvedValue({ id: 'cust-1', name: 'Ada', phone: null })
})

describe('ProductSaleSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ProductSaleSheet open={false} onClose={vi.fn()} onCreated={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the capture fields and the catalog option when open', async () => {
    await renderOpen()
    expect(screen.getByLabelText('Producto')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad')).toBeInTheDocument()
    expect(screen.getByLabelText('Cliente (opcional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Total')).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Llavero Batman · 4 en stock' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Guardar venta' }),
    ).toBeInTheDocument()
  })

  it('reveals the free-text name field when "Otro" is chosen', async () => {
    await renderOpen()
    expect(screen.queryByLabelText('Nombre del producto')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: '__free__' },
    })
    expect(screen.getByLabelText('Nombre del producto')).toBeInTheDocument()
  })

  it('saves a catalog sale, calls onCreated, then closes', async () => {
    const onCreated = vi.fn()
    const onClose = vi.fn()
    await renderOpen({ onCreated, onClose })

    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: 'prod-1' },
    })
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '3000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await act(async () => {})

    expect(createProductSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        quantity: 2,
        amount: 3000,
        productName: null,
      }),
    )
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-1' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('upserts a customer only when a name is typed', async () => {
    await renderOpen()

    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: 'prod-1' },
    })
    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '1500' },
    })
    fireEvent.change(screen.getByLabelText('Cliente (opcional)'), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await act(async () => {})

    expect(upsertCustomerMock).toHaveBeenCalledWith({ name: 'Ada' })
    expect(createProductSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1' }),
    )
  })

  it('blocks submit with an error when no product is chosen', async () => {
    const onCreated = vi.fn()
    await renderOpen({ onCreated })

    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '1500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await act(async () => {})

    expect(createProductSaleMock).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByText('Elegí un producto del catálogo o cargá uno.')).toBeInTheDocument()
  })

  it('rejects a quantity above catalog stock before hitting the api', async () => {
    await renderOpen()

    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: 'prod-1' },
    })
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '1500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await act(async () => {})

    expect(createProductSaleMock).not.toHaveBeenCalled()
    expect(screen.getByText('Solo hay 4 en stock.')).toBeInTheDocument()
  })

  it('translates a stock rollback from the api into a friendly message', async () => {
    createProductSaleMock.mockRejectedValue(
      new Error(
        'new row for relation "products" violates check constraint "products_stock_quantity_check"',
      ),
    )
    await renderOpen()

    fireEvent.change(screen.getByLabelText('Producto'), {
      target: { value: 'prod-1' },
    })
    fireEvent.change(screen.getByLabelText('Total'), {
      target: { value: '1500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await act(async () => {})

    expect(
      screen.getByText('No alcanza el stock de este producto.'),
    ).toBeInTheDocument()
  })

  it('closes on the backdrop and on Escape', async () => {
    const onClose = vi.fn()
    const { container } = await renderOpen({ onClose })

    fireEvent.click(container.querySelector('.sale-sheet__backdrop')!)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(container.querySelector('.sale-sheet')!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

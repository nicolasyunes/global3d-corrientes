import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrderProduction from './OrderProduction'

const { getOrderMock, listOrderItemsMock, updateOrderMock } = vi.hoisted(
  () => ({
    getOrderMock: vi.fn(),
    listOrderItemsMock: vi.fn(),
    updateOrderMock: vi.fn(),
  }),
)

vi.mock('./orders.api', () => ({
  getOrder: getOrderMock,
  listOrderItems: listOrderItemsMock,
  updateOrder: updateOrderMock,
}))
const { listPiecesMock } = vi.hoisted(() => ({ listPiecesMock: vi.fn() }))
vi.mock('@/features/production/production.api', () => ({
  listPieces: listPiecesMock,
}))
vi.mock('./OrderImages', () => ({ default: () => <div>IMAGES</div> }))
vi.mock('@/features/production/OrderPieces', () => ({
  default: () => <div>PIECES</div>,
}))
vi.mock('@/features/production/ActivityFeed', () => ({
  default: () => <div>ACTIVITY</div>,
}))
const { openEditMock } = vi.hoisted(() => ({ openEditMock: vi.fn() }))
vi.mock('./order-modal-context', () => ({
  useOrderModal: () => ({ openEdit: openEditMock }),
}))

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: { tapa: 'negro', base: 'blanco' },
    personalization: 'Feliz cumple Ada',
    measurements: '10x10 cm',
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-08',
    total_amount: 5000,
    deposit: 2000,
    pending_balance: 3000,
    payment_method: 'cash',
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: 'whatsapp',
    reference_link: 'https://makerworld.com/x',
    title: null,
    description: null,
    waiting_reason: null,
    follow_up_on: null,
    flexible: false,
    urgent: false,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

async function renderAt(id = 'order-1') {
  const view = render(
    <MemoryRouter initialEntries={[`/admin/orders/${id}`]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderProduction />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  getOrderMock.mockResolvedValue(order())
  listOrderItemsMock.mockResolvedValue([])
  listPiecesMock.mockResolvedValue([])
  updateOrderMock.mockResolvedValue(order({ status: 'post_processing' }))
})

describe('OrderProduction', () => {
  it('shows the production spec: colours, measurements, engraving text', async () => {
    await renderAt()
    expect(screen.getByText('Qué hay que hacer')).toBeInTheDocument()
    expect(screen.getByText(/tapa: negro/)).toBeInTheDocument()
    expect(screen.getByText('10x10 cm')).toBeInTheDocument()
    expect(screen.getAllByText('Feliz cumple Ada').length).toBeGreaterThan(0)
    expect(screen.getByText('PIECES')).toBeInTheDocument()
    expect(screen.getByText('ACTIVITY')).toBeInTheDocument()
  })

  it('summarizes each item with its title and details, money and progress', async () => {
    getOrderMock.mockResolvedValue(
      order({
        title: '30× Llaveros de psicologa',
        observations: 'Retira el viernes',
        customers: { name: 'Maria Noel', phone: '3794123456' },
      }),
    )
    listOrderItemsMock.mockResolvedValue([
      {
        id: 'i1',
        order_id: 'order-1',
        product_type: 'other',
        product_id: null,
        description: 'Llaveros de psicologa',
        personalization: 'con QR (armar uno de muestra)',
        color_spec: {},
        quantity: 30,
        unit_price: null,
        line_total: null,
        position: 0,
        created_at: '',
        updated_at: '',
      },
    ])
    listPiecesMock.mockResolvedValue([
      { status: 'printing', quantity_total: 30, quantity_done: 12 },
    ])
    await renderAt()
    expect(screen.getByText('Llaveros de psicologa')).toBeInTheDocument()
    expect(
      screen.getByText('con QR (armar uno de muestra)'),
    ).toBeInTheDocument()
    expect(screen.getByText('30×')).toBeInTheDocument()
    expect(screen.getByText('12/30')).toBeInTheDocument()
    expect(screen.getByText('$3.000,00')).toBeInTheDocument()
    expect(screen.getByText('Retira el viernes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/5493794123456',
    )
  })

  it('shows the stage line with the current stage', async () => {
    await renderAt()
    const current = within(
      screen.getByRole('list', { name: 'Etapas del pedido' }),
    ).getByRole('button', { name: /Imprimiendo/ })
    expect(current).toHaveAttribute('aria-current', 'step')
  })

  it('lets the stage go back from the stepper, asking first', async () => {
    getOrderMock.mockResolvedValue(order({ status: 'post_processing' }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await renderAt()
    const step = within(
      screen.getByRole('list', { name: 'Etapas del pedido' }),
    ).getByRole('button', { name: /Imprimiendo/ })
    await act(async () => {
      step.click()
    })
    expect(updateOrderMock).not.toHaveBeenCalled()
    confirm.mockReturnValueOnce(true)
    await act(async () => {
      step.click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'printing',
    })
    confirm.mockRestore()
  })

  it('omits a spec row when its field is empty', async () => {
    getOrderMock.mockResolvedValue(
      order({ measurements: null, color_spec: {}, personalization: null }),
    )
    await renderAt()
    expect(screen.queryByText('Medidas')).not.toBeInTheDocument()
    expect(screen.queryByText('Colores')).not.toBeInTheDocument()
  })

  it('does not render commercial fields', async () => {
    await renderAt()
    expect(screen.queryByText(/Método de pago/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Canal de origen/i)).not.toBeInTheDocument()
    // status is 'printing' → saldo hidden
    expect(screen.queryByText(/Saldo pendiente/)).not.toBeInTheDocument()
  })

  it('shows the pending balance only when the order is finished', async () => {
    getOrderMock.mockResolvedValue(order({ status: 'finished' }))
    await renderAt()
    expect(screen.getByText(/Saldo pendiente: \$3\.000,00/)).toBeInTheDocument()
  })

  it('advances the production stage', async () => {
    await renderAt()
    const btn = screen.getByRole('button', {
      name: /Avanzar a Post-procesado/i,
    })
    await act(async () => {
      btn.click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'post_processing',
    })
  })

  it('opens the edit modal', async () => {
    await renderAt()
    await act(async () => {
      screen.getByRole('button', { name: /Editar datos/i }).click()
    })
    expect(openEditMock).toHaveBeenCalledWith('order-1', expect.any(Function))
  })
})

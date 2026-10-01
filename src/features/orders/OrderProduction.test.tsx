import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
  listEvents: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/production/workshop.api', () => ({
  logOrderEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./orderSave.api', () => ({
  loadDraft: vi.fn(),
  createOrderFromDraft: vi.fn(),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' } }),
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
    pp_sand: false,
    pp_paint: false,
    pp_notes: null,
    delivery_kind: null,
    delivery_place: null,
    delivery_time: null,
    delivery_person: null,
    delivery_note: null,
    sand_done: false,
    paint_done: false,
    stage_manual: false,
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
  it('keeps the production spec: colours, measurements, engraving text', async () => {
    await renderAt()
    expect(screen.getByText(/tapa: negro/)).toBeInTheDocument()
    expect(screen.getByText('10x10 cm')).toBeInTheDocument()
    expect(screen.getAllByText('Feliz cumple Ada').length).toBeGreaterThan(0)
    expect(screen.getByText('PIECES')).toBeInTheDocument()
    expect(screen.getByText('ACTIVITY')).toBeInTheDocument()
  })

  it('summarizes who, when and how much, with the parts chip', async () => {
    getOrderMock.mockResolvedValue(
      order({
        title: '30× Llaveros de psicologa',
        observations: 'Retira el viernes',
        customers: { name: 'Maria Noel', phone: '3794123456' },
      }),
    )
    listPiecesMock.mockResolvedValue([
      { id: 'p1', status: 'done', color: 'negro' },
      { id: 'p2', status: 'printing', color: 'rojo' },
    ])
    await renderAt()
    expect(screen.getByText('1/2 partes')).toBeInTheDocument()
    expect(screen.getByText('$3.000,00')).toBeInTheDocument()
    expect(screen.getByText(/Pagado \$2\.000,00/)).toBeInTheDocument()
    expect(screen.getByText('Retira el viernes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/5493794123456',
    )
  })

  it('shows the stepper with the current stage', async () => {
    await renderAt()
    const current = within(
      screen.getByRole('list', { name: 'Etapas del pedido' }),
    ).getByRole('button', { name: /Imprimiendo/ })
    expect(current).toHaveAttribute('aria-current', 'step')
  })

  it('explains what moves the order on by itself', async () => {
    listPiecesMock.mockResolvedValue([
      { id: 'p1', status: 'printing', color: 'negro' },
    ])
    await renderAt()
    expect(
      screen.getByText(/Pasa solo a Terminado cuando la pieza esté impresa/),
    ).toBeInTheDocument()
  })

  it('sets the stage by hand from the stepper, asking first', async () => {
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
      stage_manual: true,
    })
    confirm.mockRestore()
  })

  it('offers to go back to automatic when the stage is pinned', async () => {
    getOrderMock.mockResolvedValue(order({ stage_manual: true }))
    await renderAt()
    expect(screen.getByText(/fijada a mano/)).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: 'Volver a automático' }).click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      stage_manual: false,
    })
  })

  it('omits a spec row when its field is empty', async () => {
    getOrderMock.mockResolvedValue(
      order({ measurements: null, color_spec: {}, personalization: null }),
    )
    await renderAt()
    expect(screen.queryByText('Medidas')).not.toBeInTheDocument()
    expect(screen.queryByText('Colores')).not.toBeInTheDocument()
  })

  it('skips postprocess when the order has none', async () => {
    await renderAt()
    await act(async () => {
      screen.getByRole('button', { name: /Avanzar a Terminado/i }).click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'finished',
      stage_manual: true,
    })
  })

  it('advances the production stage', async () => {
    getOrderMock.mockResolvedValue(order({ pp_paint: true }))
    await renderAt()
    const btn = screen.getByRole('button', {
      name: /Avanzar a Post-procesado/i,
    })
    await act(async () => {
      btn.click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'post_processing',
      stage_manual: true,
    })
  })

  it('registers a payment against the balance', async () => {
    await renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    fireEvent.change(screen.getByLabelText('¿Cuánto pagó?'), {
      target: { value: '1000' },
    })
    await act(async () => {
      screen.getByRole('button', { name: 'Guardar pago' }).click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      deposit: 3000,
      pending_balance: 2000,
    })
  })

  it('cancels from the more menu, asking first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderAt()
    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }))
    await act(async () => {
      screen.getByRole('button', { name: /Cancelar pedido/ }).click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'cancelled',
    })
    confirm.mockRestore()
  })

  it('opens the edit modal', async () => {
    await renderAt()
    await act(async () => {
      screen.getByRole('button', { name: /Editar datos/i }).click()
    })
    expect(openEditMock).toHaveBeenCalledWith('order-1', expect.any(Function))
  })
})

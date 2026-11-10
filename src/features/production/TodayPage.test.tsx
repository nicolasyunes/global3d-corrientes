import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'
import TodayPage, {
  dayWord,
  progressByOrder,
  sinceText,
  summarize,
} from './TodayPage'
import type { WorkPiece } from './workshop.api'

const mocks = vi.hoisted(() => ({
  listOpenOrders: vi.fn(),
  listOrderItemCounts: vi.fn(),
  listWorkshopPieces: vi.fn(),
  setPieceStatus: vi.fn(),
  incrementPiece: vi.fn(),
}))

vi.mock('@/features/orders/orders.api', () => ({
  listOpenOrders: mocks.listOpenOrders,
  listOrderItemCounts: mocks.listOrderItemCounts,
  updateOrder: vi.fn(),
}))
vi.mock('./production.api', () => ({
  setPieceStatus: mocks.setPieceStatus,
  incrementPiece: mocks.incrementPiece,
}))
vi.mock('./workshop.api', () => ({
  listWorkshopPieces: mocks.listWorkshopPieces,
}))
vi.mock('@/features/notices/notices.api', () => ({
  listNotices: vi.fn().mockResolvedValue([]),
  createNotice: vi.fn(),
  markTask: vi.fn(),
  setPriority: vi.fn(),
  archiveNotice: vi.fn(),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    byId: () => undefined,
  }),
}))
vi.mock('@/features/orders/order-modal-context', () => ({
  useOrderModal: () => ({ openNew: vi.fn() }),
}))

const today = toISODate(new Date())

function order(over: Partial<OrderWithCustomer>): OrderWithCustomer {
  return {
    id: 'o',
    customer_id: 'c',
    product_type: 'other',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: today,
    due_date: today,
    total_amount: 1000,
    deposit: 0,
    pending_balance: 1000,
    payment_method: null,
    status: 'printing',
    created_at: `${today}T00:00:00Z`,
    updated_at: `${today}T00:00:00Z`,
    origin_channel: 'whatsapp',
    reference_link: null,
    title: 'Pedido',
    description: null,
    waiting_reason: null,
    follow_up_on: null,
    flexible: false,
    urgent: false,
    pp_sand: false,
    pp_paint: false,
    pp_notes: null,
    sand_done: false,
    paint_done: false,
    stage_manual: false,
    customers: { name: 'Ana', phone: null },
    ...over,
  }
}

function piece(over: Partial<WorkPiece>): WorkPiece {
  return {
    id: 'p',
    order_id: 'o1',
    order_item_id: null,
    label: 'Trofeos',
    location: null,
    color: null,
    quantity_total: 1,
    quantity_done: 0,
    status: 'printing',
    updated_by: null,
    position: 0,
    created_at: '',
    updated_at: new Date().toISOString(),
    due_date: today,
    order_status: 'printing',
    order_title: null,
    order_created_at: '',
    order_updated_at: '',
    customer_id: 'c',
    customer_name: 'sabri',
    flexible: false,
    urgent: false,
    pp_sand: false,
    pp_paint: false,
    pp_notes: null,
    sand_done: false,
    paint_done: false,
    item_label: null,
    ...over,
  } as WorkPiece
}

describe('helpers', () => {
  it('names the delivery day', () => {
    expect(dayWord(today, today)).toBe('Hoy')
    expect(dayWord(addDaysISO(today, 1), today)).toBe('Mañana')
    expect(dayWord(addDaysISO(today, 3), today)).toMatch(/^[A-ZÁÉ][a-záé]+$/)
  })

  it('says how long ago a piece started', () => {
    const now = new Date('2026-09-30T15:00:00')
    expect(sinceText('2026-09-30T14:59:30', now)).toBe('recién')
    expect(sinceText('2026-09-30T14:20:00', now)).toBe('hace 40 min')
    expect(sinceText('2026-09-30T13:00:00', now)).toBe('hace 2 h')
    expect(sinceText('2026-09-30T08:05:00', now)).toMatch(/08:05/)
  })

  it('splits the day into late, soon, waiting and ready', () => {
    const s = summarize(
      [
        order({ id: 'late', due_date: addDaysISO(today, -3) }),
        order({ id: 'soon', due_date: addDaysISO(today, 1) }),
        order({ id: 'wait', waiting_reason: 'Falta la seña' }),
        order({ id: 'ready', status: 'finished', pending_balance: 500 }),
        order({ id: 'easy', due_date: addDaysISO(today, -3), flexible: true }),
      ],
      today,
    )
    expect(s.late.map((o) => o.id)).toEqual(['late'])
    expect(s.soon.map((o) => o.id)).toEqual(['soon'])
    expect(s.waiting.map((o) => o.id)).toEqual(['wait'])
    expect(s.readyBalance).toBe(500)
  })
})

describe('progressByOrder', () => {
  it('adds up printed and total quantities per order', () => {
    expect(
      progressByOrder([
        piece({ id: 'a', order_id: 'x', quantity_done: 2, quantity_total: 5 }),
        piece({ id: 'b', order_id: 'x', quantity_done: 1, quantity_total: 1 }),
        piece({ id: 'c', order_id: 'y', quantity_done: 0, quantity_total: 3 }),
      ]),
    ).toEqual({ x: { done: 3, total: 6 }, y: { done: 0, total: 3 } })
  })
})

describe('TodayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listOpenOrders.mockResolvedValue([
      order({ id: 'o1', due_date: addDaysISO(today, -2), title: 'Trofeos' }),
      order({ id: 'o2', waiting_reason: 'hablarle para ver qué quiere' }),
    ])
    mocks.listOrderItemCounts.mockResolvedValue({})
    mocks.listWorkshopPieces.mockResolvedValue([
      piece({ id: 'p1', label: 'Trofeos', urgent: true }),
      piece({
        id: 'p2',
        label: 'Placas',
        status: 'pending',
        color: 'amarillo',
      }),
    ])
    mocks.setPieceStatus.mockResolvedValue({})
  })

  async function renderPage() {
    render(
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>,
    )
    await act(async () => {})
  }

  it('shows what is printing, what comes next, and marks it printed', async () => {
    mocks.setPieceStatus.mockResolvedValue({ id: 'p1', status: 'done' })
    await renderPage()
    const col = screen.getByRole('region', { name: 'Imprimir' })
    expect(within(col).getByText(/Urgente/)).toBeInTheDocument()
    expect(within(col).getByText(/Placas · amarillo/)).toBeInTheDocument()
    await act(async () => {
      within(col)
        .getByRole('button', { name: /Impresa/ })
        .click()
    })
    expect(mocks.setPieceStatus).toHaveBeenCalledWith('p1', 'done', 'op-1')
  })

  it('puts late and waiting orders under Atender', async () => {
    await renderPage()
    const col = screen.getByRole('region', { name: 'Atender' })
    expect(within(col).getByText('+2 d')).toBeInTheDocument()
    expect(
      within(col).getByText('hablarle para ver qué quiere'),
    ).toBeInTheDocument()
    expect(
      within(col).getByRole('button', { name: /Confirmar/ }),
    ).toBeInTheDocument()
  })

  it('lists ready orders under Entregar', async () => {
    mocks.listOpenOrders.mockResolvedValue([
      order({ id: 'o3', status: 'finished', pending_balance: 700 }),
    ])
    await renderPage()
    const col = screen.getByRole('region', { name: 'Entregar' })
    expect(within(col).getByText('Listo')).toBeInTheDocument()
    expect(within(col).getAllByText(/a cobrar/).length).toBeGreaterThan(0)
  })

  it('only counts item rows of the open orders', async () => {
    await renderPage()
    expect(mocks.listOrderItemCounts).toHaveBeenCalledWith(['o1', 'o2'])
  })
})

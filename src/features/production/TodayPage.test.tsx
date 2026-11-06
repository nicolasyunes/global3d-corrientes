import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'
import TodayPage, { dayWord, sinceText, summarize } from './TodayPage'
import type { WorkPiece } from './workshop.api'

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(),
  listOrderItemCounts: vi.fn(),
  listOrderProgress: vi.fn(),
  listWorkshopPieces: vi.fn(),
  setPieceStatus: vi.fn(),
  incrementPiece: vi.fn(),
}))

vi.mock('@/features/orders/orders.api', () => ({
  listOrders: mocks.listOrders,
  listOrderItemCounts: mocks.listOrderItemCounts,
  updateOrder: vi.fn(),
}))
vi.mock('./production.api', () => ({
  listOrderProgress: mocks.listOrderProgress,
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

describe('TodayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listOrders.mockResolvedValue([
      order({ id: 'o1', due_date: addDaysISO(today, -2), title: 'Trofeos' }),
      order({ id: 'o2', waiting_reason: 'hablarle para ver qué quiere' }),
    ])
    mocks.listOrderItemCounts.mockResolvedValue({})
    mocks.listOrderProgress.mockResolvedValue({})
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

  it('shows what is printing and marks it printed', async () => {
    await renderPage()
    const now = screen.getByRole('region', { name: 'Imprimiendo ahora' })
    expect(within(now).getByText(/sabri · Urgente/)).toBeInTheDocument()
    await act(async () => {
      within(now)
        .getByRole('button', { name: /Impresa/ })
        .click()
    })
    expect(mocks.setPieceStatus).toHaveBeenCalledWith('p1', 'done', 'op-1')
    const next = screen.getByRole('region', {
      name: 'Lo próximo para imprimir',
    })
    expect(within(next).getByText(/Placas · amarillo/)).toBeInTheDocument()
  })

  it('opens the waiting orders from their card', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /En espera/ }))
    const panel = screen.getByRole('region', { name: 'En espera' })
    expect(within(panel).getByText(/No están confirmados/)).toBeInTheDocument()
  })

  it('lists the late orders from their card', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Atrasados/ }))
    expect(
      screen.getByRole('region', { name: 'Atrasados' }),
    ).toBeInTheDocument()
  })
})

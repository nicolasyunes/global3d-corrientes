import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'
import NoticesPage from './NoticesPage'
import type { Notice } from './notices'

const mocks = vi.hoisted(() => ({
  listNotices: vi.fn(),
  createNotice: vi.fn(),
  updateNotice: vi.fn(),
  markTask: vi.fn(),
  setPriority: vi.fn(),
  archiveNotice: vi.fn(),
  deleteNotice: vi.fn(),
  countOpenTasks: vi.fn(),
}))
vi.mock('./notices.api', () => mocks)

const people = [
  {
    id: 'op-1',
    name: 'nicolas',
    initials: 'NI',
    color: '#f37021',
    active: true,
  },
  { id: 'op-2', name: 'sabri', initials: 'SA', color: '#888', active: true },
]
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: people[0],
    operators: people,
    byId: (id: string | null) => people.find((p) => p.id === id),
  }),
}))

const today = toISODate(new Date())

function row(over: Partial<Notice>): Notice {
  return {
    id: 'n',
    kind: 'task',
    body: 'Tarea',
    important: false,
    created_by: 'op-1',
    created_at: new Date().toISOString(),
    done_at: null,
    done_by: null,
    archived_at: null,
    archived_by: null,
    sector: 'local',
    priority: 'media',
    assignee_id: null,
    due_on: null,
    repeat: null,
    link: null,
    color: 'amarillo',
    pinned: false,
    expires_on: null,
    last_done_at: null,
    last_done_by: null,
    ...over,
  }
}

describe('NoticesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listNotices.mockResolvedValue([
      row({ id: 'a1', kind: 'notice', body: 'El jueves cerramos a las 18' }),
      row({
        id: 'a2',
        kind: 'notice',
        body: 'Aviso viejo',
        expires_on: addDaysISO(today, -1),
      }),
      row({
        id: 't1',
        body: 'Limpiar la cama de la impresora 2',
        sector: 'taller',
        repeat: 'week',
        due_on: today,
        assignee_id: 'op-2',
      }),
      row({
        id: 't2',
        body: 'Arreglar la luz de la vidriera',
        priority: 'alta',
        assignee_id: 'op-1',
      }),
    ])
  })

  async function renderPage() {
    render(
      <MemoryRouter>
        <NoticesPage />
      </MemoryRouter>,
    )
    await act(async () => {})
  }

  it('shows the board and the active notices only', async () => {
    await renderPage()
    const board = screen.getByRole('region', { name: 'Cartelera' })
    expect(
      within(board).getByText('El jueves cerramos a las 18'),
    ).toBeInTheDocument()
    expect(within(board).queryByText('Aviso viejo')).toBeNull()
    for (const name of [
      'Local',
      'Taller',
      'Compras y faltantes',
      'Presupuesto',
    ])
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    expect(screen.getByText(/2 pendientes/)).toBeInTheDocument()
    expect(screen.getByText('1 de importancia alta')).toBeInTheDocument()
  })

  it('ticks a weekly task', async () => {
    mocks.markTask.mockResolvedValue(
      row({
        id: 't1',
        body: 'Limpiar la cama de la impresora 2',
        sector: 'taller',
        repeat: 'week',
        due_on: addDaysISO(today, 7),
        last_done_at: new Date().toISOString(),
        last_done_by: 'op-1',
      }),
    )
    await renderPage()
    await act(async () => {
      fireEvent.click(
        screen.getByRole('checkbox', {
          name: 'Marcar como hecha: Limpiar la cama de la impresora 2',
        }),
      )
    })
    expect(mocks.markTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      true,
      'op-1',
    )
    expect(screen.getByText(/hecha por nicolas hoy/)).toBeInTheDocument()
  })

  it('adds a task straight into a column', async () => {
    mocks.createNotice.mockResolvedValue(
      row({ id: 't3', body: 'Calibrar la impresora 1', sector: 'taller' }),
    )
    await renderPage()
    const taller = screen.getByRole('region', { name: 'Taller' })
    const input = within(taller).getByLabelText('Agregar en Taller')
    fireEvent.change(input, { target: { value: 'Calibrar la impresora 1' } })
    await act(async () => {
      fireEvent.submit(input)
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'task',
      { body: 'Calibrar la impresora 1', sector: 'taller' },
      'op-1',
    )
    expect(
      within(taller).getByText('Calibrar la impresora 1'),
    ).toBeInTheDocument()
  })

  it('filters my tasks', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^Mías/ }))
    expect(
      screen.getByText('Arreglar la luz de la vidriera'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Limpiar la cama de la impresora 2')).toBeNull()
  })

  it('switches to the table', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tabla/ }))
    const table = screen.getByRole('table')
    expect(
      within(table).getByText('Arreglar la luz de la vidriera'),
    ).toBeInTheDocument()
    expect(within(table).getAllByText('Taller').length).toBeGreaterThan(0)
  })
})

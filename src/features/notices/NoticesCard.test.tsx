import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportantStrip from './ImportantStrip'
import NoticesCard from './NoticesCard'
import { useNotices } from './useNotices'
import { noticeAge, openTasks, sortNotices, visibleNotices } from './notices'
import type { Notice } from './notices'

const mocks = vi.hoisted(() => ({
  listNotices: vi.fn(),
  createNotice: vi.fn(),
  setTaskDone: vi.fn(),
  setImportant: vi.fn(),
  archiveNotice: vi.fn(),
}))

vi.mock('./notices.api', () => mocks)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    byId: (id: string | null) =>
      id === 'op-2' ? { name: 'sabri' } : id ? { name: 'nicolas' } : undefined,
  }),
}))

const NOW = new Date('2026-10-01T15:00:00')

// Hoy loads the notices once and hands them to the strip and the card.
function Board() {
  const notices = useNotices()
  return (
    <>
      <ImportantStrip notices={notices} />
      <NoticesCard notices={notices} />
    </>
  )
}

function notice(over: Partial<Notice>): Notice {
  return {
    id: 'n',
    kind: 'notice',
    body: 'Aviso',
    important: false,
    created_by: 'op-1',
    created_at: new Date().toISOString(),
    done_at: null,
    done_by: null,
    archived_at: null,
    archived_by: null,
    ...over,
  }
}

describe('helpers', () => {
  it('hides archived and day-old done tasks', () => {
    const rows = [
      notice({ id: 'open' }),
      notice({ id: 'arch', archived_at: '2026-10-01T10:00:00Z' }),
      notice({
        id: 'fresh',
        kind: 'task',
        done_at: '2026-10-01T10:00:00Z',
      }),
      notice({
        id: 'old',
        kind: 'task',
        done_at: '2026-09-29T10:00:00Z',
      }),
    ]
    const ids = visibleNotices(rows, NOW.getTime()).map((n) => n.id)
    expect(ids).toEqual(['open', 'fresh'])
  })

  it('puts important first and done tasks last', () => {
    const rows = [
      notice({ id: 'done', kind: 'task', done_at: '2026-10-01T10:00:00Z' }),
      notice({ id: 'old', created_at: '2026-09-30T10:00:00Z' }),
      notice({ id: 'new', created_at: '2026-10-01T10:00:00Z' }),
      notice({
        id: 'imp',
        important: true,
        created_at: '2026-09-28T10:00:00Z',
      }),
    ]
    expect(sortNotices(rows).map((n) => n.id)).toEqual([
      'imp',
      'new',
      'old',
      'done',
    ])
    expect(openTasks([...rows, notice({ kind: 'task' })])).toBe(1)
  })

  it('says how long ago', () => {
    expect(noticeAge('2026-10-01T14:59:40', NOW)).toBe('recién')
    expect(noticeAge('2026-10-01T14:20:00', NOW)).toBe('hace 40 min')
    expect(noticeAge('2026-10-01T09:00:00', NOW)).toBe('hace 6 h')
    expect(noticeAge('2026-09-30T18:20:00', NOW)).toBe('ayer 18:20')
  })
})

describe('NoticesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listNotices.mockResolvedValue([
      notice({ id: 'a', body: 'El jueves cerramos a las 18', important: true }),
      notice({
        id: 'b',
        kind: 'task',
        body: 'Limpiar la cama',
        created_by: 'op-2',
      }),
    ])
  })

  async function renderCard() {
    render(<Board />)
    await act(async () => {})
    return screen.getByRole('region', { name: 'Avisos' })
  }

  it('lists notices and tasks, important first', async () => {
    const card = await renderCard()
    const items = within(card).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('El jueves cerramos a las 18')
    expect(items[0]).toHaveTextContent('Importante')
    expect(items[1]).toHaveTextContent('Limpiar la cama')
    expect(items[1]).toHaveTextContent('sabri')
    expect(within(card).getByText('1 tarea pendiente')).toBeInTheDocument()
  })

  it('adds a task marked important', async () => {
    mocks.createNotice.mockResolvedValue(
      notice({
        id: 'c',
        kind: 'task',
        body: 'Pedir filamento',
        important: true,
      }),
    )
    const card = await renderCard()
    fireEvent.click(within(card).getByRole('button', { name: 'Tarea' }))
    fireEvent.change(within(card).getByLabelText('Nueva tarea'), {
      target: { value: '  Pedir filamento ' },
    })
    fireEvent.click(
      within(card).getByRole('button', { name: 'Marcar como importante' }),
    )
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /Agregar/ }))
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      { kind: 'task', body: 'Pedir filamento', important: true },
      'op-1',
    )
    expect(within(card).getByText('Pedir filamento')).toBeInTheDocument()
    expect(within(card).getByLabelText('Nueva tarea')).toHaveValue('')
  })

  it('ticks a task and keeps who did it', async () => {
    mocks.setTaskDone.mockResolvedValue(
      notice({
        id: 'b',
        kind: 'task',
        body: 'Limpiar la cama',
        done_at: new Date().toISOString(),
        done_by: 'op-1',
      }),
    )
    const card = await renderCard()
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('checkbox', {
          name: 'Marcar como hecha: Limpiar la cama',
        }),
      )
    })
    expect(mocks.setTaskDone).toHaveBeenCalledWith('b', true, 'op-1')
    expect(within(card).getByText(/hecha por nicolas/)).toBeInTheDocument()
    expect(within(card).queryByText('1 tarea pendiente')).toBeNull()
  })

  it('archives a notice with the option to undo', async () => {
    mocks.archiveNotice.mockResolvedValue(undefined)
    const card = await renderCard()
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('button', {
          name: 'Archivar: El jueves cerramos a las 18',
        }),
      )
    })
    expect(mocks.archiveNotice).toHaveBeenCalledWith('a', true, 'op-1')
    expect(within(card).queryByText('El jueves cerramos a las 18')).toBeNull()
    expect(screen.getByText('Deshacer')).toBeInTheDocument()
  })

  it('invites to write the first one when empty', async () => {
    mocks.listNotices.mockResolvedValue([])
    const card = await renderCard()
    expect(
      within(card).getByText(/No hay avisos ni tareas/),
    ).toBeInTheDocument()
  })

  it('shows the strip only while something important is open', async () => {
    await renderCard()
    const strip = screen.getByRole('region', { name: 'Avisos importantes' })
    expect(
      within(strip).getByText('El jueves cerramos a las 18'),
    ).toBeInTheDocument()
    expect(
      within(strip).getByRole('button', { name: /Ver todos/ }),
    ).toHaveTextContent('2')
    // Archiving the only important one makes the strip disappear.
    mocks.archiveNotice.mockResolvedValue(undefined)
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Archivar: El jueves cerramos a las 18',
        }),
      )
    })
    expect(
      screen.queryByRole('region', { name: 'Avisos importantes' }),
    ).toBeNull()
  })

  it('has no strip when nothing is important', async () => {
    mocks.listNotices.mockResolvedValue([notice({ id: 'x', body: 'Hola' })])
    await renderCard()
    expect(
      screen.queryByRole('region', { name: 'Avisos importantes' }),
    ).toBeNull()
  })

  it('counts the important ones that do not fit', async () => {
    mocks.listNotices.mockResolvedValue([
      notice({ id: '1', body: 'Uno', important: true }),
      notice({ id: '2', body: 'Dos', important: true }),
      notice({ id: '3', body: 'Tres', important: true }),
    ])
    await renderCard()
    const strip = screen.getByRole('region', { name: 'Avisos importantes' })
    expect(within(strip).getByText('y 1 importante más')).toBeInTheDocument()
  })
})

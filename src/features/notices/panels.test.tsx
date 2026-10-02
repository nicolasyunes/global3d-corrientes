import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskPanel from './TaskPanel'
import NoticePanel from './NoticePanel'
import type { Notice } from './notices'

const mocks = vi.hoisted(() => ({
  createNotice: vi.fn(),
  updateNotice: vi.fn(),
  deleteNotice: vi.fn(),
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
] as never

const task = {
  id: 't1',
  kind: 'task',
  body: 'Calibrar la impresora 1',
  sector: 'taller',
  priority: 'alta',
  assignee_id: null,
  due_on: null,
  repeat: null,
  link: null,
} as Notice

describe('TaskPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a task with every field', async () => {
    mocks.createNotice.mockResolvedValue({ id: 'new' })
    const onSaved = vi.fn()
    render(
      <TaskPanel
        task={null}
        sector="compras"
        operators={people}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={onSaved}
        onArchive={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Tarea'), {
      target: { value: 'Comprar Grilon3 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    fireEvent.change(screen.getByLabelText('Asignada a'), {
      target: { value: 'op-2' },
    })
    fireEvent.change(screen.getByLabelText('Fecha'), {
      target: { value: '2026-10-05' },
    })
    fireEvent.change(screen.getByLabelText('Repetir'), {
      target: { value: 'week' },
    })
    fireEvent.change(screen.getByLabelText('Vínculo'), {
      target: { value: 'Filamentos' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'task',
      {
        body: 'Comprar Grilon3',
        sector: 'compras',
        priority: 'alta',
        assignee_id: 'op-2',
        due_on: '2026-10-05',
        repeat: 'week',
        link: 'Filamentos',
      },
      'op-1',
    )
    expect(onSaved).toHaveBeenCalledWith({ id: 'new' })
  })

  it('asks inside the panel before deleting', async () => {
    mocks.deleteNotice.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    render(
      <TaskPanel
        task={task}
        sector="taller"
        operators={people}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onArchive={vi.fn()}
        onDeleted={onDeleted}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(mocks.deleteNotice).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    })
    expect(mocks.deleteNotice).toHaveBeenCalledWith('t1')
    expect(onDeleted).toHaveBeenCalledWith('t1')
  })
})

describe('NoticePanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a pinned notice with color and date', async () => {
    mocks.createNotice.mockResolvedValue({ id: 'a' })
    render(
      <NoticePanel
        notice={null}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onArchive={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Aviso'), {
      target: { value: 'El jueves cerramos a las 18' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rosa' }))
    fireEvent.click(screen.getByLabelText('Fijar adelante'))
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-10-08' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'notice',
      {
        body: 'El jueves cerramos a las 18',
        color: 'rosa',
        pinned: true,
        expires_on: '2026-10-08',
      },
      'op-1',
    )
  })
})

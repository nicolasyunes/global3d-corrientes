import { describe, expect, it } from 'vitest'
import { toISODate } from '@/features/orders/validation'
import {
  activeNotices,
  boardTasks,
  compareTasks,
  dueLabel,
  filterTasks,
  isLink,
  isOverdue,
  markPatch,
  nextDue,
  priorityMix,
  sortNotices,
  sortTasksBy,
  taskSummary,
  untilLabel,
  visibleNotices,
  type Notice,
  type Priority,
  type TaskFilter,
} from './notices'

const TODAY = '2026-10-01'

function row(over: Partial<Notice>): Notice {
  return {
    id: 'n',
    kind: 'task',
    body: 'Tarea',
    important: false,
    created_by: 'op-1',
    created_at: '2026-10-01T10:00:00Z',
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

describe('cartelera', () => {
  it('drops expired and archived notices, pinned first', () => {
    const rows = [
      row({ id: 'old', kind: 'notice', created_at: '2026-09-28T10:00:00Z' }),
      row({ id: 'gone', kind: 'notice', expires_on: '2026-09-30' }),
      row({ id: 'last', kind: 'notice', expires_on: TODAY }),
      row({ id: 'arch', kind: 'notice', archived_at: '2026-10-01T09:00:00Z' }),
      row({
        id: 'pin',
        kind: 'notice',
        pinned: true,
        created_at: '2026-09-20T10:00:00Z',
      }),
      row({ id: 'task' }),
    ]
    expect(activeNotices(rows, TODAY).map((n) => n.id)).toEqual([
      'pin',
      'last',
      'old',
    ])
  })

  it('says until when', () => {
    expect(untilLabel(TODAY, TODAY)).toBe('hasta hoy')
    expect(untilLabel('2026-10-08', TODAY)).toMatch(/^hasta el jue 8$/)
  })
})

describe('tablero', () => {
  it('keeps pending tasks and the ones done today', () => {
    const rows = [
      row({ id: 'open' }),
      row({ id: 'today', done_at: new Date().toISOString() }),
      row({ id: 'yesterday', done_at: '2020-01-01T10:00:00Z' }),
      row({ id: 'notice', kind: 'notice' }),
    ]
    expect(boardTasks(rows, toISODate(new Date())).map((n) => n.id)).toEqual([
      'open',
      'today',
    ])
  })

  it('knows what is overdue', () => {
    expect(isOverdue(row({ due_on: '2026-09-30' }), TODAY)).toBe(true)
    expect(isOverdue(row({ due_on: TODAY }), TODAY)).toBe(false)
    expect(
      isOverdue(
        row({ due_on: '2026-09-30', done_at: '2026-10-01T10:00:00Z' }),
        TODAY,
      ),
    ).toBe(false)
  })

  it('orders overdue, then by importance, then by date', () => {
    const rows = [
      row({ id: 'baja', priority: 'baja' }),
      row({ id: 'media-sin', priority: 'media' }),
      row({ id: 'media-fecha', priority: 'media', due_on: '2026-10-05' }),
      row({ id: 'alta', priority: 'alta' }),
      row({ id: 'late', priority: 'baja', due_on: '2026-09-29' }),
    ]
    expect(
      [...rows].sort((a, b) => compareTasks(a, b, TODAY)).map((n) => n.id),
    ).toEqual(['late', 'alta', 'media-fecha', 'media-sin', 'baja'])
  })

  it('moves a repeated task forward', () => {
    expect(nextDue('2026-10-01', 'day', TODAY)).toBe('2026-10-02')
    expect(nextDue('2026-10-03', 'week', TODAY)).toBe('2026-10-10')
    expect(nextDue('2026-09-20', 'week', TODAY)).toBe('2026-10-08')
    expect(nextDue(null, 'week', TODAY)).toBe('2026-10-08')
    expect(nextDue('2027-01-31', 'month', TODAY)).toBe('2027-02-28')
    expect(nextDue('2026-12-15', 'month', TODAY)).toBe('2027-01-15')
  })

  it('builds the patch to tick a task', () => {
    const now = new Date('2026-10-01T15:00:00')
    expect(markPatch(row({}), true, 'op-1', now)).toEqual({
      done_at: now.toISOString(),
      done_by: 'op-1',
    })
    expect(markPatch(row({}), false, 'op-1', now)).toEqual({
      done_at: null,
      done_by: null,
    })
    expect(
      markPatch(row({ repeat: 'week', due_on: TODAY }), true, 'op-1', now),
    ).toEqual({
      last_done_at: now.toISOString(),
      last_done_by: 'op-1',
      due_on: '2026-10-08',
    })
  })

  it('filters by tab, importance and text', () => {
    const rows = [
      row({ id: 'mine', assignee_id: 'op-1', priority: 'alta' }),
      row({ id: 'free', body: 'Comprar Grilon3' }),
      row({ id: 'late', assignee_id: 'op-2', due_on: '2026-09-29' }),
      row({ id: 'link', link: 'https://filamentos.com' }),
    ]
    const base = {
      filter: 'todas' as TaskFilter,
      priorities: [] as Priority[],
      query: '',
      me: 'op-1',
      today: TODAY,
    }
    const ids = (o: Partial<typeof base>) =>
      filterTasks(rows, { ...base, ...o }).map((n) => n.id)
    expect(ids({ filter: 'mias' })).toEqual(['mine'])
    expect(ids({ filter: 'sin' })).toEqual(['free', 'link'])
    expect(ids({ filter: 'vencidas' })).toEqual(['late'])
    expect(ids({ priorities: ['alta'] })).toEqual(['mine'])
    expect(ids({ query: 'grilon' })).toEqual(['free'])
    expect(ids({ query: 'filamentos' })).toEqual(['link'])
  })

  it('sums up and describes the mix', () => {
    const rows = [
      row({ priority: 'alta' }),
      row({ priority: 'alta', due_on: '2026-09-30' }),
      row({ priority: 'baja' }),
      row({ priority: 'alta', done_at: '2026-10-01T10:00:00Z' }),
    ]
    expect(taskSummary(rows, TODAY)).toEqual({
      pending: 3,
      alta: 2,
      overdue: 1,
    })
    expect(priorityMix(rows.slice(0, 3))).toBe('2 alta · 1 baja')
    expect(priorityMix([])).toBe('')
  })

  it('sorts the table by a column, done last', () => {
    const rows = [
      row({ id: 'b', body: 'Bbb', assignee_id: 'op-2' }),
      row({ id: 'a', body: 'aaa' }),
      row({ id: 'done', body: 'Aaa', done_at: '2026-10-01T10:00:00Z' }),
    ]
    const name = (id: string | null) => (id === 'op-2' ? 'sabri' : '')
    expect(sortTasksBy(rows, 'body', 1, name, TODAY).map((n) => n.id)).toEqual([
      'a',
      'b',
      'done',
    ])
    expect(sortTasksBy(rows, 'body', -1, name, TODAY).map((n) => n.id)).toEqual(
      ['b', 'a', 'done'],
    )
    expect(
      sortTasksBy(rows, 'assignee', 1, name, TODAY).map((n) => n.id),
    ).toEqual(['b', 'a', 'done'])
  })

  it('names the due day', () => {
    expect(dueLabel(TODAY, TODAY)).toBe('Hoy')
    expect(dueLabel('2026-09-30', TODAY)).toBe('Ayer')
    expect(dueLabel('2026-10-02', TODAY)).toBe('Mañana')
    expect(dueLabel('2026-10-03', TODAY)).toMatch(/^Sáb 3$/)
  })

  it('tells links from text', () => {
    expect(isLink('https://club.com')).toBe(true)
    expect(isLink('Club Náutico')).toBe(false)
  })
})

describe('Hoy', () => {
  it('hides expired notices on Hoy too', () => {
    const now = new Date('2026-10-01T15:00:00').getTime()
    const rows = [
      row({ id: 'ok', kind: 'notice' }),
      row({ id: 'gone', kind: 'notice', expires_on: '2026-09-30' }),
    ]
    expect(visibleNotices(rows, now).map((n) => n.id)).toEqual(['ok'])
  })

  it('puts high importance first', () => {
    const rows = [
      row({ id: 'm', created_at: '2026-10-01T12:00:00Z' }),
      row({ id: 'a', priority: 'alta', created_at: '2026-09-01T12:00:00Z' }),
    ]
    expect(sortNotices(rows).map((n) => n.id)).toEqual(['a', 'm'])
  })
})

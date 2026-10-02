import { useState } from 'react'
import type { Operator } from '@/features/operators/operators.api'
import {
  dueLabel,
  isOverdue,
  SECTOR_LABEL,
  sortTasksBy,
  type Notice,
  type Priority,
  type Sector,
  type TaskSortKey,
} from './notices'
import { Assignee, LinkText, PriorityChip, TaskCheck } from './TaskBits'

const COLS: { key: TaskSortKey; label: string }[] = [
  { key: 'body', label: 'Tarea' },
  { key: 'sector', label: 'Sector' },
  { key: 'priority', label: 'Importancia' },
  { key: 'assignee', label: 'Asignado' },
  { key: 'due', label: 'Fecha' },
]

// Same tasks as the board, as rows; any column sorts.
export default function NoticeTable({
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
}: {
  tasks: readonly Notice[]
  today: string
  byId: (id: string | null) => Operator | undefined
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
}) {
  const [sort, setSort] = useState<{ key: TaskSortKey | null; dir: 1 | -1 }>({
    key: null,
    dir: 1,
  })
  const rows = sortTasksBy(
    tasks,
    sort.key,
    sort.dir,
    (id) => byId(id)?.name ?? '',
    today,
  )

  function by(key: TaskSortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    )
  }

  if (rows.length === 0)
    return <p className="td-empty">No hay tareas con este filtro.</p>

  return (
    <div className="ntt-wrap">
      <table className="ntt">
        <thead>
          <tr>
            <th aria-label="Hecha" />
            {COLS.map((c) => (
              <th
                key={c.key}
                aria-sort={
                  sort.key === c.key
                    ? sort.dir === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => by(c.key)}>
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? ' ↑' : ' ↓')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const late = isOverdue(t, today)
            return (
              <tr
                key={t.id}
                className={`${late ? 'is-late' : ''}${t.done_at ? ' is-done' : ''}`}
              >
                <td>
                  <TaskCheck task={t} onToggle={onToggle} />
                </td>
                <td className="ntt__task">
                  <button
                    type="button"
                    className="ntb-card__body"
                    onClick={() => onOpen(t)}
                  >
                    {t.body}
                  </button>
                  {t.link && <LinkText link={t.link} />}
                </td>
                <td>{SECTOR_LABEL[t.sector as Sector]}</td>
                <td>
                  <PriorityChip priority={t.priority as Priority} />
                </td>
                <td>
                  <Assignee person={byId(t.assignee_id)} />
                </td>
                <td className={late ? 'ntt__late' : undefined}>
                  {t.due_on ? dueLabel(t.due_on, today) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import Icon, { type IconName } from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import {
  compareTasks,
  dueLabel,
  isOverdue,
  localDay,
  priorityMix,
  REPEAT_LABEL,
  SECTORS,
  SECTOR_LABEL,
  type Notice,
  type Priority,
  type Repeat,
  type Sector,
} from './notices'
import { Assignee, LinkText, PriorityChip, TaskCheck } from './TaskBits'

const SECTOR_ICON: Record<Sector, IconName> = {
  local: 'home',
  taller: 'printer',
  compras: 'cart',
  presupuesto: 'receipt',
}

type ById = (id: string | null) => Operator | undefined

// Four fixed columns. Each one adds tasks inline and keeps today's done ones
// at the bottom, crossed out.
export default function NoticeBoard({
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
  onQuickAdd,
}: {
  tasks: readonly Notice[]
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
  onQuickAdd: (sector: Sector, body: string) => Promise<void>
}) {
  return (
    <div className="ntb-board">
      {SECTORS.map((s) => (
        <BoardColumn
          key={s}
          sector={s}
          tasks={tasks.filter((t) => t.sector === s)}
          today={today}
          byId={byId}
          onToggle={onToggle}
          onOpen={onOpen}
          onQuickAdd={onQuickAdd}
        />
      ))}
    </div>
  )
}

function BoardColumn({
  sector,
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
  onQuickAdd,
}: {
  sector: Sector
  tasks: readonly Notice[]
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
  onQuickAdd: (sector: Sector, body: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const pending = tasks
    .filter((t) => !t.done_at)
    .sort((a, b) => compareTasks(a, b, today))
  const done = tasks.filter((t) => t.done_at)
  const label = SECTOR_LABEL[sector]

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || adding) return
    setAdding(true)
    try {
      await onQuickAdd(sector, body)
      setText('')
    } catch {
      // The page already said it failed; keep the text to retry.
    } finally {
      setAdding(false)
    }
  }

  const card = (t: Notice) => (
    <li key={t.id}>
      <TaskCard
        task={t}
        today={today}
        byId={byId}
        onToggle={onToggle}
        onOpen={onOpen}
      />
    </li>
  )

  return (
    <section className={`ntb-col ntb-col--${sector}`} aria-label={label}>
      <header className="ntb-col__head">
        <Icon name={SECTOR_ICON[sector]} size={18} />
        <h2>{label}</h2>
        <span className="ntb-col__n">{pending.length}</span>
        <p className="ntb-col__mix">{priorityMix(pending)}</p>
      </header>
      <ul className="ntb-list">{pending.map(card)}</ul>
      <form className="ntb-add" onSubmit={submit}>
        <Icon name="plus" size={16} />
        <input
          aria-label={`Agregar en ${label}`}
          placeholder={`Agregar en ${label}…`}
          value={text}
          disabled={adding}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
      {done.length > 0 && (
        <>
          <p className="ntb-done-title">Hechas hoy · {done.length}</p>
          <ul className="ntb-list">{done.map(card)}</ul>
        </>
      )}
    </section>
  )
}

function TaskCard({
  task,
  today,
  byId,
  onToggle,
  onOpen,
}: {
  task: Notice
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
}) {
  const late = isOverdue(task, today)
  const done = !!task.done_at
  const lastToday = !!task.last_done_at && localDay(task.last_done_at) === today
  const lastBy = byId(task.last_done_by)?.name
  return (
    <article
      className={`ntb-card${late ? ' is-late' : ''}${done ? ' is-done' : ''}`}
    >
      <div className="ntb-card__top">
        <PriorityChip priority={task.priority as Priority} />
        {task.due_on && (
          <span className={`ntb-due${late ? ' is-late' : ''}`}>
            <Icon name="calendar" size={13} />
            {dueLabel(task.due_on, today)}
          </span>
        )}
      </div>
      <div className="ntb-card__main">
        <TaskCheck task={task} onToggle={onToggle} />
        <button
          type="button"
          className="ntb-card__body"
          onClick={() => onOpen(task)}
        >
          {task.body}
        </button>
      </div>
      {task.link && <LinkText link={task.link} />}
      <div className="ntb-card__foot">
        {task.repeat && (
          <span className="ntb-repeat">
            <Icon name="auto" size={13} />
            {REPEAT_LABEL[task.repeat as Repeat]}
          </span>
        )}
        {lastToday && (
          <span className="ntb-last">
            hecha{lastBy ? ` por ${lastBy}` : ''} hoy
          </span>
        )}
        <Assignee person={byId(task.assignee_id)} />
      </div>
    </article>
  )
}

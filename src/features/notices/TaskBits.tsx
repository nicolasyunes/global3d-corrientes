import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import { isLink, PRIORITY_LABEL, type Notice, type Priority } from './notices'

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={`ntb-prio ntb-prio--${priority}`}>
      <span className="ntb-prio__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

export function TaskCheck({
  task,
  onToggle,
}: {
  task: Notice
  onToggle: (task: Notice) => void
}) {
  const done = !!task.done_at
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${done ? 'Desmarcar' : 'Marcar como hecha'}: ${task.body}`}
      className="nt__box"
      onClick={() => onToggle(task)}
    >
      {done && <Icon name="check" size={14} />}
    </button>
  )
}

export function Assignee({ person }: { person: Operator | undefined }) {
  if (!person)
    return (
      <span className="ntb-who is-none">
        <span className="ntb-who__empty" aria-hidden="true" />
        Sin asignar
      </span>
    )
  return (
    <span className="ntb-who">
      <span className="avatar avatar--sm" style={{ background: person.color }}>
        {person.initials}
      </span>
      {person.name}
    </span>
  )
}

export function LinkText({ link }: { link: string }) {
  if (!isLink(link))
    return (
      <span className="ntb-link">
        <Icon name="link" size={13} />
        {link}
      </span>
    )
  return (
    <a className="ntb-link" href={link} target="_blank" rel="noreferrer">
      <Icon name="link" size={13} />
      {link.replace(/^https?:\/\//i, '')}
    </a>
  )
}

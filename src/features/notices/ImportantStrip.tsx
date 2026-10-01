import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { noticeAge, sortNotices, visibleNotices } from './notices'
import type { NoticesState } from './useNotices'
import './notices.css'

const SHOWN = 2

// The thin bar on top of Hoy with what is marked important. With nothing
// important it is not there at all.
export default function ImportantStrip({ notices }: { notices: NoticesState }) {
  const { byId } = useOperator()
  const open = visibleNotices(notices.rows ?? [])
  const important = sortNotices(open).filter((n) => n.important && !n.done_at)
  if (important.length === 0) return null

  function goToCard() {
    const card = document.getElementById('avisos')
    card?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    card?.focus({ preventScroll: true })
  }

  const rest = important.length - SHOWN
  return (
    <section className="nts" aria-label="Avisos importantes">
      <span className="nts__icon" aria-hidden="true">
        <Icon name="flag" size={17} />
      </span>
      <ul className="nts__list">
        {important.slice(0, SHOWN).map((n) => (
          <li key={n.id}>
            <strong>{n.body}</strong>
            <span>
              {n.kind === 'task' ? 'Tarea · ' : ''}
              {byId(n.created_by)?.name ?? ''}
              {byId(n.created_by) ? ' · ' : ''}
              {noticeAge(n.created_at)}
            </span>
          </li>
        ))}
        {rest > 0 && (
          <li className="nts__more">
            y {rest} {rest === 1 ? 'importante más' : 'importantes más'}
          </li>
        )}
      </ul>
      <button type="button" className="nts__all" onClick={goToCard}>
        Ver todos
        <span className="num">{open.length}</span>
      </button>
    </section>
  )
}

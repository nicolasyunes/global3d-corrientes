import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import { noticeAge, untilLabel, type Notice } from './notices'

// Notices to read, in the colour whoever wrote them chose. Pinned go first.
export default function NoticeCartelera({
  notices,
  today,
  byId,
  hidden,
  onToggleHidden,
  onNew,
  onOpen,
}: {
  notices: readonly Notice[]
  today: string
  byId: (id: string | null) => Operator | undefined
  hidden: boolean
  onToggleHidden: () => void
  onNew: () => void
  onOpen: (notice: Notice) => void
}) {
  const n = notices.length
  return (
    <section className="ntc" aria-label="Cartelera">
      <header className="ntc__head">
        <Icon name="pin" className="ntc__icon" />
        <h2>Cartelera</h2>
        <span className="ntc__hint">
          {n} {n === 1 ? 'aviso activo' : 'avisos activos'} · se van solos
          cuando vencen
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onNew}
        >
          <Icon name="plus" size={16} />
          Nuevo aviso
        </button>
        <button
          type="button"
          className="ntc__hide"
          aria-expanded={!hidden}
          onClick={onToggleHidden}
        >
          {hidden ? 'Mostrar' : 'Ocultar'}
        </button>
      </header>
      {!hidden &&
        (n === 0 ? (
          <p className="td-empty">
            No hay avisos. Cargá uno con “Nuevo aviso”.
          </p>
        ) : (
          <ul className="ntc__grid">
            {notices.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`ntc__card ntc__card--${a.color}`}
                  onClick={() => onOpen(a)}
                >
                  <strong>
                    {a.pinned && (
                      <Icon name="pin" size={15} className="ntc__pin" />
                    )}
                    {a.body}
                  </strong>
                  <span className="ntc__meta">
                    <span>
                      {[byId(a.created_by)?.name, noticeAge(a.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {a.expires_on && (
                      <span>{untilLabel(a.expires_on, today)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}

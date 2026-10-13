import Icon from '@/components/Icon'
import {
  accessTags,
  CATEGORY_LABEL,
  domainOf,
  initialOf,
  type Category,
  type Resource,
} from './resources'

export function ResourceCard({
  resource,
  onTogglePin,
  onEdit,
}: {
  resource: Resource
  onTogglePin: (r: Resource) => void
  onEdit: (r: Resource) => void
}) {
  const r = resource
  return (
    <article className="rs-card">
      <header className="rs-card__head">
        <span
          className={`rs-initial rs-initial--${r.category}`}
          aria-hidden="true"
        >
          {initialOf(r.name)}
        </span>
        <span className="rs-card__who">
          <button
            type="button"
            className="rs-card__name"
            onClick={() => onEdit(r)}
          >
            {r.name}
          </button>
          <span className="rs-card__site">{domainOf(r.url)}</span>
        </span>
        <button
          type="button"
          className={`rs-star${r.pinned ? ' is-on' : ''}`}
          aria-pressed={r.pinned}
          aria-label={`${r.pinned ? 'Soltar' : 'Fijar'} ${r.name}`}
          title={r.pinned ? 'Soltar de arriba' : 'Fijar arriba'}
          onClick={() => onTogglePin(r)}
        >
          <Icon name="star" size={18} />
        </button>
      </header>
      {r.description && <p className="rs-card__desc">{r.description}</p>}
      <footer className="rs-card__foot">
        <span className="rs-tags">
          {accessTags(r).map((t) => (
            <span key={t} className="rs-tag">
              {t}
            </span>
          ))}
        </span>
        <a
          className="btn btn--dark btn--sm"
          href={r.url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir
          <Icon name="external" size={14} />
        </a>
      </footer>
    </article>
  )
}

export function PinnedCard({ resource }: { resource: Resource }) {
  const r = resource
  return (
    <a className="rs-pin" href={r.url} target="_blank" rel="noreferrer">
      <span
        className={`rs-initial rs-initial--${r.category}`}
        aria-hidden="true"
      >
        {initialOf(r.name)}
      </span>
      <span className="rs-pin__text">
        <strong>{r.name}</strong>
        <span>{CATEGORY_LABEL[r.category as Category]}</span>
      </span>
      <Icon name="external" size={16} />
    </a>
  )
}

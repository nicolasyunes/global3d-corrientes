import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import type { Collection } from '@/features/ideas/ideas'
import { lastUsedLabel, type SavedSearch } from './resources'

export default function SavedSearches({
  searches,
  collections,
  siteCount,
  onOpen,
  onDelete,
}: {
  searches: readonly SavedSearch[]
  collections: readonly Collection[]
  siteCount: (s: SavedSearch) => number
  onOpen: (s: SavedSearch) => void
  onDelete: (s: SavedSearch) => void
}) {
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <section className="card rs-side" aria-label="Búsquedas guardadas">
      <h2 className="rs-side__title">
        <Icon name="search" size={18} />
        Búsquedas guardadas
      </h2>
      {searches.length === 0 ? (
        <p className="rs-empty">
          Todavía no hay. Escribí una búsqueda arriba y tocá “Guardar esta
          búsqueda”.
        </p>
      ) : (
        <ul className="rs-saved">
          {searches.map((s) => {
            const n = siteCount(s)
            const col = collections.find((c) => c.id === s.collection_id)
            return (
              <li key={s.id} className="rs-saved__row">
                <div className="rs-saved__text">
                  <strong>{s.name}</strong>
                  <span>
                    “{s.query}” · {n} {n === 1 ? 'sitio' : 'sitios'} ·{' '}
                    {lastUsedLabel(s.last_used_at)}
                  </span>
                  {col && (
                    <Link to="/admin/ideas" className="rs-saved__col">
                      <Icon name="bulb" size={13} />
                      Colección {col.name}
                    </Link>
                  )}
                </div>
                {confirm === s.id ? (
                  <span className="rs-confirm">
                    ¿Borrar?
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => onDelete(s)}
                    >
                      Sí
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setConfirm(null)}
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <span className="rs-saved__actions">
                    <button
                      type="button"
                      className="icon-btn rs-saved__open"
                      aria-label={`Abrir búsqueda ${s.name}`}
                      onClick={() => onOpen(s)}
                    >
                      <Icon name="external" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Borrar búsqueda ${s.name}`}
                      onClick={() => setConfirm(s.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

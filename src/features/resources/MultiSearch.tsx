import { useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import type { Collection } from '@/features/ideas/ideas'
import type { Resource, SavedSearch } from './resources'

// Dark band: type once, open one tab per chosen site.
export default function MultiSearch({
  sites,
  selected,
  query,
  blocked,
  active,
  collections,
  onQuery,
  onToggle,
  onSearch,
  onClearActive,
  onSave,
}: {
  sites: readonly Resource[]
  selected: readonly string[]
  query: string
  blocked: readonly { name: string; url: string }[]
  active: SavedSearch | null
  collections: readonly Collection[]
  onQuery: (q: string) => void
  onToggle: (id: string) => void
  onSearch: () => void
  onClearActive: () => void
  onSave: (name: string, collectionId: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [collection, setCollection] = useState('')
  const [busy, setBusy] = useState(false)
  const n = selected.length
  const ready = query.trim().length > 0 && n > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (ready) onSearch()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !query.trim() || busy) return
    setBusy(true)
    try {
      await onSave(name.trim(), collection || null)
      setSaving(false)
      setName('')
      setCollection('')
    } catch {
      // The page shows the error; keep the form to retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="rs-search"
      aria-label="Buscar un modelo en todos los sitios"
    >
      <header className="rs-search__head">
        <h2>Buscar un modelo en todos los sitios</h2>
        <span>Escribís una vez y se abre una pestaña por sitio</span>
      </header>
      <form className="rs-search__row" onSubmit={submit}>
        <label className="rs-search__field">
          <Icon name="search" size={18} />
          <input
            aria-label="Qué modelo buscás"
            placeholder="Ej: portalápices gato"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn btn--primary rs-search__go"
          disabled={!ready}
        >
          Buscar en {n} {n === 1 ? 'sitio' : 'sitios'}
          <Icon name="external" size={16} />
        </button>
      </form>
      <div className="rs-search__where">
        <span className="rs-search__label">Dónde</span>
        <div
          className="rs-search__chips"
          role="group"
          aria-label="Dónde buscar"
        >
          {sites.map((s) => {
            const on = selected.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                className="rs-site"
                aria-pressed={on}
                onClick={() => onToggle(s.id)}
              >
                {on && <Icon name="check" size={14} />}
                {s.name}
              </button>
            )
          })}
        </div>
        {!saving && (
          <button
            type="button"
            className="rs-search__save"
            disabled={!query.trim()}
            onClick={() => setSaving(true)}
          >
            <Icon name="star" size={15} />
            Guardar esta búsqueda
          </button>
        )}
      </div>
      {active && (
        <p className="rs-search__active">
          Búsqueda activa: <strong>{active.name}</strong>
          <button
            type="button"
            aria-label="Soltar la búsqueda activa"
            onClick={onClearActive}
          >
            <Icon name="close" size={14} />
          </button>
        </p>
      )}
      {saving && (
        <form className="rs-search__form" onSubmit={save}>
          <input
            className="input"
            aria-label="Nombre de la búsqueda"
            placeholder="Nombre, ej: Día de la Madre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select
            className="input"
            aria-label="Colección de Ideas"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">Sin colección</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !name.trim()}
          >
            Guardar búsqueda
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setSaving(false)}
          >
            Cancelar
          </button>
        </form>
      )}
      {blocked.length > 0 && (
        <div className="rs-search__blocked" role="status">
          <p>
            Se{' '}
            {blocked.length === 1
              ? 'bloqueó 1 pestaña'
              : `bloquearon ${blocked.length} pestañas`}
            . Permití ventanas emergentes para este sitio (en la barra de
            direcciones) o abrilas acá:
          </p>
          <ul>
            {blocked.map((b) => (
              <li key={b.url}>
                <a href={b.url} target="_blank" rel="noreferrer">
                  Abrir {b.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

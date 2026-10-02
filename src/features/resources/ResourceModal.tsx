import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { readLink } from '@/features/ideas/ideas.api'
import { isUrl } from '@/features/ideas/ideas'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  domainOf,
  initialOf,
  isSearchTemplate,
  PRICES,
  PRICE_LABEL,
  type Category,
  type Price,
  type Resource,
} from './resources'
import { createResource, deleteResource, updateResource } from './resources.api'

// Add or edit one resource. Pasting a link reads the page to fill the name.
// Never asks for passwords: only which account the team uses.
export default function ResourceModal({
  resource,
  category,
  operatorId,
  onClose,
  onSaved,
  onDeleted,
}: {
  resource: Resource | null
  category: Category
  operatorId: string | null
  onClose: () => void
  onSaved: (resource: Resource) => void
  onDeleted: (id: string) => void
}) {
  const [url, setUrl] = useState(resource?.url ?? '')
  const [read, setRead] = useState<{ title: string; site: string } | null>(null)
  const [name, setName] = useState(resource?.name ?? '')
  const [cat, setCat] = useState<Category>(
    (resource?.category as Category) ?? category,
  )
  const [description, setDescription] = useState(resource?.description ?? '')
  const [price, setPrice] = useState<Price>(
    (resource?.price as Price) ?? 'gratis',
  )
  const [account, setAccount] = useState(resource?.needs_account ?? false)
  const [hint, setHint] = useState(resource?.account_hint ?? '')
  const [searchable, setSearchable] = useState(!!resource?.search_url)
  const [template, setTemplate] = useState(resource?.search_url ?? '')
  const [pinned, setPinned] = useState(resource?.pinned ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function readPage() {
    const link = url.trim()
    if (!isUrl(link)) return
    const preview = await readLink(link)
    const title = preview.title?.trim() || domainOf(link)
    setRead({ title, site: domainOf(link) })
    setName((n) => n || title)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const link = url.trim()
    if (!name.trim() || !isUrl(link)) {
      setError('Poné un nombre y un link que empiece con https://.')
      return
    }
    if (searchable && !isSearchTemplate(template)) {
      setError(
        'La dirección de búsqueda tiene que empezar con https:// y tener {q} donde va la palabra.',
      )
      return
    }
    setBusy(true)
    setError(null)
    const fields = {
      name: name.trim(),
      url: link,
      category: cat,
      description: description.trim() || null,
      price,
      needs_account: account,
      account_hint: account ? hint.trim() || null : null,
      search_url: searchable ? template.trim() : null,
      pinned,
    }
    try {
      onSaved(
        resource
          ? await updateResource(resource.id, fields)
          : await createResource(fields, operatorId),
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  async function remove() {
    if (!resource) return
    setBusy(true)
    setError(null)
    try {
      await deleteResource(resource.id)
      onDeleted(resource.id)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  const title = resource ? 'Editar recurso' : 'Agregar recurso'
  return (
    <div
      className="rs-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="rs-modal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <form className="rs-modal__box" onSubmit={save}>
        <header className="rs-modal__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="rs-modal__body">
          <label className="rs-link">
            <Icon name="link" size={18} />
            <input
              aria-label="Link del recurso"
              placeholder="Pegá el link del sitio"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => void readPage()}
              autoFocus={!resource}
            />
          </label>
          {read && (
            <div className="rs-read">
              <span
                className="rs-initial rs-initial--reparar"
                aria-hidden="true"
              >
                {initialOf(read.title)}
              </span>
              <span>
                <span className="rs-read__label">Leído de la página</span>
                <strong>{read.title}</strong>
                <span className="rs-read__site">{read.site}</span>
              </span>
            </div>
          )}

          {error && (
            <p className="banner banner--error" role="alert">
              {error}
            </p>
          )}

          <div className="rs-field">
            <label className="field-label" htmlFor="rs-name">
              Nombre
            </label>
            <input
              id="rs-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="rs-field">
            <span className="field-label">Categoría</span>
            <div className="rs-chips" role="group" aria-label="Categoría">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(c)}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="rs-field">
            <label className="field-label" htmlFor="rs-desc">
              Para qué lo usamos
            </label>
            <textarea
              id="rs-desc"
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="rs-field">
            <span className="field-label">Precio</span>
            <div className="rs-chips" role="group" aria-label="Precio">
              {PRICES.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={price === p}
                  onClick={() => setPrice(p)}
                >
                  {PRICE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="rs-field">
            <span className="field-label">Acceso</span>
            <div className="rs-chips" role="group" aria-label="Acceso">
              <button
                type="button"
                aria-pressed={!account}
                onClick={() => setAccount(false)}
              >
                Sin cuenta
              </button>
              <button
                type="button"
                aria-pressed={account}
                onClick={() => setAccount(true)}
              >
                Con cuenta
              </button>
            </div>
            {account && (
              <input
                className="input"
                aria-label="Con qué cuenta entramos"
                placeholder="Con qué cuenta entramos (sin contraseña)"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            )}
          </div>

          <div className="rs-field">
            <label className="rs-check">
              <input
                type="checkbox"
                checked={searchable}
                onChange={(e) => setSearchable(e.target.checked)}
              />
              Incluir en "Buscar en todos los sitios"
            </label>
            {searchable && (
              <>
                <input
                  className="input"
                  aria-label="Dirección de búsqueda"
                  placeholder="https://sitio.com/buscar?q={q}"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
                <p className="rs-hint">
                  Pegá la dirección de búsqueda del sitio, con {'{q}'} donde va
                  la palabra.
                </p>
              </>
            )}
          </div>

          <label className="rs-check">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Fijar arriba
          </label>
        </div>

        <footer className="rs-modal__foot">
          {resource &&
            (confirming ? (
              <span className="rs-confirm">
                ¿Borrar este recurso?
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirming(false)}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn--ghost rs-del"
                onClick={() => setConfirming(true)}
              >
                Borrar
              </button>
            ))}
          <span className="rs-spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Icon name="check" size={16} />
            Guardar recurso
          </button>
        </footer>
      </form>
    </div>
  )
}

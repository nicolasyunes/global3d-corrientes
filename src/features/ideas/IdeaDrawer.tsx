import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import FileDrop from './FileDrop'
import {
  detectSource,
  isUrl,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUSES,
  validateIdeaFile,
  type Collection,
  type Idea,
  type IdeaFile,
  type IdeaPriority,
  type IdeaStatus,
} from './ideas'
import {
  deleteIdea,
  deleteIdeaFile,
  ideaFileUrl,
  readLink,
  updateIdea,
  uploadIdeaFile,
} from './ideas.api'
import './ideas.css'

function sizeText(bytes: number | null): string {
  if (!bytes) return ''
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Side panel for one idea: every field saves on its own.
export default function IdeaDrawer({
  idea,
  collections,
  onClose,
  onChange,
  onDeleted,
}: {
  idea: Idea
  collections: readonly Collection[]
  onClose: () => void
  onChange: (idea: Idea) => void
  onDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState(idea.title)
  const [url, setUrl] = useState(idea.url ?? '')
  const [notes, setNotes] = useState(idea.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<File[]>([])
  const [big, setBig] = useState<IdeaFile | null>(null)

  useEffect(() => {
    setTitle(idea.title)
    setUrl(idea.url ?? '')
    setNotes(idea.notes ?? '')
  }, [idea.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (big) setBig(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, big])

  async function patch(fields: Partial<Idea>) {
    setError(null)
    try {
      await updateIdea(idea.id, fields)
      onChange({ ...idea, ...fields })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  async function saveUrl() {
    const link = url.trim()
    if (link === (idea.url ?? '')) return
    if (link && !isUrl(link)) {
      setError('Ese link no parece válido.')
      return
    }
    if (!link) {
      await patch({ url: null, preview_image_url: null, preview_author: null })
      return
    }
    setBusy(true)
    const p = await readLink(link)
    setBusy(false)
    await patch({
      url: link,
      source: detectSource(link),
      preview_image_url: p.image,
      preview_author: p.author,
    })
  }

  async function addFiles(list: File[]) {
    const problems = list.map(validateIdeaFile).filter(Boolean)
    const ok = list.filter((f) => !validateIdeaFile(f))
    setError(problems.length ? problems.join(' ') : null)
    if (!ok.length) return
    setBusy(true)
    const files = [...idea.files]
    const bad: File[] = []
    for (const file of ok) {
      try {
        files.push(await uploadIdeaFile(idea.id, file, files.length))
      } catch {
        bad.push(file)
      }
    }
    setBusy(false)
    setFailed(bad)
    if (bad.length)
      setError(`No se pudo subir: ${bad.map((f) => f.name).join(', ')}.`)
    onChange({ ...idea, files })
  }

  async function removeFile(file: IdeaFile) {
    if (!window.confirm(`¿Borrar ${file.file_name}?`)) return
    try {
      await deleteIdeaFile(file)
      onChange({ ...idea, files: idea.files.filter((f) => f.id !== file.id) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `¿Borrar la idea “${idea.title}”? También se borran sus fotos y archivos.`,
      )
    )
      return
    setBusy(true)
    try {
      await deleteIdea(idea)
      onDeleted(idea.id)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  const media = idea.files.filter((f) => f.kind !== 'model')
  const models = idea.files.filter((f) => f.kind === 'model')
  const source = detectSource(idea.url)

  return (
    <div
      className="idrawer"
      role="dialog"
      aria-modal="true"
      aria-label={idea.title}
    >
      <button
        type="button"
        className="imodal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside className="idrawer__panel">
        <header className="idrawer__head">
          <input
            className="idrawer__title"
            aria-label="Nombre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() =>
              title.trim() && title.trim() !== idea.title
                ? void patch({ title: title.trim() })
                : setTitle(idea.title)
            }
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="idrawer__body">
          <div className="istatus" role="group" aria-label="Estado">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`istatus__btn istatus__btn--${s}`}
                aria-pressed={idea.status === s}
                onClick={() =>
                  idea.status !== s && void patch({ status: s as IdeaStatus })
                }
              >
                <i aria-hidden="true" />
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {idea.preview_image_url && (
            <a
              className="idrawer__cover"
              href={idea.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={idea.preview_image_url}
                alt=""
                referrerPolicy="no-referrer"
              />
              <span className="isource">
                <Icon name="link" size={12} />
                {SOURCE_LABEL[source]}
              </span>
            </a>
          )}

          <label className="imodal__field">
            <span className="field-label">Link</span>
            <span className="idrawer__link">
              <input
                className="input"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => void saveUrl()}
              />
              {idea.url && (
                <a
                  className="icon-btn"
                  href={idea.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir el link"
                >
                  <Icon name="external" size={18} />
                </a>
              )}
            </span>
          </label>

          <div className="imodal__row">
            <label className="imodal__field imodal__field--grow">
              <span className="field-label">Colección</span>
              <select
                className="input"
                value={idea.collection_id ?? ''}
                onChange={(e) =>
                  void patch({ collection_id: e.target.value || null })
                }
              >
                <option value="">Sin colección</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="imodal__field">
              <span className="field-label">Prioridad</span>
              <div
                className="segmented iprio"
                role="group"
                aria-label="Prioridad"
              >
                {(['normal', 'high'] as IdeaPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={idea.priority === p}
                    onClick={() =>
                      idea.priority !== p && void patch({ priority: p })
                    }
                  >
                    {p === 'normal' ? 'Normal' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="imodal__field">
            <span className="field-label">Notas</span>
            <textarea
              className="input"
              rows={3}
              placeholder="Medidas, colores, para quién…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() =>
                notes.trim() !== (idea.notes ?? '') &&
                void patch({ notes: notes.trim() || null })
              }
            />
          </label>

          <section className="idrawer__section">
            <h3 className="idrawer__h">Fotos y videos</h3>
            {media.length > 0 && (
              <ul className="igrid">
                {media.map((f) => (
                  <li key={f.id} className="ithumb ithumb--lg">
                    <button
                      type="button"
                      className="ithumb__open"
                      aria-label={`Ver ${f.file_name}`}
                      onClick={() => setBig(f)}
                    >
                      {f.kind === 'video' ? (
                        <video src={ideaFileUrl(f.storage_path)} muted />
                      ) : (
                        <img src={ideaFileUrl(f.storage_path)} alt="" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="ithumb__del"
                      aria-label={`Borrar ${f.file_name}`}
                      onClick={() => void removeFile(f)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="idrawer__section">
            <h3 className="idrawer__h">Archivos 3D</h3>
            {models.length === 0 ? (
              <p className="muted">Todavía no hay STL/3MF.</p>
            ) : (
              <ul className="ifiles">
                {models.map((f) => (
                  <li key={f.id}>
                    <Icon name="cube" size={18} />
                    <span className="ifiles__name">{f.file_name}</span>
                    <span className="ifiles__size">
                      {sizeText(f.size_bytes)}
                    </span>
                    <a
                      className="icon-btn"
                      href={`${ideaFileUrl(f.storage_path)}?download=${encodeURIComponent(f.file_name)}`}
                      aria-label={`Descargar ${f.file_name}`}
                    >
                      <Icon name="download" size={18} />
                    </a>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Borrar ${f.file_name}`}
                      onClick={() => void removeFile(f)}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <FileDrop
            onFiles={(f) => void addFiles(f)}
            title="Sumar fotos o archivos"
          />
          {busy && <p className="muted">Guardando…</p>}
          {error && (
            <p className="banner banner--error" role="alert">
              {error}
              {failed.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void addFiles(failed)}
                >
                  Reintentar
                </button>
              )}
            </p>
          )}
        </div>

        <footer className="idrawer__foot">
          <button
            type="button"
            className="btn btn--ghost idrawer__danger"
            onClick={() => void remove()}
            disabled={busy}
          >
            <Icon name="trash" size={16} />
            Borrar idea
          </button>
        </footer>
      </aside>

      {big && (
        <div className="ibig" role="dialog" aria-label={big.file_name}>
          <button
            type="button"
            className="ibig__scrim"
            aria-label="Cerrar"
            onClick={() => setBig(null)}
          />
          {big.kind === 'video' ? (
            <video src={ideaFileUrl(big.storage_path)} controls autoPlay />
          ) : (
            <img src={ideaFileUrl(big.storage_path)} alt={big.file_name} />
          )}
        </div>
      )}
    </div>
  )
}

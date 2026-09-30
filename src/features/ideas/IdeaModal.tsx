import { useEffect, useRef, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import FileDrop from './FileDrop'
import {
  detectSource,
  fileKind,
  isUrl,
  SOURCE_LABEL,
  validateIdeaFile,
  type Collection,
  type Idea,
  type IdeaPriority,
} from './ideas'
import {
  createIdea,
  readLink,
  uploadIdeaFile,
  type LinkPreview,
} from './ideas.api'
import './ideas.css'

interface Pending {
  file: File
  preview: string | null
}

export function PendingThumbs({
  files,
  onRemove,
}: {
  files: Pending[]
  onRemove: (index: number) => void
}) {
  if (!files.length) return null
  return (
    <ul className="ithumbs">
      {files.map((p, i) => (
        <li key={`${p.file.name}-${i}`} className="ithumb">
          {p.preview ? (
            fileKind(p.file.name, p.file.type) === 'video' ? (
              <video src={p.preview} muted />
            ) : (
              <img src={p.preview} alt="" />
            )
          ) : (
            <span className="ithumb__model">
              <Icon name="cube" size={20} />
              <span>{p.file.name}</span>
            </span>
          )}
          <button
            type="button"
            className="ithumb__del"
            aria-label={`Quitar ${p.file.name}`}
            onClick={() => onRemove(i)}
          >
            <Icon name="close" size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function usePendingFiles() {
  const [files, setFiles] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)
  const urls = useRef<string[]>([])

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  function add(list: File[]) {
    const errors: string[] = []
    const ok: Pending[] = []
    for (const file of list) {
      const problem = validateIdeaFile(file)
      if (problem) {
        errors.push(problem)
        continue
      }
      const kind = fileKind(file.name, file.type)
      const preview =
        kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null
      if (preview) urls.current.push(preview)
      ok.push({ file, preview })
    }
    setError(errors.length ? errors.join(' ') : null)
    setFiles((prev) => [...prev, ...ok])
  }

  function remove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return { files, error, add, remove, clear: () => setFiles([]) }
}

// "Agregar idea": paste a link and it is read; photos and 3D files by drop,
// picker or Ctrl+V. Only the name is required.
export default function IdeaModal({
  collections,
  defaultCollectionId = null,
  onClose,
  onSaved,
}: {
  collections: readonly Collection[]
  defaultCollectionId?: string | null
  onClose: () => void
  onSaved: (idea: Idea, warning?: string) => void
}) {
  const { current } = useOperator()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [reading, setReading] = useState(false)
  const [title, setTitle] = useState('')
  const titleTouched = useRef(false)
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? '')
  const [priority, setPriority] = useState<IdeaPriority>('normal')
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = usePendingFiles()

  const link = url.trim()
  const validLink = isUrl(link)
  const source = validLink ? detectSource(link) : null

  useEffect(() => {
    if (!validLink) {
      setPreview(null)
      setReading(false)
      return
    }
    let cancelled = false
    setReading(true)
    const t = setTimeout(() => {
      void readLink(link).then((p) => {
        if (cancelled) return
        setPreview(p)
        setReading(false)
        if (p.title && !titleTouched.current) setTitle(p.title)
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [link, validLink])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setNameError('Poné un nombre.')
      return
    }
    setNameError(null)
    setSaving(true)
    setSaveError(null)
    try {
      const hasPhoto = pending.files.some(
        (p) => fileKind(p.file.name, p.file.type) !== 'model',
      )
      const idea = await createIdea({
        title: title.trim(),
        url: validLink ? link : null,
        source: source ?? (hasPhoto ? 'photo' : 'other'),
        preview_image_url: preview?.image ?? null,
        preview_author: preview?.author ?? null,
        collection_id: collectionId || null,
        priority,
        created_by: current?.id ?? null,
      })
      // The idea is saved; a failed upload is reported, not fatal.
      const failed: string[] = []
      for (const [i, p] of pending.files.entries()) {
        try {
          idea.files.push(await uploadIdeaFile(idea.id, p.file, i))
        } catch {
          failed.push(p.file.name)
        }
      }
      onSaved(
        idea,
        failed.length
          ? `Idea guardada, pero no se pudo subir: ${failed.join(', ')}. Probá de nuevo desde la idea.`
          : undefined,
      )
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'No se pudo guardar la idea.',
      )
    } finally {
      setSaving(false)
    }
  }

  const readFailed =
    validLink && !reading && preview && !preview.title && !preview.image

  return (
    <div
      className="imodal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imodal-title"
    >
      <button
        type="button"
        className="imodal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !saving && onClose()}
      />
      <form className="imodal__panel" onSubmit={save} noValidate>
        <header className="imodal__head">
          <h2 id="imodal-title">Agregar idea</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="imodal__body">
          <label className="ilink">
            <Icon name="link" size={18} />
            <span className="visually-hidden">Link</span>
            <input
              type="url"
              aria-label="Link"
              placeholder="Pegá un link de MakerWorld, Cults, Instagram…"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          {validLink && (
            <div className="ipreview" aria-live="polite">
              <div className="ipreview__img">
                {preview?.image ? (
                  <img
                    src={preview.image}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Icon name="image" size={26} />
                )}
                {source && (
                  <span className="isource">
                    <Icon name="link" size={12} />
                    {SOURCE_LABEL[source]}
                  </span>
                )}
              </div>
              <div className="ipreview__text">
                {reading ? (
                  <p className="ipreview__eyebrow">Leyendo el link…</p>
                ) : readFailed ? (
                  <>
                    <p className="ipreview__eyebrow is-warn">
                      No se pudo leer el link
                    </p>
                    <p className="ipreview__sub">
                      Poné el nombre y pegá una captura con Ctrl+V.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="ipreview__eyebrow">Leído del link</p>
                    <strong>{preview?.title ?? 'Sin título'}</strong>
                    <p className="ipreview__sub">
                      {[
                        new URL(link).hostname.replace(/^www\./, ''),
                        preview?.author,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="imodal__files">
            <FileDrop onFiles={pending.add} />
            <PendingThumbs files={pending.files} onRemove={pending.remove} />
          </div>
          {pending.error && <p className="omodal__err">{pending.error}</p>}

          <div className="imodal__row">
            <label className="imodal__field imodal__field--grow">
              <span className="field-label">Nombre</span>
              <input
                className="input"
                aria-label="Nombre"
                value={title}
                onChange={(e) => {
                  titleTouched.current = true
                  setTitle(e.target.value)
                }}
              />
              {nameError && <span className="omodal__err">{nameError}</span>}
            </label>
            <label className="imodal__field">
              <span className="field-label">Colección</span>
              <select
                className="input"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
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
                <button
                  type="button"
                  aria-pressed={priority === 'normal'}
                  onClick={() => setPriority('normal')}
                >
                  Normal
                </button>
                <button
                  type="button"
                  aria-pressed={priority === 'high'}
                  onClick={() => setPriority('high')}
                >
                  Alta
                </button>
              </div>
            </div>
          </div>

          <p className="imodal__hint">
            <Icon name="cube" size={16} />
            Archivos STL/3MF: los podés sumar ahora o después, desde la idea.
          </p>
          {saveError && (
            <p className="banner banner--error" role="alert">
              {saveError}
            </p>
          )}
        </div>

        <footer className="imodal__foot">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar idea'}
          </button>
        </footer>
      </form>
    </div>
  )
}

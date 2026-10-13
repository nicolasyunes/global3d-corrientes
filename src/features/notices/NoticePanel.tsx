import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { COLORS, COLOR_LABEL, type Notice, type NoticeColor } from './notices'
import { createNotice, updateNotice } from './notices.api'

// Side panel to add or edit a notice of the board.
export default function NoticePanel({
  notice,
  operatorId,
  onClose,
  onSaved,
  onArchive,
}: {
  notice: Notice | null
  operatorId: string | null
  onClose: () => void
  onSaved: (notice: Notice) => void
  onArchive: (notice: Notice) => void
}) {
  const [body, setBody] = useState(notice?.body ?? '')
  const [color, setColor] = useState<NoticeColor>(
    (notice?.color as NoticeColor) ?? 'amarillo',
  )
  const [pinned, setPinned] = useState(notice?.pinned ?? false)
  const [expires, setExpires] = useState(notice?.expires_on ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    const fields = { body: text, color, pinned, expires_on: expires || null }
    try {
      onSaved(
        notice
          ? await updateNotice(notice.id, fields)
          : await createNotice('notice', fields, operatorId),
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  const title = notice ? 'Editar aviso' : 'Nuevo aviso'
  return (
    <div className="ntp" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="ntp__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <form className="ntp__panel" onSubmit={save}>
        <header className="ntp__head">
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

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <label className="field-label" htmlFor="ntp-notice">
          Aviso
        </label>
        <textarea
          id="ntp-notice"
          className="input ntp__text"
          rows={2}
          placeholder="Ej: el jueves cerramos a las 18"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        <p className="field-label">Color</p>
        <div className="ntp__swatches" role="group" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ntp__swatch ntc__card--${c}`}
              aria-pressed={color === c}
              aria-label={COLOR_LABEL[c]}
              title={COLOR_LABEL[c]}
              onClick={() => setColor(c)}
            >
              {color === c && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>

        <div className="ntp__row">
          <label className="ntp__check">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Fijar adelante
          </label>
          <div>
            <label className="field-label" htmlFor="ntp-until">
              Hasta
            </label>
            <input
              id="ntp-until"
              type="date"
              className="input"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        </div>
        <p className="muted ntp__hint">
          Sin fecha, queda hasta que alguien lo archive.
        </p>

        <footer className="ntp__foot">
          {notice && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onArchive(notice)}
            >
              Archivar
            </button>
          )}
          <span className="ntp__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !body.trim()}
          >
            <Icon name="check" size={16} />
            Guardar
          </button>
        </footer>
      </form>
    </div>
  )
}

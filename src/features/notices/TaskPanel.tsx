import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  REPEAT_LABEL,
  SECTORS,
  SECTOR_LABEL,
  type Notice,
  type Priority,
  type Repeat,
  type Sector,
} from './notices'
import { createNotice, deleteNotice, updateNotice } from './notices.api'

const REPEATS: Repeat[] = ['day', 'week', 'month']

// Side panel to add or edit a task. Delete asks here, not in a browser box.
export default function TaskPanel({
  task,
  sector,
  operators,
  operatorId,
  onClose,
  onSaved,
  onArchive,
  onDeleted,
}: {
  task: Notice | null
  sector: Sector
  operators: readonly Operator[]
  operatorId: string | null
  onClose: () => void
  onSaved: (task: Notice) => void
  onArchive: (task: Notice) => void
  onDeleted: (id: string) => void
}) {
  const [body, setBody] = useState(task?.body ?? '')
  const [sec, setSec] = useState<Sector>((task?.sector as Sector) ?? sector)
  const [priority, setPriority] = useState<Priority>(
    (task?.priority as Priority) ?? 'media',
  )
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '')
  const [due, setDue] = useState(task?.due_on ?? '')
  const [repeat, setRepeat] = useState(task?.repeat ?? '')
  const [link, setLink] = useState(task?.link ?? '')
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

  async function save(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    const fields = {
      body: text,
      sector: sec,
      priority,
      assignee_id: assignee || null,
      due_on: due || null,
      repeat: repeat || null,
      link: link.trim() || null,
    }
    try {
      onSaved(
        task
          ? await updateNotice(task.id, fields)
          : await createNotice('task', fields, operatorId),
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  async function remove() {
    if (!task) return
    setBusy(true)
    try {
      await deleteNotice(task.id)
      onDeleted(task.id)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  const title = task ? 'Editar tarea' : 'Nueva tarea'
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

        <label className="field-label" htmlFor="ntp-body">
          Tarea
        </label>
        <textarea
          id="ntp-body"
          className="input ntp__text"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        <p className="field-label">Sector</p>
        <div className="ntp__chips" role="group" aria-label="Sector">
          {SECTORS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sec === s}
              onClick={() => setSec(s)}
            >
              {SECTOR_LABEL[s]}
            </button>
          ))}
        </div>

        <p className="field-label">Importancia</p>
        <div className="ntp__chips" role="group" aria-label="Importancia">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="ntp__row">
          <div>
            <label className="field-label" htmlFor="ntp-who">
              Asignada a
            </label>
            <select
              id="ntp-who"
              className="input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {operators
                .filter((o) => o.active || o.id === assignee)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ntp-due">
              Fecha
            </label>
            <input
              id="ntp-due"
              type="date"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ntp-repeat">
              Repetir
            </label>
            <select
              id="ntp-repeat"
              className="input"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            >
              <option value="">No se repite</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r].replace(/^c/, 'C')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="field-label" htmlFor="ntp-link">
          Vínculo
        </label>
        <input
          id="ntp-link"
          className="input"
          placeholder="Texto o link (opcional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        <footer className="ntp__foot">
          {task &&
            (confirming ? (
              <span className="ntp__confirm">
                ¿Borrar para siempre?
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => void remove()}
                  disabled={busy}
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
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onArchive(task)}
                >
                  Archivar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost ntp__del"
                  onClick={() => setConfirming(true)}
                >
                  Borrar
                </button>
              </>
            ))}
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

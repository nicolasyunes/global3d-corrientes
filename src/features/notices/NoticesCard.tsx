import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import {
  KIND_LABEL,
  noticeAge,
  openTasks,
  sortNotices,
  visibleNotices,
  type Notice,
  type NoticeKind,
} from './notices'
import {
  archiveNotice,
  createNotice,
  listNotices,
  markTask,
  setPriority,
} from './notices.api'
import './notices.css'

const KINDS: NoticeKind[] = ['notice', 'task']
const COMPACT_SHOWN = 4

// Hoy's board for the shop and the workshop: notices to read and tasks to
// tick. Anyone adds one; ticking a task keeps who did it and when.
export default function NoticesCard({
  compact = false,
}: {
  // On Hoy: the first few, with a link to the full screen.
  compact?: boolean
}) {
  const { current, byId } = useOperator()
  const operatorId = current?.id ?? null
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<NoticeKind>('notice')
  const [body, setBody] = useState('')
  const [important, setFlag] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await listNotices())
      setError(null)
    } catch (err) {
      setRows([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los avisos.',
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = sortNotices(visibleNotices(rows ?? []))
  const pending = openTasks(shown)
  const listed = compact ? shown.slice(0, COMPACT_SHOWN) : shown

  function replace(next: Notice) {
    setRows((prev) => (prev ?? []).map((n) => (n.id === next.id ? next : n)))
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const created = await createNotice(
        kind,
        { body: text, priority: important ? 'alta' : 'media' },
        operatorId,
      )
      setRows((prev) => [created, ...(prev ?? [])])
      setBody('')
      setFlag(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleDone(n: Notice) {
    try {
      replace(await markTask(n, !n.done_at, operatorId))
    } catch {
      showToast('No se pudo marcar la tarea.')
    }
  }

  async function toggleImportant(n: Notice) {
    const next = n.priority === 'alta' ? 'media' : 'alta'
    replace({ ...n, priority: next })
    try {
      await setPriority(n.id, next)
    } catch {
      replace(n)
      showToast('No se pudo cambiar.')
    }
  }

  async function archive(n: Notice) {
    setRows((prev) => (prev ?? []).filter((x) => x.id !== n.id))
    try {
      await archiveNotice(n.id, true, operatorId)
      showToast(`${KIND_LABEL[n.kind as NoticeKind]} archivado`, {
        label: 'Deshacer',
        onClick: () => {
          void archiveNotice(n.id, false, operatorId).then(load)
        },
      })
    } catch {
      setRows((prev) => [n, ...(prev ?? [])])
      showToast('No se pudo archivar.')
    }
  }

  return (
    <section className="card td-card nt" aria-label="Avisos">
      <div className="td-card__head">
        <Icon name="chat" className="td-card__icon" />
        <h2>Avisos</h2>
        {pending > 0 && (
          <span className="nt__count">
            {pending} {pending === 1 ? 'tarea pendiente' : 'tareas pendientes'}
          </span>
        )}
        {compact && (
          <Link to="/admin/avisos" className="td-card__link">
            {shown.length > COMPACT_SHOWN
              ? `Ver los ${shown.length} →`
              : 'Ver todos →'}
          </Link>
        )}
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {rows == null ? (
        <p className="td-empty">Cargando avisos…</p>
      ) : shown.length === 0 ? (
        <p className="td-empty">
          No hay avisos ni tareas. Escribí el primero acá abajo.
        </p>
      ) : (
        <ul className="nt__list">
          {listed.map((n) => {
            const isTask = n.kind === 'task'
            const done = !!n.done_at
            const who = byId(n.created_by)?.name
            const doneBy = byId(n.done_by)?.name
            return (
              <li
                key={n.id}
                className={`nt__row${n.priority === 'alta' && !done ? ' is-important' : ''}${done ? ' is-done' : ''}`}
              >
                {isTask ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`${done ? 'Desmarcar' : 'Marcar como hecha'}: ${n.body}`}
                    className="nt__box"
                    onClick={() => void toggleDone(n)}
                  >
                    {done && <Icon name="check" size={14} />}
                  </button>
                ) : (
                  <span className="nt__mark" aria-hidden="true">
                    <Icon name="chat" size={14} />
                  </span>
                )}
                <span className="nt__text">
                  <span className="nt__body">{n.body}</span>
                  <span className="nt__meta">
                    {isTask ? 'Tarea' : 'Aviso'}
                    {n.priority === 'alta' && !done && (
                      <strong className="nt__flag"> · Importante</strong>
                    )}
                    {' · '}
                    {done
                      ? `hecha${doneBy ? ` por ${doneBy}` : ''} ${noticeAge(n.done_at!)}`
                      : `${who ? `${who} · ` : ''}${noticeAge(n.created_at)}`}
                  </span>
                </span>
                <span className="nt__actions">
                  {!done && (
                    <button
                      type="button"
                      className={`icon-btn nt__btn${n.priority === 'alta' ? ' is-on' : ''}`}
                      aria-pressed={n.priority === 'alta'}
                      aria-label={`${n.priority === 'alta' ? 'Quitar de' : 'Marcar como'} importante: ${n.body}`}
                      title="Importante"
                      onClick={() => void toggleImportant(n)}
                    >
                      <Icon name="flag" size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn nt__btn"
                    aria-label={`Archivar: ${n.body}`}
                    title="Archivar"
                    onClick={() => void archive(n)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <form className="nt__form" onSubmit={add}>
        <div className="segmented" role="group" aria-label="Tipo">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <input
          className="input nt__input"
          aria-label={kind === 'task' ? 'Nueva tarea' : 'Nuevo aviso'}
          placeholder={
            kind === 'task'
              ? 'Ej: limpiar la cama de la impresora 2'
              : 'Ej: el jueves cerramos a las 18'
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          className={`icon-btn nt__btn nt__flagbtn${important ? ' is-on' : ''}`}
          aria-pressed={important}
          aria-label="Marcar como importante"
          title="Importante"
          onClick={() => setFlag((v) => !v)}
        >
          <Icon name="flag" size={18} />
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={busy || !body.trim()}
        >
          <Icon name="plus" size={16} />
          Agregar
        </button>
      </form>
      {toast}
    </section>
  )
}

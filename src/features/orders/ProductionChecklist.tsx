import { useEffect, useState } from 'react'
import {
  TASK_LOCATION,
  TASK_LOCATION_LABELS,
  type TaskLocation,
} from '@/lib/domain-constants'
import {
  createProductionTask,
  deleteProductionTask,
  listProductionTasks,
  updateProductionTask,
  type ProductionTaskRow,
} from './orders.api'
import './orders.css'

interface ProductionChecklistProps {
  orderId: string
}

// A per-order checklist for what's left to make and what's already done —
// built for the case where a job is split across people/places (e.g. one
// part printed at home, another at the shop): each task carries an optional
// location tag alongside its done/pending state. Unlike order_items (which
// OrderForm re-submits wholesale on save), tasks are checked off and added
// incrementally over the course of production, so each action hits the API
// directly rather than batching into a form submit.
export default function ProductionChecklist({ orderId }: ProductionChecklistProps) {
  const [tasks, setTasks] = useState<ProductionTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [newLabel, setNewLabel] = useState('')
  const [newLocation, setNewLocation] = useState<TaskLocation | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    listProductionTasks(orderId)
      .then((rows) => {
        if (!cancelled) setTasks(rows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la checklist de producción.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  async function handleToggle(task: ProductionTaskRow) {
    setBusyId(task.id)
    setError(null)
    try {
      const updated = await updateProductionTask(task.id, { done: !task.done })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo actualizar la tarea.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(task: ProductionTaskRow) {
    setBusyId(task.id)
    setError(null)
    try {
      await deleteProductionTask(task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo quitar la tarea.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    setAdding(true)
    setError(null)
    try {
      const created = await createProductionTask(
        orderId,
        { label, location: newLocation },
        tasks.length,
      )
      setTasks((prev) => [...prev, created])
      setNewLabel('')
      setNewLocation(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo agregar la tarea.',
      )
    } finally {
      setAdding(false)
    }
  }

  const done = tasks.filter((t) => t.done).length

  if (loading) return null

  return (
    <section className="form-section production-checklist">
      <div className="production-checklist__header">
        <h2 className="form-section__heading">Producción</h2>
        {tasks.length > 0 && (
          <span className="production-checklist__progress">
            {done}/{tasks.length} listas
          </span>
        )}
      </div>
      <p className="field__hint">
        Detallá las partes del trabajo — quién la hace y dónde — para saber
        qué falta y qué ya está.
      </p>

      {error && (
        <p className="form-banner form-banner--error" role="alert">
          {error}
        </p>
      )}

      {tasks.length > 0 && (
        <ul className="task-list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`task-row${task.done ? ' task-row--done' : ''}`}
            >
              <label className="task-row__check">
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={busyId === task.id}
                  onChange={() => void handleToggle(task)}
                />
                <span className="task-row__label">{task.label}</span>
              </label>
              {task.location && (
                <span className="badge task-row__location">
                  {TASK_LOCATION_LABELS[task.location as TaskLocation] ??
                    task.location}
                </span>
              )}
              <button
                type="button"
                className="task-row__remove"
                aria-label={`Quitar ${task.label}`}
                disabled={busyId === task.id}
                onClick={() => void handleRemove(task)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="task-add">
        <input
          type="text"
          className="field__input"
          placeholder="Ej: Tapa, base, pintura…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
        />
        <div className="chips task-add__locations">
          {TASK_LOCATION.map((location) => (
            <button
              key={location}
              type="button"
              className={`chip${newLocation === location ? ' chip--selected' : ''}`}
              aria-pressed={newLocation === location}
              onClick={() =>
                setNewLocation((prev) => (prev === location ? null : location))
              }
            >
              {TASK_LOCATION_LABELS[location]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="link-btn"
          disabled={adding || newLabel.trim() === ''}
          onClick={() => void handleAdd()}
        >
          {adding ? 'Agregando…' : '+ Agregar tarea'}
        </button>
      </div>
    </section>
  )
}

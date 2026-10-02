import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import { toISODate } from '@/features/orders/validation'
import NoticeBoard from './NoticeBoard'
import NoticeCartelera from './NoticeCartelera'
import NoticePanel from './NoticePanel'
import NoticeTable from './NoticeTable'
import TaskPanel from './TaskPanel'
import { PriorityChip } from './TaskBits'
import {
  activeNotices,
  boardTasks,
  filterTasks,
  FILTERS,
  FILTER_LABEL,
  KIND_LABEL,
  PRIORITIES,
  taskSummary,
  type Notice,
  type NoticeKind,
  type Priority,
  type Sector,
  type TaskFilter,
} from './notices'
import {
  archiveNotice,
  createNotice,
  listNotices,
  markTask,
} from './notices.api'
import './notices.css'

type View = 'tablero' | 'tabla'
const HIDE_KEY = 'nt-cartelera-hidden'

function initialView(): View {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 700px)').matches
    ? 'tabla'
    : 'tablero'
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

// The team's screen: notices to read on top, tasks by sector below.
export default function NoticesPage() {
  const { current, byId, operators } = useOperator()
  const me = current?.id ?? null
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>(initialView)
  const [filter, setFilter] = useState<TaskFilter>('todas')
  const [prios, setPrios] = useState<Priority[]>([])
  const [query, setQuery] = useState('')
  const [hidden, setHidden] = useState(readHidden)
  const [taskPanel, setTaskPanel] = useState<{
    task: Notice | null
    sector: Sector
  } | null>(null)
  const [noticePanel, setNoticePanel] = useState<{
    notice: Notice | null
  } | null>(null)
  const today = toISODate(new Date())

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

  const all = rows ?? []
  const notices = activeNotices(all, today)
  const tasks = boardTasks(all, today)
  const pending = tasks.filter((t) => !t.done_at)
  const opts = { filter, priorities: prios, query, me, today }
  const shown = filterTasks(tasks, opts)
  const sum = taskSummary(tasks, today)

  function upsert(n: Notice) {
    setRows((prev) => {
      const list = prev ?? []
      return list.some((x) => x.id === n.id)
        ? list.map((x) => (x.id === n.id ? n : x))
        : [n, ...list]
    })
  }

  function drop(id: string) {
    setRows((prev) => (prev ?? []).filter((x) => x.id !== id))
  }

  async function toggle(t: Notice) {
    try {
      upsert(await markTask(t, !t.done_at, me))
    } catch {
      showToast('No se pudo marcar la tarea.')
    }
  }

  async function quickAdd(sector: Sector, body: string) {
    try {
      upsert(await createNotice('task', { body, sector }, me))
    } catch (err) {
      showToast('No se pudo agregar.')
      throw err
    }
  }

  async function archive(n: Notice) {
    setTaskPanel(null)
    setNoticePanel(null)
    drop(n.id)
    try {
      await archiveNotice(n.id, true, me)
      showToast(`${KIND_LABEL[n.kind as NoticeKind]} archivado`, {
        label: 'Deshacer',
        onClick: () => {
          void archiveNotice(n.id, false, me).then(load)
        },
      })
    } catch {
      upsert(n)
      showToast('No se pudo archivar.')
    }
  }

  function toggleHidden() {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1')
      } catch {
        // Only a convenience.
      }
      return !h
    })
  }

  function togglePrio(p: Priority) {
    setPrios((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
    )
  }

  return (
    <main className="td ntpage">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Equipo</p>
          <h1 className="page-title">Avisos y tareas</h1>
          <p className="ntpage__sum">
            {sum.pending} {sum.pending === 1 ? 'pendiente' : 'pendientes'}
            {sum.alta > 0 && (
              <>
                {' · '}
                <strong className="ntpage__alta">
                  {sum.alta} de importancia alta
                </strong>
              </>
            )}
            {sum.overdue > 0 &&
              ` · ${sum.overdue} ${sum.overdue === 1 ? 'vencida' : 'vencidas'}`}
          </p>
        </div>
        <div className="page-head__actions">
          <div className="segmented" role="group" aria-label="Vista">
            <button
              type="button"
              aria-pressed={view === 'tabla'}
              onClick={() => setView('tabla')}
            >
              <Icon name="list" size={16} />
              Tabla
            </button>
            <button
              type="button"
              aria-pressed={view === 'tablero'}
              onClick={() => setView('tablero')}
            >
              <Icon name="kanban" size={16} />
              Tablero
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setTaskPanel({ task: null, sector: 'local' })}
          >
            <Icon name="plus" size={18} />
            Nueva tarea
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      <NoticeCartelera
        notices={notices}
        today={today}
        byId={byId}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        onNew={() => setNoticePanel({ notice: null })}
        onOpen={(notice) => setNoticePanel({ notice })}
      />

      <div className="ntf">
        <div className="segmented ntf__tabs" role="group" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABEL[f]}
              <span className="ntf__n">
                {
                  filterTasks(pending, { ...opts, filter: f, priorities: [] })
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="ntf__prio" role="group" aria-label="Importancia">
          <span className="ntf__label">Importancia</span>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className="ntf__chip"
              aria-pressed={prios.includes(p)}
              onClick={() => togglePrio(p)}
            >
              <PriorityChip priority={p} />
              <span className="ntf__n">
                {pending.filter((t) => t.priority === p).length}
              </span>
            </button>
          ))}
        </div>
        <label className="ntf__search">
          <Icon name="search" size={16} />
          <input
            aria-label="Buscar tarea"
            placeholder="Buscar tarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {rows == null ? (
        <p className="td-empty">Cargando…</p>
      ) : view === 'tablero' ? (
        <NoticeBoard
          tasks={shown}
          today={today}
          byId={byId}
          onToggle={(t) => void toggle(t)}
          onOpen={(task) =>
            setTaskPanel({ task, sector: task.sector as Sector })
          }
          onQuickAdd={quickAdd}
        />
      ) : (
        <NoticeTable
          tasks={shown}
          today={today}
          byId={byId}
          onToggle={(t) => void toggle(t)}
          onOpen={(task) =>
            setTaskPanel({ task, sector: task.sector as Sector })
          }
        />
      )}

      {taskPanel && (
        <TaskPanel
          task={taskPanel.task}
          sector={taskPanel.sector}
          operators={operators}
          operatorId={me}
          onClose={() => setTaskPanel(null)}
          onSaved={(n) => {
            upsert(n)
            setTaskPanel(null)
          }}
          onArchive={(n) => void archive(n)}
          onDeleted={(id) => {
            drop(id)
            setTaskPanel(null)
            showToast('Tarea borrada')
          }}
        />
      )}
      {noticePanel && (
        <NoticePanel
          notice={noticePanel.notice}
          operatorId={me}
          onClose={() => setNoticePanel(null)}
          onSaved={(n) => {
            upsert(n)
            setNoticePanel(null)
          }}
          onArchive={(n) => void archive(n)}
        />
      )}
      {toast}
    </main>
  )
}

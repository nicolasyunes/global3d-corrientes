import type { Database } from '@/lib/database.types'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'

export type Notice = Database['public']['Tables']['notices']['Row']
export type NoticeUpdate = Database['public']['Tables']['notices']['Update']
export type NoticeKind = 'notice' | 'task'
export type Sector = 'local' | 'taller' | 'compras' | 'presupuesto'
export type Priority = 'alta' | 'media' | 'baja'
export type Repeat = 'day' | 'week' | 'month'
export type NoticeColor = 'amarillo' | 'rosa' | 'celeste' | 'verde' | 'lila'
export type TaskFilter = 'todas' | 'mias' | 'sin' | 'vencidas'
export type TaskSortKey = 'body' | 'sector' | 'priority' | 'assignee' | 'due'

export const KIND_LABEL: Record<NoticeKind, string> = {
  notice: 'Aviso',
  task: 'Tarea',
}
export const SECTORS: Sector[] = ['local', 'taller', 'compras', 'presupuesto']
export const SECTOR_LABEL: Record<Sector, string> = {
  local: 'Local',
  taller: 'Taller',
  compras: 'Compras y faltantes',
  presupuesto: 'Presupuesto',
}
export const PRIORITIES: Priority[] = ['alta', 'media', 'baja']
export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}
const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 }
export const REPEAT_LABEL: Record<Repeat, string> = {
  day: 'cada día',
  week: 'cada semana',
  month: 'cada mes',
}
export const COLORS: NoticeColor[] = [
  'amarillo',
  'rosa',
  'celeste',
  'verde',
  'lila',
]
export const COLOR_LABEL: Record<NoticeColor, string> = {
  amarillo: 'Amarillo',
  rosa: 'Rosa',
  celeste: 'Celeste',
  verde: 'Verde',
  lila: 'Lila',
}
export const FILTERS: TaskFilter[] = ['todas', 'mias', 'sin', 'vencidas']
export const FILTER_LABEL: Record<TaskFilter, string> = {
  todas: 'Todas',
  mias: 'Mías',
  sin: 'Sin asignar',
  vencidas: 'Vencidas',
}

const DAY = 86_400_000

// Calendar day (local time) of a timestamp.
export function localDay(stamp: string): string {
  return toISODate(new Date(stamp))
}

export function isLink(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

// ---------- Hoy ----------

// What Hoy shows: everything not archived nor expired, and done tasks only
// for a day after they were ticked so the list does not fill up.
export function visibleNotices(rows: readonly Notice[], now = Date.now()) {
  const today = toISODate(new Date(now))
  return rows.filter(
    (n) =>
      !n.archived_at &&
      (!n.expires_on || n.expires_on >= today) &&
      (!n.done_at || now - new Date(n.done_at).getTime() < DAY),
  )
}

// High importance first, then what is still open (newest first), done last.
export function sortNotices(rows: readonly Notice[]): Notice[] {
  const rank = (n: Notice) => (n.done_at ? 2 : n.priority === 'alta' ? 0 : 1)
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function openTasks(rows: readonly Notice[]): number {
  return rows.filter((n) => n.kind === 'task' && !n.done_at).length
}

// ---------- Cartelera ----------

// Notices still in force: pinned first, then newest.
export function activeNotices(rows: readonly Notice[], today: string) {
  return rows
    .filter(
      (n) =>
        n.kind === 'notice' &&
        !n.archived_at &&
        (!n.expires_on || n.expires_on >= today),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
}

// ---------- Tablero ----------

// Pending tasks plus the ones ticked today ("Hechas hoy").
export function boardTasks(rows: readonly Notice[], today: string) {
  return rows.filter(
    (n) =>
      n.kind === 'task' &&
      !n.archived_at &&
      (!n.done_at || localDay(n.done_at) === today),
  )
}

export function isOverdue(task: Notice, today: string): boolean {
  return !task.done_at && !!task.due_on && task.due_on < today
}

// Overdue first, then alta → media → baja, then by date (none last), then
// newest.
export function compareTasks(a: Notice, b: Notice, today: string): number {
  return (
    Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
    PRIORITY_RANK[a.priority as Priority] -
      PRIORITY_RANK[b.priority as Priority] ||
    (a.due_on ?? '9999-12-31').localeCompare(b.due_on ?? '9999-12-31') ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

function addMonthISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(y, m + 1, 0).getDate()
  return toISODate(new Date(y, m, Math.min(d, last)))
}

// Next date of a repeated task: from its date if it is still ahead, from
// today if it was late or had none.
export function nextDue(
  due: string | null,
  repeat: Repeat,
  today: string,
): string {
  const base = due && due >= today ? due : today
  if (repeat === 'day') return addDaysISO(base, 1)
  if (repeat === 'week') return addDaysISO(base, 7)
  return addMonthISO(base)
}

// Ticking a repeated task logs who did it and pushes the date; it stays
// pending. Any other task is simply done or undone.
export function markPatch(
  task: Notice,
  done: boolean,
  operatorId: string | null,
  now = new Date(),
): NoticeUpdate {
  const stamp = now.toISOString()
  if (done && task.repeat)
    return {
      last_done_at: stamp,
      last_done_by: operatorId,
      due_on: nextDue(task.due_on, task.repeat as Repeat, toISODate(now)),
    }
  return { done_at: done ? stamp : null, done_by: done ? operatorId : null }
}

export function filterTasks(
  tasks: readonly Notice[],
  opts: {
    filter: TaskFilter
    priorities: readonly Priority[]
    query: string
    me: string | null
    today: string
  },
): Notice[] {
  const q = opts.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (opts.filter === 'mias' && t.assignee_id !== opts.me) return false
    if (opts.filter === 'sin' && t.assignee_id) return false
    if (opts.filter === 'vencidas' && !isOverdue(t, opts.today)) return false
    if (
      opts.priorities.length &&
      !opts.priorities.includes(t.priority as Priority)
    )
      return false
    if (q && !`${t.body} ${t.link ?? ''}`.toLowerCase().includes(q))
      return false
    return true
  })
}

export function taskSummary(tasks: readonly Notice[], today: string) {
  const pending = tasks.filter((t) => !t.done_at)
  return {
    pending: pending.length,
    alta: pending.filter((t) => t.priority === 'alta').length,
    overdue: pending.filter((t) => isOverdue(t, today)).length,
  }
}

// "1 alta · 1 media · 1 baja", skipping the empty ones.
export function priorityMix(tasks: readonly Notice[]): string {
  return PRIORITIES.map(
    (p) => [p, tasks.filter((t) => t.priority === p).length] as const,
  )
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${n} ${p}`)
    .join(' · ')
}

// Table order: done tasks always last; inside, by the chosen column.
export function sortTasksBy(
  tasks: readonly Notice[],
  key: TaskSortKey | null,
  dir: 1 | -1,
  nameOf: (id: string | null) => string,
  today: string,
): Notice[] {
  const val = (t: Notice): string | number => {
    if (key === 'body') return t.body.toLowerCase()
    if (key === 'sector') return SECTORS.indexOf(t.sector as Sector)
    if (key === 'priority') return PRIORITY_RANK[t.priority as Priority]
    if (key === 'assignee') return nameOf(t.assignee_id) || '￿'
    return t.due_on ?? '9999-12-31'
  }
  return [...tasks].sort((a, b) => {
    const done = Number(!!a.done_at) - Number(!!b.done_at)
    if (done) return done
    if (!key) return compareTasks(a, b, today)
    const x = val(a)
    const y = val(b)
    return (x < y ? -1 : x > y ? 1 : 0) * dir || compareTasks(a, b, today)
  })
}

// ---------- Fechas ----------

const WEEKDAY = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })

function dayParts(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return { w: WEEKDAY.format(d).replace('.', ''), n: d.getDate() }
}

// "Hoy", "Ayer", "Mañana", "Sáb 3".
export function dueLabel(due: string, today: string): string {
  if (due === today) return 'Hoy'
  if (due === addDaysISO(today, -1)) return 'Ayer'
  if (due === addDaysISO(today, 1)) return 'Mañana'
  const { w, n } = dayParts(due)
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${n}`
}

// "hasta hoy", "hasta el jue 8".
export function untilLabel(expires: string, today: string): string {
  if (expires === today) return 'hasta hoy'
  const { w, n } = dayParts(expires)
  return `hasta el ${w} ${n}`
}

const TIME = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY_SHORT = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
})

// "recién", "hace 40 min", "hace 3 h", "ayer 18:20", "28 sep".
export function noticeAge(stamp: string, now = new Date()): string {
  const d = new Date(stamp)
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d >= start) return `hace ${Math.floor(mins / 60)} h`
  const days = Math.round(
    (start.getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      DAY,
  )
  if (days === 1) return `ayer ${TIME.format(d)}`
  return DAY_SHORT.format(d).replace('.', '')
}

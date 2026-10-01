import type { Database } from '@/lib/database.types'

export type Notice = Database['public']['Tables']['notices']['Row']
export type NoticeKind = 'notice' | 'task'

export const KIND_LABEL: Record<NoticeKind, string> = {
  notice: 'Aviso',
  task: 'Tarea',
}

const DAY = 86_400_000

// What Hoy shows: everything not archived, and done tasks only for a day
// after they were ticked so the list does not fill up with old work.
export function visibleNotices(rows: readonly Notice[], now = Date.now()) {
  return rows.filter(
    (n) =>
      !n.archived_at &&
      (!n.done_at || now - new Date(n.done_at).getTime() < DAY),
  )
}

// Important first, then what is still open (newest first), done tasks last.
export function sortNotices(rows: readonly Notice[]): Notice[] {
  const rank = (n: Notice) => (n.done_at ? 2 : n.important ? 0 : 1)
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function openTasks(rows: readonly Notice[]): number {
  return rows.filter((n) => n.kind === 'task' && !n.done_at).length
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

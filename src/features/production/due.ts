import { formatDueDate } from '@/features/orders/format'

export type DueTone = 'late' | 'soon' | 'ok'

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  )
}

const WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export type WeekBucket = 'late' | 'this' | 'next' | 'later'

// Weeks run Monday–Sunday. Overdue work is its own bucket so it never hides
// inside "esta semana".
export function weekBucket(due: string, today: string): WeekBucket {
  const diff = daysBetween(today, due)
  if (diff < 0) return 'late'
  const [y, m, d] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  const toSunday = (7 - weekday) % 7
  if (diff <= toSunday) return 'this'
  if (diff <= toSunday + 7) return 'next'
  return 'later'
}

export function dueInfo(
  due: string,
  today: string,
): { label: string; tone: DueTone } {
  const diff = daysBetween(today, due)
  if (diff < 0) {
    const n = -diff
    return { label: `Atrasado ${n} ${n === 1 ? 'día' : 'días'}`, tone: 'late' }
  }
  if (diff === 0) return { label: 'Hoy', tone: 'soon' }
  if (diff === 1) return { label: 'Mañana', tone: 'soon' }
  if (diff < 7) {
    const [y, m, d] = due.split('-').map(Number)
    return {
      label: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
      tone: 'ok',
    }
  }
  return { label: formatDueDate(due), tone: 'ok' }
}

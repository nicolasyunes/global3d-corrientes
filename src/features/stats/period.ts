import { toISODate } from '@/features/orders/validation'
import { comparisonRange, periodRange, previousRange, type Range } from './stats'

export type SummaryKind = 'week' | 'month' | 'year'

// `start` is the first day of the period at local midnight.
export interface SummaryPeriod {
  kind: SummaryKind
  start: Date
}

// Orders loaded in one go on 29/09 (spreadsheet migration) make September
// meaningless as a base: nothing before this day is used for comparison.
export const COMPARE_CUTOFF = new Date(2026, 8, 30)
export const MIGRATION_DAY = new Date(2026, 8, 29)

const PARAM: Record<SummaryKind, string> = { week: 'semana', month: 'mes', year: 'anio' }
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const pad = (n: number) => String(n).padStart(2, '0')

function parseAnchor(kind: SummaryKind, value: string): Date | null {
  const pattern =
    kind === 'year' ? /^(\d{4})$/ : kind === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/
  const m = pattern.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = m[2] ? Number(m[2]) - 1 : 0
  const d = m[3] ? Number(m[3]) : 1
  const date = new Date(y, mo, d)
  // Rolled-over dates (month 13, 31 Feb) are rejected.
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null
  return date
}

function currentStart(kind: SummaryKind, now: Date): Date {
  return periodRange(kind, now).from
}

export function isCurrentPeriod(period: SummaryPeriod, now: Date): boolean {
  return period.start.getTime() === currentStart(period.kind, now).getTime()
}

export function parsePeriod(params: URLSearchParams, now: Date): SummaryPeriod {
  const p = params.get('p')
  const kind: SummaryKind = p === 'semana' ? 'week' : p === 'anio' ? 'year' : 'month'
  const current = { kind, start: currentStart(kind, now) }
  const anchor = params.get('d')
  if (!anchor) return current
  const date = parseAnchor(kind, anchor)
  if (!date) return current
  const start = periodRange(kind, date).from
  return start.getTime() > current.start.getTime() ? current : { kind, start }
}

// The current period carries no anchor so the link keeps meaning "now".
export function periodToParams(period: SummaryPeriod, now: Date): Record<string, string> {
  const p = PARAM[period.kind]
  if (isCurrentPeriod(period, now)) return { p }
  const s = period.start
  const d =
    period.kind === 'year'
      ? String(s.getFullYear())
      : period.kind === 'month'
        ? `${s.getFullYear()}-${pad(s.getMonth() + 1)}`
        : toISODate(s)
  return { p, d }
}

export function shiftPeriod(period: SummaryPeriod, delta: -1 | 1, now: Date): SummaryPeriod {
  const s = period.start
  const next =
    period.kind === 'week'
      ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * delta)
      : period.kind === 'month'
        ? new Date(s.getFullYear(), s.getMonth() + delta, 1)
        : new Date(s.getFullYear() + delta, 0, 1)
  const current = currentStart(period.kind, now)
  return { kind: period.kind, start: next.getTime() > current.getTime() ? current : next }
}

export function rangeOfPeriod(period: SummaryPeriod): Range {
  return periodRange(period.kind, period.start)
}

// Open period: same elapsed stretch of the previous one. Closed period: the
// whole previous one. Null when that base starts before the migration cut.
export function comparisonFor(period: SummaryPeriod, now: Date): Range | null {
  const curr = rangeOfPeriod(period)
  const cmp = isCurrentPeriod(period, now)
    ? comparisonRange(period.kind, curr, now)
    : previousRange(period.kind, curr)
  return cmp.from.getTime() < COMPARE_CUTOFF.getTime() ? null : cmp
}

export function containsMigration(range: Range): boolean {
  const t = MIGRATION_DAY.getTime()
  return range.from.getTime() <= t && t < range.to.getTime()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function periodTitle(period: SummaryPeriod): string {
  const s = period.start
  if (period.kind === 'year') return String(s.getFullYear())
  if (period.kind === 'month') return `${capitalize(MONTHS[s.getMonth()])} ${s.getFullYear()}`
  const end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)
  if (end.getMonth() === s.getMonth()) {
    return `Semana del ${s.getDate()} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
  }
  return `Semana del ${s.getDate()} de ${MONTHS[s.getMonth()]} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
}

export function compareLabel(period: SummaryPeriod): string {
  const s = period.start
  if (period.kind === 'year') return `comparado con ${s.getFullYear() - 1}`
  if (period.kind === 'week') return 'comparado con la semana anterior'
  const prev = new Date(s.getFullYear(), s.getMonth() - 1, 1)
  return `comparado con ${MONTHS[prev.getMonth()]}`
}

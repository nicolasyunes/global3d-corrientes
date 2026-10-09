import type { Database } from '@/lib/database.types'
import type { FilamentLine } from './filaments'

type Tables = Database['public']['Tables']
export type StockCountRow = Tables['stock_counts']['Row']
export type StockCountItem = Tables['stock_count_items']['Row']
export interface StockCount extends StockCountRow {
  items: StockCountItem[]
}

export const COUNT_WARN_DAYS = 7

export function countKey(colorId: string, refill: boolean): string {
  return `${colorId}:${refill ? 'r' : 's'}`
}

// What a person counts: never carries the system's stock (the count is blind).
export interface CountRowSpec {
  key: string
  colorId: string
  refill: boolean
  colorLabel: string
  swatch: string
  suffix: string
}
export interface CountGroup {
  lineId: string
  label: string
  rows: CountRowSpec[]
}

export function countGroups(lines: readonly FilamentLine[]): CountGroup[] {
  return lines.map((line) => {
    const rows: CountRowSpec[] = []
    for (const c of line.colors) {
      // same rule as the database: a refill row exists when its stock is not null
      const both = c.stock_refill != null
      rows.push({
        key: countKey(c.id, false),
        colorId: c.id,
        refill: false,
        colorLabel: c.name,
        swatch: c.swatch,
        suffix: both ? 'Spool' : '',
      })
      if (both)
        rows.push({
          key: countKey(c.id, true),
          colorId: c.id,
          refill: true,
          colorLabel: c.name,
          swatch: c.swatch,
          suffix: 'Recarga',
        })
    }
    return { lineId: line.id, label: `${line.brand} ${line.name}`, rows }
  })
}

// '' → not counted; whole number → counted; anything else is a typo.
export function parseCounted(text: string): number | null | 'invalid' {
  const t = text.trim()
  if (t === '') return null
  return /^\d{1,4}$/.test(t) ? Number(t) : 'invalid'
}

export function draftToItems(draft: Readonly<Record<string, string>>): {
  items: { color_id: string; refill: boolean; counted: number }[]
  invalid: string[]
} {
  const items: { color_id: string; refill: boolean; counted: number }[] = []
  const invalid: string[] = []
  for (const [key, text] of Object.entries(draft)) {
    const n = parseCounted(text)
    if (n === null) continue
    if (n === 'invalid') {
      invalid.push(key)
      continue
    }
    const [color_id, kind] = key.split(':')
    items.push({ color_id, refill: kind === 'r', counted: n })
  }
  return { items, invalid }
}

export function countDiff(
  item: Pick<StockCountItem, 'counted' | 'expected'>,
): number {
  return item.counted - item.expected
}

export function summarizeCount(items: readonly StockCountItem[]) {
  const s = { total: items.length, same: 0, over: 0, short: 0, net: 0 }
  for (const it of items) {
    const d = countDiff(it)
    s.net += d
    if (d === 0) s.same += 1
    else if (d > 0) s.over += 1
    else s.short += 1
  }
  return s
}

export interface CountReminderInfo {
  days: number | null
  overdue: boolean
  pending: number
}

// Days since the last count that was not discarded, and how many wait for review.
export function countReminder(
  counts: readonly Pick<StockCountRow, 'created_at' | 'status'>[],
  now: Date,
): CountReminderInfo {
  const kept = counts.filter((c) => c.status !== 'discarded')
  const pending = counts.filter((c) => c.status === 'pending').length
  if (kept.length === 0) return { days: null, overdue: true, pending }
  const last = Math.max(...kept.map((c) => new Date(c.created_at).getTime()))
  const days = Math.floor((now.getTime() - last) / 86_400_000)
  return { days, overdue: days > COUNT_WARN_DAYS, pending }
}

export function reminderText(
  info: CountReminderInfo,
  isAdmin: boolean,
): string | null {
  const parts: string[] = []
  if (info.days === null)
    parts.push('Todavía no se hizo ningún conteo del estante.')
  else if (info.overdue)
    parts.push(`Hace ${info.days} días que no se cuenta el estante.`)
  if (isAdmin && info.pending > 0)
    parts.push(
      info.pending === 1
        ? '1 conteo espera tu revisión.'
        : `${info.pending} conteos esperan tu revisión.`,
    )
  return parts.length ? parts.join(' ') : null
}

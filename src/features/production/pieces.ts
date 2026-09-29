export type PieceStatus = 'pending' | 'printing' | 'done'

export interface PieceLike {
  status: PieceStatus | string
  quantity_done: number
  quantity_total: number
}

export type ItemState = 'none' | 'todo' | 'printing' | 'done'

export const NEXT_PIECE_STATUS: Record<PieceStatus, PieceStatus> = {
  pending: 'printing',
  printing: 'done',
  done: 'pending',
}

export function normalizeColor(color: string | null | undefined): string {
  return (color ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

const SWATCHES: [RegExp, string][] = [
  [/negr|black/, '#111111'],
  [/blanc|white/, '#FFFFFF'],
  [/rojo|red/, '#D93A2B'],
  [/celeste|sky/, '#6EC1E4'],
  [/azul|blue/, '#1E4FA8'],
  [/amarill|yellow/, '#F2C230'],
  [/dorad|oro|gold/, '#D4AF37'],
  [/platead|plata|silver/, '#C0C0C0'],
  [/gris|gray|grey/, '#8A8D91'],
  [/verde|green/, '#2E9E5B'],
  [/rosa|pink/, '#F28DB2'],
  [/naranja|orange/, '#F37021'],
  [/violeta|lila|purple|morado/, '#7E57C2'],
  [/marron|cafe|brown|dulce de leche/, '#8B5A2B'],
  [/beige|piel|crema/, '#E8D3B0'],
]

// Best-effort: colors are free text, so an unknown name simply has no swatch.
export function colorSwatch(color: string | null | undefined): string | null {
  const key = normalizeColor(color)
  if (!key) return null
  return SWATCHES.find(([re]) => re.test(key))?.[1] ?? null
}

export function itemState(pieces: readonly PieceLike[]): ItemState {
  if (pieces.length === 0) return 'none'
  if (pieces.every((p) => p.status === 'done')) return 'done'
  if (pieces.some((p) => p.status !== 'pending')) return 'printing'
  return 'todo'
}

export function progressOf(pieces: readonly PieceLike[]): {
  done: number
  total: number
} {
  return pieces.reduce(
    (acc, p) => ({
      done: acc.done + p.quantity_done,
      total: acc.total + p.quantity_total,
    }),
    { done: 0, total: 0 },
  )
}

export interface QueueEntry {
  color: string | null
  due_date: string
}

export interface QueueGroup<T extends QueueEntry> {
  key: string
  label: string
  swatch: string | null
  earliest: string
  entries: T[]
}

// "¿Qué imprimo?" by customer: one group per customer, most urgent first.
export function groupQueueByCustomer<
  T extends QueueEntry & { customer_id: string; customer_name: string },
>(entries: readonly T[]): QueueGroup<T>[] {
  const groups = new Map<string, QueueGroup<T>>()
  for (const entry of entries) {
    let group = groups.get(entry.customer_id)
    if (!group) {
      group = {
        key: entry.customer_id,
        label: entry.customer_name,
        swatch: null,
        earliest: entry.due_date,
        entries: [],
      }
      groups.set(entry.customer_id, group)
    }
    group.entries.push(entry)
    if (entry.due_date < group.earliest) group.earliest = entry.due_date
  }
  const list = [...groups.values()]
  for (const g of list)
    g.entries.sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        normalizeColor(a.color).localeCompare(normalizeColor(b.color)),
    )
  return list.sort(
    (a, b) =>
      a.earliest.localeCompare(b.earliest) || a.label.localeCompare(b.label),
  )
}

// "¿Qué imprimo?": pending pieces grouped by normalized color, groups ordered by
// their most urgent due date, entries by due date inside each group.
export function groupQueueByColor<T extends QueueEntry>(
  entries: readonly T[],
): QueueGroup<T>[] {
  const groups = new Map<string, QueueGroup<T>>()
  for (const entry of entries) {
    const key = normalizeColor(entry.color)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        label: key ? entry.color!.trim() : 'Sin color',
        swatch: colorSwatch(entry.color),
        earliest: entry.due_date,
        entries: [],
      }
      groups.set(key, group)
    }
    group.entries.push(entry)
    if (entry.due_date < group.earliest) group.earliest = entry.due_date
  }
  const list = [...groups.values()]
  for (const g of list)
    g.entries.sort((a, b) => a.due_date.localeCompare(b.due_date))
  return list.sort(
    (a, b) =>
      a.earliest.localeCompare(b.earliest) || a.label.localeCompare(b.label),
  )
}

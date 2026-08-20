// Display formatting for money and due dates. Kept locale-agnostic (a plain
// `$` + fixed decimals) — ARS locale formatting is deferred to the
// finance-registry change, which owns reconciliation and currency display.

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${value.toFixed(2)}`
}

// 'YYYY-MM-DD' → 'Wed, Aug 19'. `today` (also 'YYYY-MM-DD') shortens the
// current day to a scannable "Today" in the queue.
export function formatDueDate(iso: string, today?: string): string {
  if (today !== undefined && iso === today) return 'Today'
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

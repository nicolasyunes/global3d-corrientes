// Display formatting for money and due dates. Argentine (es-AR) locale: '.'
// thousands separator, ',' decimals, ARS peso sign.

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 'YYYY-MM-DD' → 'mié, 19 ago'. `today` (also 'YYYY-MM-DD') shortens the
// current day to a scannable "Hoy" in the queue.
export function formatDueDate(iso: string, today?: string): string {
  if (today !== undefined && iso === today) return 'Hoy'
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

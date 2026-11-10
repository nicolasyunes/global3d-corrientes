const arsFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/** $ 27.000 */
export function ars(n: number): string {
  return '$ ' + arsFormat.format(Math.round(n))
}

/** "1 día hábil" / "3 días hábiles" */
export function businessDays(n: number): string {
  return n === 1 ? '1 día hábil' : `${n} días hábiles`
}

/** 2026-11-07 → "viernes 7/11" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'long' })
  return `${weekday} ${d}/${m}`
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

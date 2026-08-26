// Pure parsing/mapping from a raw "Pedidos" sheet row to a pending-order
// record. No network, no DB — deterministic and unit-testable on its own,
// mirroring supabase/functions/sync-order-to-sheet/mapping.ts's approach.
//
// Column order matches A:K in "Pedidos" (see sync-order-to-sheet/mapping.ts):
// Columna 1 | CLIENTE | PRODUCTO | DESCRIPCION | FECHA DE ENTREGA |
// Total (ARS) | SEÑA | SALDO | CANAL | ESTADO | (K, hidden) order id

export interface PendingOrder {
  nombre: string
  producto: string
  detalles: string
  fechaEntrega: string | null // display string as it appears in the sheet
  fechaEntregaSortKey: string // ISO-ish, sorts ascending; empty dates sort last
  total: number | null
  saldo: number
  canal: string
}

// The sheet mixes manually-typed values ("1500", "$1.500", "$ 1.500,00") with
// values the app itself writes (always "$#.##0,00" — see mapping.ts's
// formatMoney). This accepts both: strips currency/space noise, then treats
// a trailing ",dd" as decimals (Argentine format); a lone "." is treated as a
// thousands separator unless it's the only separator and looks like cents.
export function parseMoneyLoose(raw: string | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-') return null

  let s = trimmed.replace(/[^\d.,-]/g, '')
  if (s === '') return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(',', '.')
  } else if (hasDot) {
    const parts = s.split('.')
    const looksLikeThousands =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
    if (looksLikeThousands) s = parts.join('')
  }

  const value = Number.parseFloat(s)
  return Number.isFinite(value) ? value : null
}

// 'dd/mm/yyyy' -> 'yyyy-mm-dd' for sorting; blank/unparseable dates sort last.
export function dateSortKey(raw: string | undefined): string {
  const match = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return '9999-99-99'
  const [, d, m, y] = match
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function toPendingOrder(row: string[]): PendingOrder | null {
  const nombre = (row[1] ?? '').trim()
  if (nombre === '') return null

  const estado = (row[9] ?? '').trim().toLowerCase()
  if (estado === 'cancelado') return null

  const saldo = parseMoneyLoose(row[7])
  if (saldo === null || saldo <= 0) return null

  const fechaEntrega = (row[4] ?? '').trim() || null

  return {
    nombre,
    producto: (row[2] ?? '').trim(),
    detalles: (row[3] ?? '').trim(),
    fechaEntrega,
    fechaEntregaSortKey: dateSortKey(row[4]),
    total: parseMoneyLoose(row[5]),
    saldo,
    canal: (row[8] ?? '').trim(),
  }
}

export function toPendingOrders(rows: string[][]): PendingOrder[] {
  return rows
    .map(toPendingOrder)
    .filter((order): order is PendingOrder => order !== null)
    .sort((a, b) => a.fechaEntregaSortKey.localeCompare(b.fechaEntregaSortKey))
}

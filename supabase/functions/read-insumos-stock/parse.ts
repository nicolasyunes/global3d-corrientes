// Pure parsing from a raw "Stock Sync" sheet row to a reconcile DTO. No
// network, no DB — deterministic and unit-testable, mirroring
// read-pending-orders/parse.ts.
//
// Column order matches A:E in the flat "Stock Sync" tab:
// A PRODUCTO (marca + tipo juntos, ej. "3N3 PLA 1kg") | B COLOR | C ROLLOS (1kg
// c/u) | D PRECIO | E SKU (clave de unión; se autocompleta con un slug si está
// vacía).
//
// Keys are snake_case to line up with the `inventory` columns the reconcile
// step writes. `material` holds the whole PRODUCTO string (no marca/tipo split).

export interface ParsedInsumo {
  sku: string
  material: string
  color: string
  rolls: number
  unit_price: number | null
}

// lower-cased, accent-stripped, dash-separated slug of producto + color — the
// fallback join key when column E (SKU) is blank.
export function slugifyInsumo(material: string, color: string): string {
  return [material, color]
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Roll count: accepts "3", "3 rollos", "3,5", "" (→ 0).
export function parseRolls(raw: string | undefined): number {
  if (!raw) return 0
  let s = raw.trim().replace(/[^\d.,-]/g, '')
  if (s === '' || s === '-') return 0
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasComma) s = s.replace(',', '.')
  const value = Number.parseFloat(s)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

// Mixed manual/app price formats: "1500", "$1.500", "$ 1.500,00". Copied from
// read-pending-orders/parse.ts (kept local — each function is self-contained).
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

// Rows without a PRODUCTO are ignored (blank line, section separator). COLOR may
// be blank for a single-colour product.
export function toInsumo(row: string[]): ParsedInsumo | null {
  const material = (row[0] ?? '').trim()
  if (material === '') return null

  const color = (row[1] ?? '').trim()
  const sku = (row[4] ?? '').trim() || slugifyInsumo(material, color)

  return {
    sku,
    material,
    color,
    rolls: parseRolls(row[2]),
    unit_price: parseMoneyLoose(row[3]),
  }
}

// Maps + drops nulls. If two rows resolve to the same sku (duplicate line) the
// last one wins, matching the sheet's own top-to-bottom read.
export function toInsumos(rows: string[][]): ParsedInsumo[] {
  const bySku = new Map<string, ParsedInsumo>()
  for (const row of rows) {
    const parsed = toInsumo(row)
    if (parsed) bySku.set(parsed.sku, parsed)
  }
  return [...bySku.values()]
}

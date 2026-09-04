// Pure mapping from an `inventory` row to a "Stock Sync" sheet row. No network,
// no DB — deterministic and unit-testable, same philosophy as
// sync-order-to-sheet/mapping.ts.
//
// Column order MUST match A:E in the "Stock Sync" tab:
// A PRODUCTO | B COLOR | C ROLLOS (1kg c/u) | D PRECIO | E SKU

export interface InventoryRecord {
  id: string
  sku: string
  material: string
  color: string | null
  remaining_grams: number | null
  unit_price: number | null
}

// grams → roll count, at most 2 decimals, trailing zeros trimmed ("3000" → "3",
// "3400" → "3.4"). USER_ENTERED lets Sheets store it as a real number.
export function gramsToRolls(grams: number | null): string {
  if (grams === null || grams === undefined) return '0'
  const rolls = grams / 1000
  return Number.parseFloat(rolls.toFixed(2)).toString()
}

// "$#.##0,00" — Argentine grouping, same formatter as
// sync-order-to-sheet/mapping.ts. Blank when there's no price.
export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return ''
  const [intPart, decPart] = value.toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$${grouped},${decPart}`
}

export function toSheetRow(inv: InventoryRecord): string[] {
  return [
    inv.material,
    inv.color ?? '',
    gramsToRolls(inv.remaining_grams),
    formatMoney(inv.unit_price),
    inv.sku,
  ]
}

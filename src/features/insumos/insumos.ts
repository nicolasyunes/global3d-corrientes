import { GRAMS_PER_ROLL, type InventoryRow } from './insumos.api'

// Pure helpers for the insumos list — no DB, no DOM, shared with the unit test.

// grams → roll count for display: whole when it divides evenly, otherwise up to
// one decimal ("3000" → "3", "3400" → "3,4"). es-AR decimal comma.
export function formatRolls(grams: number | null): string {
  const rolls = (grams ?? 0) / GRAMS_PER_ROLL
  return rolls.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

// A spool is "low" once it's under one full roll — the cue to reorder.
export function isLowStock(
  row: Pick<InventoryRow, 'remaining_grams'>,
): boolean {
  return (row.remaining_grams ?? 0) < GRAMS_PER_ROLL
}

// "producto · color", blank color dropped. `material` holds the full producto
// string from the "Stock Sync" tab (marca + tipo together).
export function insumoLabel(
  row: Pick<InventoryRow, 'material' | 'color'>,
): string {
  return [row.material, row.color].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------
// Marca / tipo derived from the free-text `material` — the planilla keeps them
// mashed together ("3N3 PLA 1kg", "BAMBU LAB PLA 1kg"), so we recover them here
// for the list filters. Pure, shared with the unit test.
// ---------------------------------------------------------------------------

// Tipos de filamento que realmente maneja el taller. Se buscan como palabra
// dentro de `material`; lo que no matchea cae en 'Otro'.
export const TIPO_TOKENS = ['PLA', 'PETG'] as const
export const TIPO_OTRO = 'Otro'

// Marcas conocidas: alias normalizado (minúsculas, sin espacios/acentos) → cómo
// se muestra. Una marca ausente de esta lista se deriva sacando tipo y peso.
const KNOWN_MARCAS: readonly { canon: string; alias: string }[] = [
  { canon: '3N3', alias: '3n3' },
  { canon: '3NFlex', alias: '3nflex' },
  { canon: '3nMax', alias: '3nmax' },
  { canon: 'FilaNova', alias: 'filanova' },
  { canon: 'BambuLab', alias: 'bambulab' },
  { canon: 'FlashForge', alias: 'flashforge' },
  { canon: 'FreeMover', alias: 'freemover' },
  { canon: 'Grilon3', alias: 'grilon3' },
  { canon: 'GST3D', alias: 'gst3d' },
  { canon: 'ELEGOO', alias: 'elegoo' },
]

function squash(value: string): string {
  return fold(value).replace(/[^a-z0-9]/g, '')
}

// Primer token de TIPO_TOKENS presente como palabra en `material`; 'Otro' si no
// hay ninguno (marcas sin tipo en el nombre: ELEGOO, FLASHFORGE, 3NFLEX).
export function insumoTipo(material: string): string {
  const up = material.toUpperCase()
  for (const tipo of TIPO_TOKENS) {
    if (new RegExp(`\\b${tipo}\\b`).test(up)) return tipo
  }
  return TIPO_OTRO
}

// Marca legible de un `material`: primero contra KNOWN_MARCAS, si no cae al
// fallback = `material` sin el tipo, sin el peso ("1kg" / "1 kg") y sin un
// "especial" final.
export function insumoMarca(material: string): string {
  const key = squash(material)
  for (const { canon, alias } of KNOWN_MARCAS) {
    if (key.startsWith(alias)) return canon
  }
  const tipo = insumoTipo(material)
  let rest = material
  if (tipo !== TIPO_OTRO) rest = rest.replace(new RegExp(`\\b${tipo}\\b`, 'i'), ' ')
  rest = rest
    .replace(/\b\d+\s*kg\b/i, ' ')
    .replace(/\bespecial\b/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return rest || material
}

// Distinct marcas / tipos present in the rows, first spelling wins on a
// case-insensitive tie. Marcas sorted es-AR; tipos keep PLA/PETG order with
// 'Otro' last. Feed the <select>s so they only offer values that exist.
export function availableMarcas(
  rows: readonly Pick<InventoryRow, 'material'>[],
): string[] {
  const seen = new Map<string, string>()
  for (const row of rows) {
    const marca = insumoMarca(row.material)
    const k = marca.toLowerCase()
    if (marca && !seen.has(k)) seen.set(k, marca)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es-AR'))
}

export function availableTipos(
  rows: readonly Pick<InventoryRow, 'material'>[],
): string[] {
  const present = new Set(rows.map((row) => insumoTipo(row.material)))
  const order = [...TIPO_TOKENS, TIPO_OTRO]
  return order.filter((tipo) => present.has(tipo))
}

// ---------------------------------------------------------------------------
// Filters for the list — pure, shared with the unit test.
// ---------------------------------------------------------------------------

// 'all' = cualquiera · 'in' = ≥ 1 rollo · 'low' = entre 0 y 1 rollo ·
// 'out' = sin stock. The three non-'all' buckets are disjoint.
export type StockFilter = 'all' | 'in' | 'low' | 'out'

export interface InsumoFilters {
  query: string // matches producto + color, accent/case-insensitive
  marca: string // '' = cualquiera; match contra insumoMarca(), case-insensitive
  tipo: string // '' = cualquiera; match contra insumoTipo(), case-insensitive
  color: string // '' = cualquiera; exact match otherwise
  stock: StockFilter
}

export function emptyInsumoFilters(): InsumoFilters {
  return { query: '', marca: '', tipo: '', color: '', stock: 'all' }
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

// Distinct non-empty colors present in the rows, sorted es-AR — feeds the color
// <select> so it only offers colors that actually exist.
export function availableColors(
  rows: readonly Pick<InventoryRow, 'color'>[],
): string[] {
  const colors = new Set<string>()
  for (const row of rows) {
    const color = row.color?.trim()
    if (color) colors.add(color)
  }
  return [...colors].sort((a, b) => a.localeCompare(b, 'es-AR'))
}

export function matchesStockFilter(
  row: Pick<InventoryRow, 'remaining_grams'>,
  filter: StockFilter,
): boolean {
  if (filter === 'all') return true
  const grams = row.remaining_grams ?? 0
  if (filter === 'in') return grams >= GRAMS_PER_ROLL
  if (filter === 'low') return grams > 0 && grams < GRAMS_PER_ROLL
  return grams <= 0 // 'out'
}

export function filterInsumos<
  T extends Pick<InventoryRow, 'material' | 'color' | 'remaining_grams'>,
>(rows: readonly T[], filters: InsumoFilters): T[] {
  const q = fold(filters.query.trim())
  return rows.filter((row) => {
    if (q && !fold(`${row.material} ${row.color ?? ''}`).includes(q)) {
      return false
    }
    if (
      filters.marca &&
      insumoMarca(row.material).toLowerCase() !== filters.marca.toLowerCase()
    ) {
      return false
    }
    if (
      filters.tipo &&
      insumoTipo(row.material).toLowerCase() !== filters.tipo.toLowerCase()
    ) {
      return false
    }
    if (filters.color && (row.color ?? '') !== filters.color) return false
    return matchesStockFilter(row, filters.stock)
  })
}

import type { Database } from '@/lib/database.types'

type Tables = Database['public']['Tables']
export type FilamentLineRow = Tables['filament_lines']['Row']
export type FilamentColor = Tables['filament_colors']['Row']
export type FilamentMovement = Tables['filament_movements']['Row']
export interface FilamentLine extends FilamentLineRow {
  colors: FilamentColor[]
}

export type Presentation = 'spool' | 'refill' | 'both'
export type MovementKind = 'purchase' | 'used' | 'adjust'
export type LogKind =
  MovementKind | 'color_added' | 'color_removed' | 'line_added' | 'line_removed'
export type FilamentLogRow = Tables['filament_log']['Row']

export const MATERIALS = ['PLA', 'PLA especial', 'PETG', 'TPU', 'Otro'] as const
export const MATERIAL_TABS = ['PLA', 'PLA especial', 'PETG', 'TPU'] as const

export const FINISHES = [
  'Estándar',
  'Mate',
  'Silk',
  'Fluo',
  'Clear',
  'Rapid',
  'Boutique',
  'Wood',
  'Traslúcido',
  'Multicolor',
] as const

export const PRESENTATION_LABEL: Record<Presentation, string> = {
  spool: 'Con spool',
  refill: 'Recarga',
  both: 'Ambas',
}

// Top edge of each brand card; a new line takes the next one.
export const ACCENTS = [
  '#b8a3d9',
  '#d9a3c0',
  '#f0dca0',
  '#cfe0e3',
  '#f5d6b8',
  '#a9c4ef',
  '#f3b8d6',
  '#8fb8bf',
  '#f5c79a',
  '#e58a7a',
  '#e98a8a',
  '#f5d98a',
]

const ARS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
export function money(n: number | null | undefined): string {
  return n == null ? '' : `$${ARS.format(n)}`
}

export function isBoth(line: Pick<FilamentLineRow, 'presentation'>): boolean {
  return line.presentation === 'both'
}

// Spools of a color counting both presentations.
export function colorTotal(color: FilamentColor): number {
  return color.stock + (color.stock_refill ?? 0)
}

export type StockState = 'out' | 'low' | 'ok'
export function stockState(color: FilamentColor): StockState {
  const total = colorTotal(color)
  if (total === 0) return 'out'
  return total <= color.min_stock ? 'low' : 'ok'
}

export function colorPrice(
  line: FilamentLineRow,
  color: FilamentColor,
  refill = false,
): number | null {
  if (refill) return line.refill_price
  return color.price ?? line.price
}

export function lineSpools(line: FilamentLine): number {
  return line.colors.reduce((n, c) => n + colorTotal(c), 0)
}

export function lineInStock(line: FilamentLine): number {
  return line.colors.filter((c) => colorTotal(c) > 0).length
}

// "3N3 PLA" → "PLA · 6/22 colores en stock"; the special PLA line lists its
// finishes instead of repeating the material.
export function lineSubtitle(line: FilamentLine): string {
  if (isBoth(line)) return `${baseMaterial(line.material)} · dos presentaciones`
  const parts = [baseMaterial(line.material)]
  if (line.material === 'PLA especial') {
    const finishes = [
      ...new Set(
        line.colors.map((c) => c.finish).filter((f) => f !== 'Estándar'),
      ),
    ]
    parts.push(...finishes)
  }
  parts.push(`${lineInStock(line)}/${line.colors.length} colores en stock`)
  return parts.join(' · ')
}

export function baseMaterial(material: string): string {
  return material === 'PLA especial' ? 'PLA' : material
}

export interface StockSummary {
  spools: number
  value: number
  outOfStock: number
  colors: number
  low: number
}

export function summarize(lines: readonly FilamentLine[]): StockSummary {
  const s: StockSummary = {
    spools: 0,
    value: 0,
    outOfStock: 0,
    colors: 0,
    low: 0,
  }
  for (const line of lines) {
    for (const c of line.colors) {
      s.colors += 1
      s.spools += colorTotal(c)
      s.value +=
        c.stock * (colorPrice(line, c) ?? 0) +
        (c.stock_refill ?? 0) * (line.refill_price ?? 0)
      const state = stockState(c)
      if (state === 'out') s.outOfStock += 1
      if (state === 'low') s.low += 1
    }
  }
  return s
}

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export interface LineFilter {
  material: string // 'all' or a material tab
  query: string
  hideEmpty: boolean
}

// Lines that match, each with only the colors that pass the filter. A search
// that names the brand keeps all of its colors.
export function filterLines(
  lines: readonly FilamentLine[],
  { material, query, hideEmpty }: LineFilter,
): FilamentLine[] {
  const q = fold(query)
  const out: FilamentLine[] = []
  for (const line of lines) {
    if (material !== 'all' && line.material !== material) continue
    const lineHit = q !== '' && fold(`${line.brand} ${line.name}`).includes(q)
    const colors = line.colors.filter(
      (c) =>
        (!hideEmpty || colorTotal(c) > 0) &&
        (q === '' || lineHit || fold(`${c.name} ${c.finish}`).includes(q)),
    )
    if (colors.length === 0 && (q !== '' || hideEmpty)) continue
    out.push({ ...line, colors })
  }
  return out
}

// ---------- Por color ----------

export type Family =
  | 'white'
  | 'black'
  | 'grey'
  | 'red'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'brown'
  | 'multi'

export const FAMILY_LABEL: Record<Family, string> = {
  white: 'Blancos y naturales',
  black: 'Negros',
  grey: 'Grises y plata',
  red: 'Rojos y bordó',
  pink: 'Rosas y fucsias',
  orange: 'Naranjas',
  yellow: 'Amarillos y dorados',
  green: 'Verdes',
  blue: 'Azules y celestes',
  violet: 'Violetas',
  brown: 'Marrones, piel y madera',
  multi: 'Multicolor y traslúcidos',
}
export const FAMILIES = Object.keys(FAMILY_LABEL) as Family[]

// Name first (it is what the workshop calls it), then the swatch's hue.
const FAMILY_WORDS: [RegExp, Family][] = [
  [/\b(tricolor|bicolor|multicolor|traslucido|tutti)/, 'multi'],
  [
    /\b(piel|wood|madera|caoba|cerezo|nogal|pino|chocolate|habano|rustico|bronce|cobre|carpincho|marron|brown|dulce de leche)/,
    'brown',
  ],
  [/\b(salmon|rosa|fucsia|magenta|rose)/, 'pink'],
  [/\b(bordo|rojo|red)\b/, 'red'],
  [/\b(naranja|orange)\b/, 'orange'],
  [/\b(amarillo|dorado|oro|gold|ambar|sunflower)\b/, 'yellow'],
  [/\b(verde|green|esmeralda|manzana)\b/, 'green'],
  [/\b(azul|celeste|turquesa|blue|sky|prusia)\b/, 'blue'],
  [/\b(violeta|lila|uva|purple|lavender|lavanda)\b/, 'violet'],
  [/\b(negro|black)\b/, 'black'],
  [/\b(gris|grey|gray|plata|silver|platino|graphite)\b/, 'grey'],
  [/\b(blanco|white|natural|beige|hueso|perla|marfil)\b/, 'white'],
]

function hexFamily(hex: string): Family {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 'multi'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d < 0.08) return l > 0.85 ? 'white' : l < 0.18 ? 'black' : 'grey'
  let h = 0
  if (max === r) h = ((g - b) / d + 6) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return l < 0.45 ? 'brown' : 'orange'
  if (h < 65) return 'yellow'
  if (h < 170) return 'green'
  if (h < 255) return 'blue'
  if (h < 300) return 'violet'
  return 'pink'
}

export function colorFamily(
  color: Pick<FilamentColor, 'name' | 'swatch' | 'finish'>,
): Family {
  if (color.finish === 'Multicolor' || color.finish === 'Traslúcido')
    return 'multi'
  const name = fold(color.name)
  for (const [re, family] of FAMILY_WORDS) if (re.test(name)) return family
  return hexFamily(color.swatch)
}

export interface ColorOption {
  line: FilamentLine
  color: FilamentColor
  // Which stock this option counts, for lines sold both ways.
  refill: boolean
  spools: number
}

export interface FamilyGroup {
  family: Family
  options: ColorOption[]
  spools: number
}

// One option per color and presentation, families in a fixed order, most
// stock first inside each.
export function familyOptions(lines: readonly FilamentLine[]): ColorOption[] {
  const out: ColorOption[] = []
  for (const line of lines) {
    for (const color of line.colors) {
      if (isBoth(line)) {
        if (color.spool_available)
          out.push({ line, color, refill: false, spools: color.stock })
        if (color.stock_refill != null)
          out.push({ line, color, refill: true, spools: color.stock_refill })
      } else out.push({ line, color, refill: false, spools: color.stock })
    }
  }
  return out
}

export function groupByFamily(
  lines: readonly FilamentLine[],
  { onlyInStock = true } = {},
): FamilyGroup[] {
  const groups = new Map<Family, ColorOption[]>()
  for (const o of familyOptions(lines)) {
    if (onlyInStock && o.spools === 0) continue
    const f = colorFamily(o.color)
    groups.set(f, [...(groups.get(f) ?? []), o])
  }
  return FAMILIES.filter((f) => groups.has(f)).map((family) => {
    const options = [...groups.get(family)!].sort((a, b) => b.spools - a.spools)
    return {
      family,
      options,
      spools: options.reduce((n, o) => n + o.spools, 0),
    }
  })
}

export function optionLabel(o: Pick<ColorOption, 'line' | 'refill'>): string {
  const base = `${o.line.brand} ${o.line.name}`
  if (!isBoth(o.line)) return base
  return `${base} · ${o.refill ? 'recarga' : 'spool'}`
}

// ---------- Movimientos ----------

export const KIND_TEXT: Record<MovementKind, string> = {
  purchase: 'compra',
  used: 'se terminó en el taller',
  adjust: 'ajuste',
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

// "$26.600", "26600", "26.600,50" → 26600. Empty → null (use the line's).
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[^\d,]/g, '').split(',')[0]
  return clean === '' ? null : Number(clean)
}

const TIME = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

// "hoy 14:30", "ayer 09:10", "12 sep".
export function moveWhen(stamp: string, now = new Date()): string {
  const d = new Date(stamp)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.floor((start.getTime() - d.getTime()) / 86_400_000)
  if (d >= start) return `hoy ${TIME.format(d)}`
  if (diff < 1) return `ayer ${TIME.format(d)}`
  return DAY.format(d).replace('.', '')
}

// ---------- Actividad ----------

export const LOG_TEXT: Record<LogKind, string> = {
  purchase: 'Compra',
  used: 'Se terminó en el taller',
  adjust: 'Ajuste de stock',
  color_added: 'Color agregado',
  color_removed: 'Color borrado',
  line_added: 'Línea nueva',
  line_removed: 'Línea borrada',
}

export type LogFilter = 'all' | 'in' | 'out' | 'setup'

export function logGroup(kind: string): 'stock' | 'setup' {
  return kind.startsWith('color_') || kind.startsWith('line_')
    ? 'setup'
    : 'stock'
}

export function filterLog(
  rows: readonly FilamentLogRow[],
  { kind, person, query }: { kind: LogFilter; person: string; query: string },
): FilamentLogRow[] {
  const q = fold(query)
  return rows.filter((r) => {
    if (person !== 'all' && r.operator_id !== person) return false
    if (kind === 'setup' && logGroup(r.kind) !== 'setup') return false
    if (kind === 'in' && !((r.delta ?? 0) > 0 && logGroup(r.kind) === 'stock'))
      return false
    if (kind === 'out' && !((r.delta ?? 0) < 0)) return false
    return (
      q === '' || fold(`${r.line_label} ${r.color_label ?? ''}`).includes(q)
    )
  })
}

const FULL = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// "1 oct, 09:25": always the full date and time, it is for auditing.
export function logStamp(stamp: string): string {
  return FULL.format(new Date(stamp)).replace('.', '')
}

const DAY_HEAD = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function logDayLabel(stamp: string, now = new Date()): string {
  const d = new Date(stamp)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((start.getTime() - dayStart.getTime()) / 86_400_000)
  const text = DAY_HEAD.format(d)
  const label = text.charAt(0).toUpperCase() + text.slice(1)
  if (diff === 0) return `Hoy · ${label}`
  if (diff === 1) return `Ayer · ${label}`
  return label
}

export function logDayKey(stamp: string): string {
  const d = new Date(stamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// ---------- Colores de muestra ----------

// The usual filament colors, to start from when matching a real spool.
export const SWATCH_PRESETS: [string, string][] = [
  ['Blanco', '#f7f5f0'],
  ['Hueso', '#efe6d2'],
  ['Beige', '#e5d3b3'],
  ['Gris claro', '#b9bcc0'],
  ['Gris', '#8f9296'],
  ['Gris espacial', '#4a4e55'],
  ['Negro', '#1d1b19'],
  ['Rojo', '#d0312d'],
  ['Bordó', '#6e1a2a'],
  ['Naranja', '#f07b22'],
  ['Amarillo', '#f2c230'],
  ['Dorado', '#caa13a'],
  ['Verde manzana', '#7ac943'],
  ['Verde', '#2e8b4a'],
  ['Turquesa', '#2bb3b1'],
  ['Celeste', '#7cc4ec'],
  ['Azul', '#2450b8'],
  ['Azul prusia', '#1f3a68'],
  ['Violeta', '#7b4bb3'],
  ['Fucsia', '#d6317e'],
  ['Rosa', '#f3a0b8'],
  ['Piel', '#d9a07a'],
  ['Bronce', '#a0703c'],
  ['Chocolate', '#5a3a24'],
]

// ---------- Exportar ----------

export type StockFilter = 'all' | 'with' | 'without'

export interface ExportOptions {
  // null = every brand.
  brands: string[] | null
  stock: StockFilter
  showStock: boolean
  showPrice: boolean
}

export function brandsOf(lines: readonly FilamentLine[]): string[] {
  return [...new Set(lines.map((l) => l.brand))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
}

// Lines to print: chosen brands only, and each color kept or dropped by stock.
// Lines left with no colors are left out.
export function selectForExport(
  lines: readonly FilamentLine[],
  { brands, stock }: Pick<ExportOptions, 'brands' | 'stock'>,
): FilamentLine[] {
  const out: FilamentLine[] = []
  for (const line of lines) {
    if (brands && !brands.includes(line.brand)) continue
    const colors = line.colors.filter((c) => {
      const has = colorTotal(c) > 0
      return stock === 'all' || (stock === 'with' ? has : !has)
    })
    if (colors.length > 0) out.push({ ...line, colors })
  }
  return out.sort(
    (a, b) => a.brand.localeCompare(b.brand, 'es') || a.position - b.position,
  )
}

import { normalizeColor } from '@/features/production/pieces'
import { matchesQuery, searchTokens } from '@/lib/search'

// One part of a preset product, per unit: "cabeza · rojo · ×1".
export interface PartLine {
  label: string
  color: string
  quantity: number
}

// Editable row in the product form (quantity stays a string while typing).
export interface PartDraft {
  key: string
  label: string
  color: string
  quantity: string
}

export interface ProductTemplate {
  id: string
  name: string
  basePrice: number | null
  imageUrl: string | null
  parts: PartLine[]
}

let seq = 0
export function newPartDraft(part?: Partial<PartLine>): PartDraft {
  seq += 1
  return {
    key: `part-${seq}`,
    label: part?.label ?? '',
    color: part?.color ?? '',
    quantity: String(part?.quantity ?? 1),
  }
}

export function partQty(raw: string | number): number {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n > 0 ? n : 1
}

// Rows with a name, trimmed; empty rows are ignored rather than rejected.
export function cleanParts(drafts: readonly PartDraft[]): PartLine[] {
  return drafts
    .filter((d) => d.label.trim() !== '')
    .map((d) => ({
      label: d.label.trim(),
      color: d.color.trim(),
      quantity: partQty(d.quantity),
    }))
}

function normalizeName(name: string): string {
  return normalizeColor(name)
}

// The order modal only links an item to a preset on an exact name match
// (accent/case-insensitive), so free text never gets parts by accident.
export function findTemplate(
  name: string,
  templates: readonly ProductTemplate[],
): ProductTemplate | null {
  const key = normalizeName(name)
  if (!key) return null
  return templates.find((t) => normalizeName(t.name) === key) ?? null
}

export interface ProductSuggestion {
  name: string
  template: ProductTemplate | null
}

// Sugerencias del campo "Producto" del pedido: primero los productos
// guardados, después nombres ya usados en pedidos. Búsqueda por palabras
// (matchesQuery), sin repetir y sin el nombre que ya está escrito tal cual.
export function productSuggestions(
  query: string,
  templates: readonly ProductTemplate[],
  usedNames: readonly string[],
  limit = 8,
): ProductSuggestion[] {
  if (searchTokens(query).length === 0) return []
  const typed = normalizeName(query)
  const seen = new Set<string>()
  const out: ProductSuggestion[] = []
  const add = (name: string, template: ProductTemplate | null) => {
    const key = normalizeName(name)
    if (!key || key === typed || seen.has(key)) return
    if (!matchesQuery(name, query)) return
    seen.add(key)
    out.push({ name, template })
  }
  for (const t of templates) add(t.name, t)
  for (const name of usedNames) add(name, findTemplate(name, templates))
  return out.slice(0, limit)
}

// Pieces to create for an order item: each part × the item quantity.
export function piecesForItem(
  parts: readonly PartLine[],
  itemQuantity: number,
): { label: string; color: string | null; quantity: number }[] {
  const qty = partQty(itemQuantity)
  return parts
    .filter((p) => p.label.trim() !== '')
    .map((p) => ({
      label: p.label.trim(),
      color: p.color.trim() || null,
      quantity: partQty(p.quantity) * qty,
    }))
}

// "3 piezas · rojo, negro" for list rows.
export function partsSummary(parts: readonly PartLine[]): string {
  if (parts.length === 0) return 'Sin piezas'
  const colors = [
    ...new Set(parts.map((p) => p.color.trim()).filter(Boolean)),
  ].slice(0, 3)
  const n = `${parts.length} pieza${parts.length === 1 ? '' : 's'}`
  return colors.length ? `${n} · ${colors.join(', ')}` : n
}

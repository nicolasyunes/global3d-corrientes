// Rendering helpers for a stored `color_spec` (a `{ part: color }` JSON blob).
// Kept pure and separate from validation.ts (which owns the *form* round-trip
// via colorPartsFromSpec) so the read-only production/Kanban views can list
// entries and draw swatches without pulling in form types.

export interface ColorEntry {
  part: string
  color: string
}

// Ordered, blank-free entries for display. Tolerates null / non-object /
// non-string values (returns []), unlike colorPartsFromSpec which pads an
// empty spec with a blank editable row.
export function colorSpecEntries(spec: unknown): ColorEntry[] {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return []
  return Object.entries(spec as Record<string, unknown>)
    .filter(
      (e): e is [string, string] =>
        typeof e[1] === 'string' && e[1].trim() !== '',
    )
    .map(([part, color]) => ({ part, color: color.trim() }))
}

// Best-effort swatch colour for a Spanish colour name. Returns a hex string
// for a known name (case/accent-insensitive), or null so the caller falls
// back to text only. Deliberately small — the filament colours the shop
// actually stocks, not a full dictionary.
const SWATCH_HEX: Record<string, string> = {
  negro: '#1a1a1a',
  blanco: '#f5f5f5',
  gris: '#9aa0a6',
  plata: '#c0c0c0',
  dorado: '#d4af37',
  rojo: '#d32f2f',
  naranja: '#f57c00',
  amarillo: '#fbc02d',
  verde: '#388e3c',
  azul: '#1976d2',
  celeste: '#4fc3f7',
  violeta: '#7b1fa2',
  rosa: '#ec407a',
  marron: '#6d4c41',
  beige: '#e8dcc0',
  transparente: '#e0f7fa',
}

// Strips combining accent marks (U+0300–U+036F) after NFD so 'violéta' and
// 'Violeta' both hit the 'violeta' key.
const ACCENTS = /[̀-ͯ]/g

export function swatchFor(color: string): string | null {
  const key = color.toLowerCase().normalize('NFD').replace(ACCENTS, '').trim()
  return SWATCH_HEX[key] ?? null
}

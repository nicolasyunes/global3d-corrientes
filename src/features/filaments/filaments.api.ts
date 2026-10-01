import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type {
  FilamentColor,
  FilamentLine,
  FilamentLineRow,
  FilamentMovement,
  MovementKind,
} from './filaments'

type Tables = Database['public']['Tables']
type LineInsert = Tables['filament_lines']['Insert']
type ColorInsert = Tables['filament_colors']['Insert']

export async function listLines(): Promise<FilamentLine[]> {
  const { data, error } = await supabase
    .from('filament_lines')
    .select('*, colors:filament_colors(*)')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as FilamentLine[]).map((l) => ({
    ...l,
    colors: [...(l.colors ?? [])].sort(
      (a, b) =>
        a.position - b.position || a.created_at.localeCompare(b.created_at),
    ),
  }))
}

// Moves one stock (spool or refill) and logs it, atomically.
export async function moveFilament(
  colorId: string,
  delta: number,
  kind: MovementKind,
  operatorId: string | null,
  {
    refill = false,
    note = null,
  }: { refill?: boolean; note?: string | null } = {},
): Promise<FilamentColor> {
  const { data, error } = await supabase.rpc('move_filament', {
    p_color: colorId,
    p_refill: refill,
    p_delta: delta,
    p_kind: kind,
    p_operator: operatorId,
    p_note: note,
  })
  if (error) throw error
  return data as FilamentColor
}

export interface MovementWithColor extends FilamentMovement {
  color: { name: string; swatch: string } | null
}

export async function listLineMovements(
  colorIds: readonly string[],
  limit = 30,
): Promise<MovementWithColor[]> {
  if (colorIds.length === 0) return []
  const { data, error } = await supabase
    .from('filament_movements')
    .select('*, color:filament_colors(name, swatch)')
    .in('color_id', colorIds as string[])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as MovementWithColor[]
}

export interface ColorDraft {
  id: string | null
  name: string
  swatch: string
  finish: string
  price: number | null
  stock: number
  stock_refill: number | null
  spool_available: boolean
  min_stock: number
}

export interface LineDraft {
  brand: string
  name: string
  material: string
  presentation: string
  price: number | null
  refill_price: number | null
  accent: string | null
}

// Saves the line and its colors and returns the color ids in draft order.
// Stock is never written here: changes to it go through moveFilament so they
// show up in the history.
export async function saveLine(
  lineId: string | null,
  line: LineDraft,
  colors: readonly ColorDraft[],
  removedIds: readonly string[],
  position: number,
): Promise<{ line: FilamentLineRow; colorIds: string[] }> {
  let saved: FilamentLineRow
  if (lineId) {
    const { data, error } = await supabase
      .from('filament_lines')
      .update(line)
      .eq('id', lineId)
      .select('*')
      .single()
    if (error) throw error
    saved = data
  } else {
    const insert: LineInsert = { ...line, position }
    const { data, error } = await supabase
      .from('filament_lines')
      .insert(insert)
      .select('*')
      .single()
    if (error) throw error
    saved = data
  }

  if (removedIds.length) {
    const { error } = await supabase
      .from('filament_colors')
      .delete()
      .in('id', removedIds as string[])
    if (error) throw error
  }

  const both = line.presentation === 'both'
  const colorIds: string[] = []
  for (const [i, c] of colors.entries()) {
    const fields = {
      name: c.name.trim(),
      swatch: c.swatch,
      finish: c.finish,
      price: c.price,
      spool_available: c.spool_available,
      min_stock: c.min_stock,
      position: i,
    }
    if (c.id) {
      const { error } = await supabase
        .from('filament_colors')
        .update(fields)
        .eq('id', c.id)
      if (error) throw error
      colorIds.push(c.id)
    } else {
      const insert: ColorInsert = {
        ...fields,
        line_id: saved.id,
        stock: 0,
        stock_refill: both ? 0 : null,
      }
      const { data, error } = await supabase
        .from('filament_colors')
        .insert(insert)
        .select('id')
        .single()
      if (error) throw error
      colorIds.push(data.id)
    }
  }
  return { line: saved, colorIds }
}

export async function deleteLine(id: string): Promise<void> {
  const { error } = await supabase.from('filament_lines').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Thin typed helpers over Supabase, same shape as sales.api.ts — no repository
// layer, RLS is the security boundary. Stock is held in grams (1kg = 1 roll) so
// the supplies-sale consume trigger keeps working; this screen thinks in rolls.

export type InventoryRow = Database['public']['Tables']['inventory']['Row']

export const GRAMS_PER_ROLL = 1000

export interface SyncSummary {
  created: number
  updated: number
  deactivated: number
}

// Every spool, active first, then by producto / color — reads like the planilla
// it mirrors.
export async function listInsumos(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('active', { ascending: false })
    .order('material', { ascending: true })
    .order('color', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Manual +/- from the list. Read-modify-write (a 3-person shop rarely races on
// the same spool, same as the spreadsheet today); the `remaining_grams >= 0`
// CHECK is the backstop. The update fires trg_inventory_sync_to_sheet, which
// pushes the new roll count to the planilla.
export async function adjustRolls(
  row: InventoryRow,
  deltaRolls: number,
): Promise<InventoryRow> {
  const current = row.remaining_grams ?? 0
  const next = current + deltaRolls * GRAMS_PER_ROLL
  if (next < 0) throw new Error('No se puede dejar el stock en negativo.')

  const { data, error } = await supabase
    .from('inventory')
    .update({
      remaining_grams: next,
      quantity_grams: Math.max(row.quantity_grams ?? 0, next),
    })
    .eq('id', row.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Pulls the insumos tab of the Google Sheet into `inventory` via the
// read-insumos-stock Edge Function (the sheet's service-account credentials
// never reach the client). Sheet wins: roll counts and prices are overwritten,
// spools absent from the sheet are deactivated.
export async function syncFromSheet(): Promise<SyncSummary> {
  const { data, error } = await supabase.functions.invoke<{
    summary?: SyncSummary
    error?: string
  }>('read-insumos-stock')

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.summary ?? { created: 0, updated: 0, deactivated: 0 }
}

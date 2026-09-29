import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type CalcProfileRow =
  Database['public']['Tables']['calc_profiles']['Row']
export type CalcProfileFields = Omit<
  Database['public']['Tables']['calc_profiles']['Insert'],
  'id' | 'created_at' | 'updated_at'
>

export async function listCalcProfiles(): Promise<CalcProfileRow[]> {
  const { data, error } = await supabase
    .from('calc_profiles')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCalcProfile(
  fields: CalcProfileFields,
): Promise<CalcProfileRow> {
  const { data, error } = await supabase
    .from('calc_profiles')
    .insert(fields)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateCalcProfile(
  id: string,
  fields: Partial<CalcProfileFields>,
): Promise<CalcProfileRow> {
  const { data, error } = await supabase
    .from('calc_profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteCalcProfile(id: string): Promise<void> {
  const { error } = await supabase.from('calc_profiles').delete().eq('id', id)
  if (error) throw error
}

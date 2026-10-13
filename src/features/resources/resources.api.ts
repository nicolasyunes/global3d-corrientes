import { supabase } from '@/lib/supabase'
import type { Resource, SavedSearch } from './resources'

export type ResourceFields = Partial<
  Pick<
    Resource,
    | 'name'
    | 'url'
    | 'category'
    | 'description'
    | 'price'
    | 'needs_account'
    | 'account_hint'
    | 'search_url'
    | 'pinned'
  >
>

export async function listResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('position')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createResource(
  fields: ResourceFields & { name: string; url: string; category: string },
  operatorId: string | null,
): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({ ...fields, created_by: operatorId })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateResource(
  id: string,
  fields: ResourceFields,
): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) throw error
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSavedSearch(
  input: {
    name: string
    query: string
    resource_ids: string[]
    collection_id: string | null
  },
  operatorId: string | null,
): Promise<SavedSearch> {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      ...input,
      name: input.name.trim(),
      query: input.query.trim(),
      last_used_at: new Date().toISOString(),
      created_by: operatorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function touchSavedSearch(id: string): Promise<SavedSearch> {
  const { data, error } = await supabase
    .from('saved_searches')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id)
  if (error) throw error
}

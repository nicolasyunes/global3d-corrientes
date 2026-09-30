import { safeFileName } from '@/features/orders/orderImages.api'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { fileKind, type Collection, type Idea, type IdeaFile } from './ideas'

type IdeaInsert = Database['public']['Tables']['ideas']['Insert']
type IdeaUpdate = Database['public']['Tables']['ideas']['Update']

const BUCKET = 'idea-files'

export function ideaFileUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function listIdeas(): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('*, files:idea_files(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Idea[]).map((i) => ({
    ...i,
    files: [...(i.files ?? [])].sort((a, b) => a.position - b.position),
  }))
}

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('idea_collections')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createIdea(input: IdeaInsert): Promise<Idea> {
  const { data, error } = await supabase
    .from('ideas')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return { ...data, files: [] }
}

export async function updateIdea(id: string, patch: IdeaUpdate): Promise<void> {
  const { error } = await supabase.from('ideas').update(patch).eq('id', id)
  if (error) throw error
}

// Files first: once the row is gone nothing points at them any more.
export async function deleteIdea(idea: Idea): Promise<void> {
  if (idea.files.length) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(idea.files.map((f) => f.storage_path))
    if (error) throw error
  }
  const { error } = await supabase.from('ideas').delete().eq('id', idea.id)
  if (error) throw error
}

export async function uploadIdeaFile(
  ideaId: string,
  file: File,
  position: number,
): Promise<IdeaFile> {
  const kind = fileKind(file.name, file.type)
  if (!kind) throw new Error(`${file.name}: tipo de archivo no aceptado.`)
  const path = `${ideaId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError
  const { data, error } = await supabase
    .from('idea_files')
    .insert({
      idea_id: ideaId,
      storage_path: path,
      kind,
      file_name: file.name,
      size_bytes: file.size,
      position,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteIdeaFile(file: IdeaFile): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([file.storage_path])
  if (storageError) throw storageError
  const { error } = await supabase.from('idea_files').delete().eq('id', file.id)
  if (error) throw error
}

export async function createCollection(
  name: string,
  targetDate: string | null,
  position: number,
): Promise<Collection> {
  const { data, error } = await supabase
    .from('idea_collections')
    .insert({ name: name.trim(), target_date: targetDate, position })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateCollection(
  id: string,
  patch: { name?: string; target_date?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('idea_collections')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

// Its ideas stay, loose ("Sin colección").
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase
    .from('idea_collections')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export interface LinkPreview {
  title: string | null
  image: string | null
  author: string | null
  site: string | null
}

const EMPTY: LinkPreview = {
  title: null,
  image: null,
  author: null,
  site: null,
}

// Never throws: a site that blocks readers just gives an empty preview.
export async function readLink(url: string): Promise<LinkPreview> {
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', {
      body: { url },
    })
    if (error || !data) return EMPTY
    const d = data as Partial<LinkPreview>
    return {
      title: d.title ?? null,
      image: d.image ?? null,
      author: d.author ?? null,
      site: d.site ?? null,
    }
  } catch {
    return EMPTY
  }
}

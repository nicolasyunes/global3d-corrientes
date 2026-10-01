import { supabase } from '@/lib/supabase'
import type { Notice, NoticeKind } from './notices'

// Not archived; the done-task window is applied on screen.
export async function listNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createNotice(
  input: { kind: NoticeKind; body: string; important: boolean },
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .insert({
      kind: input.kind,
      body: input.body.trim(),
      important: input.important,
      created_by: operatorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setTaskDone(
  id: string,
  done: boolean,
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .update({
      done_at: done ? new Date().toISOString() : null,
      done_by: done ? operatorId : null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setImportant(
  id: string,
  important: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({ important })
    .eq('id', id)
  if (error) throw error
}

// Archived rows stay in the table; they just stop showing.
export async function archiveNotice(
  id: string,
  archive: boolean,
  operatorId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? operatorId : null,
    })
    .eq('id', id)
  if (error) throw error
}

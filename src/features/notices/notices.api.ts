import { supabase } from '@/lib/supabase'
import {
  markPatch,
  type Notice,
  type NoticeKind,
  type Priority,
} from './notices'

export type NoticeFields = Partial<
  Pick<
    Notice,
    | 'body'
    | 'sector'
    | 'priority'
    | 'assignee_id'
    | 'due_on'
    | 'repeat'
    | 'link'
    | 'color'
    | 'pinned'
    | 'expires_on'
  >
>

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
  kind: NoticeKind,
  fields: NoticeFields & { body: string },
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .insert({
      ...fields,
      kind,
      body: fields.body.trim(),
      created_by: operatorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateNotice(
  id: string,
  fields: NoticeFields,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// A repeated task logs who did it and moves its date; others get done.
export async function markTask(
  task: Notice,
  done: boolean,
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .update(markPatch(task, done, operatorId))
    .eq('id', task.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setPriority(
  id: string,
  priority: Priority,
): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({ priority })
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

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) throw error
}

// For the side menu badge; a failed count just hides it.
export async function countOpenTasks(): Promise<number> {
  const { count, error } = await supabase
    .from('notices')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'task')
    .is('done_at', null)
    .is('archived_at', null)
  if (error) return 0
  return count ?? 0
}

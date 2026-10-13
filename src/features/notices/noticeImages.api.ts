import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { safeFileName } from '@/features/orders/orderImages.api'

// Files attached to a board task (budget photos, references, designs). Same
// rules and look as the order attachments; stored in the public
// `notice-images` bucket.
export type NoticeImageRow =
  Database['public']['Tables']['notice_images']['Row']

const BUCKET = 'notice-images'

export function noticeImageUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

export async function listNoticeImages(
  noticeId: string,
): Promise<NoticeImageRow[]> {
  const { data, error } = await supabase
    .from('notice_images')
    .select('*')
    .eq('notice_id', noticeId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Uploads first, then records the row; a failed insert only leaves an
// unreferenced file behind.
export async function uploadNoticeImage(
  noticeId: string,
  file: File,
  note: string | null,
  position: number,
): Promise<NoticeImageRow> {
  const path = `${noticeId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('notice_images')
    .insert({ notice_id: noticeId, storage_path: path, note, position })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteNoticeImage(image: NoticeImageRow): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([image.storage_path])
  if (storageError) throw storageError

  const { error } = await supabase
    .from('notice_images')
    .delete()
    .eq('id', image.id)
  if (error) throw error
}

// Deleting a task cascades the rows but not the files: clear those first.
export async function removeNoticeFiles(noticeId: string): Promise<void> {
  const rows = await listNoticeImages(noticeId)
  if (rows.length === 0) return
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(rows.map((row) => row.storage_path))
  if (error) throw error
}

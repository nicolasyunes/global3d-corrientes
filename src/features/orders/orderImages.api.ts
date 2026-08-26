import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type OrderImageRow = Database['public']['Tables']['order_images']['Row']

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// Pure — no network/DOM — so the upload flow can reject a bad file before
// ever touching the network. Mirrors the "reject inline, cheap check first"
// shape validation.ts already uses for parseMoney/parseQuantity.
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Elegí un archivo de imagen (JPG, PNG, WEBP, GIF).'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'La imagen no puede superar los 8MB.'
  }
  return null
}

export function publicImageUrl(storagePath: string): string {
  return supabase.storage.from('order-images').getPublicUrl(storagePath).data
    .publicUrl
}

export async function listOrderImages(
  orderId: string,
): Promise<OrderImageRow[]> {
  const { data, error } = await supabase
    .from('order_images')
    .select('*')
    .eq('order_id', orderId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Uploads the file to storage first, then records the row — see design.md's
// "Sequence — uploading an image" for why a failed insert after a successful
// storage write is an accepted, harmless trade-off at this scale.
export async function uploadOrderImage(
  orderId: string,
  file: File,
  note: string | null,
): Promise<OrderImageRow> {
  const path = `${orderId}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('order-images')
    .upload(path, file)
  if (uploadError) throw uploadError

  const existing = await listOrderImages(orderId)
  const position =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((row) => row.position)) + 1

  const { data, error } = await supabase
    .from('order_images')
    .insert({ order_id: orderId, storage_path: path, note, position })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteOrderImage(image: OrderImageRow): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('order-images')
    .remove([image.storage_path])
  if (storageError) throw storageError

  const { error } = await supabase
    .from('order_images')
    .delete()
    .eq('id', image.id)
  if (error) throw error
}

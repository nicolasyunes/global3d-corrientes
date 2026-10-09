import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Order attachments: reference photos, payment receipts (image or PDF),
// mockups. Stored in the public `order-images` bucket; the note carries the
// kind ("Comprobante", "Referencia"…) plus anything the person adds.
export type OrderImageRow = Database['public']['Tables']['order_images']['Row']

const MAX_FILE_BYTES = 10 * 1024 * 1024

export const ATTACHMENT_ACCEPT = 'image/*,application/pdf'

export const ATTACHMENT_KINDS = [
  'Referencia',
  'Comprobante',
  'Foto del cliente',
  'Diseño',
] as const

export function validateAttachment(file: File): string | null {
  const ok = file.type.startsWith('image/') || file.type === 'application/pdf'
  if (!ok) return 'Solo imágenes (JPG, PNG, WEBP…) o PDF.'
  if (file.size > MAX_FILE_BYTES)
    return 'El archivo no puede superar los 10 MB.'
  return null
}

export function isPdf(path: string): boolean {
  return /\.pdf$/i.test(path)
}

// Storage keys reject spaces, accents and most symbols, so the original name
// is reduced to a safe slug ("Comprobante Seña.PDF" → "comprobante-sena.pdf").
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const slug =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'archivo'
  return ext ? `${slug}.${ext.replace(/[^a-z0-9]/g, '')}` : slug
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

// Uploads the file to storage first, then records the row; a failed insert
// after a successful upload only leaves an unreferenced file behind.
export async function uploadOrderImage(
  orderId: string,
  file: File,
  note: string | null,
): Promise<OrderImageRow> {
  const path = `${orderId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from('order-images')
    .upload(path, file, { contentType: file.type || undefined })
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

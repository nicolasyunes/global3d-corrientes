import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Thin typed helpers over Supabase, same shape as orders.api.ts / sales.api.ts
// — no repository layer, RLS is the security boundary (products_all is
// admin-only, see 20260825120000_product_stock_images.sql).

export type ProductRow = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export async function listProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function createProduct(input: ProductInsert): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(
  id: string,
  patch: ProductUpdate,
): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

const PRODUCT_IMAGES_BUCKET = 'product-images'

// Uploads the cover image under a per-product folder so re-uploads don't
// collide across products; the timestamped filename busts any cached copy of
// a previous image at the same product id. Returns the public URL to store on
// products.image_url — the bucket is public (see the migration), so this URL
// is directly usable without a signed-URL round trip.
export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${productId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

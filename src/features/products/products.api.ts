import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Thin typed helpers over Supabase, same shape as orders.api.ts / sales.api.ts
// — no repository layer, RLS is the security boundary (products_all is
// admin-only, see 20260825120000_product_stock_images.sql).

export type ProductRow = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type CategoryRow = Database['public']['Tables']['categories']['Row']
export type ProductImageRow =
  Database['public']['Tables']['product_images']['Row']

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

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function bulkUpdateProducts(
  ids: string[],
  patch: ProductUpdate,
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('products').update(patch).in('id', ids)
  if (error) throw error
}

const PRODUCT_IMAGES_BUCKET = 'product-images'

export async function listProductImages(
  productId: string,
): Promise<ProductImageRow[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Espeja products.image_url con la imagen de menor position (o null si no hay),
// para que la lista y el storefront usen <img src> sin un join.
async function syncCoverImage(productId: string): Promise<void> {
  const images = await listProductImages(productId)
  await updateProduct(productId, { image_url: images[0]?.url ?? null })
}

// Sube un archivo de la galería bajo una carpeta por producto; el nombre lleva
// la posición y un timestamp para no colisionar ni servir una copia cacheada.
// El bucket es público (ver 20260825120000_product_stock_images.sql), así que
// la URL pública es usable directo. Si es la portada (position 0), la espeja en
// products.image_url.
export async function uploadProductImage(
  productId: string,
  file: File,
  position: number,
): Promise<ProductImageRow> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${productId}/${position}-${Date.now()}.${ext}`
  const up = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { upsert: false })
  if (up.error) throw up.error
  const { data: pub } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path)
  const { data, error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, path, url: pub.publicUrl, position })
    .select('*')
    .single()
  if (error) throw error
  if (position === 0)
    await updateProduct(productId, { image_url: pub.publicUrl })
  return data
}

export async function deleteProductImage(
  image: ProductImageRow,
): Promise<void> {
  const rm = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([image.path])
  if (rm.error) throw rm.error
  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('id', image.id)
  if (error) throw error
  await syncCoverImage(image.product_id)
}

export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('product_images')
      .update({ position: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
  await syncCoverImage(productId)
}

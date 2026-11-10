import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  cleanOptions,
  uniqueSlug,
  type ShopAxis,
  type ShopFamilyOption,
  type ShopLinkDraft,
} from './shopLink'

// Las tablas de la tienda no están en los tipos generados de la base.
const db = supabase as unknown as SupabaseClient

interface FamilyRow {
  id: string
  slug: string
  name: string
  category: string
  published: boolean
  option_axes: ShopAxis[] | null
  shop_family_products:
    | {
        product_id: string
        option_values: Record<string, string> | null
        position: number
      }[]
    | null
}

export async function listShopFamilies(): Promise<ShopFamilyOption[]> {
  const { data, error } = await db
    .from('shop_families')
    .select(
      'id, slug, name, category, published, option_axes, shop_family_products(product_id, option_values, position)',
    )
    .order('name')
  if (error) throw error
  return ((data ?? []) as FamilyRow[]).map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    category: f.category,
    published: f.published,
    axes: f.option_axes ?? [],
    members: (f.shop_family_products ?? []).map((m) => ({
      productId: m.product_id,
      values: m.option_values ?? {},
      position: m.position,
    })),
  }))
}

/** Arma el borrador a partir de la familia en la que ya está el producto. */
export function draftFromFamilies(
  productId: string,
  families: ShopFamilyOption[],
): ShopLinkDraft | null {
  for (const f of families) {
    const m = f.members.find((x) => x.productId === productId)
    if (m)
      return {
        mode: 'existing',
        familyId: f.id,
        options: { ...m.values },
        newName: '',
        newCategory: '',
      }
  }
  return null
}

/**
 * Guarda dónde aparece el producto en la tienda. "none" lo saca; "new" crea
 * una ficha nueva publicada con este producto solo.
 */
export async function saveProductShopLink(
  productId: string,
  d: ShopLinkDraft,
  families: ShopFamilyOption[],
): Promise<void> {
  if (d.mode === 'none') {
    const { error } = await db
      .from('shop_family_products')
      .delete()
      .eq('product_id', productId)
    if (error) throw error
    return
  }

  let familyId = d.familyId
  let values: Record<string, string> = {}
  let position = 0

  if (d.mode === 'new') {
    const { data, error } = await db
      .from('shop_families')
      .insert({
        slug: uniqueSlug(
          d.newName,
          families.map((f) => f.slug),
        ),
        name: d.newName.trim(),
        category: d.newCategory,
        sale_mode: 'stock',
        published: true,
      })
      .select('id')
      .single()
    if (error) throw error
    familyId = (data as { id: string }).id
  } else {
    const family = families.find((f) => f.id === familyId)
    if (!family) throw new Error('No se encontró la ficha de la tienda.')
    values = cleanOptions(family, d.options)
    const current = family.members.find((m) => m.productId === productId)
    position =
      current?.position ??
      family.members.reduce((max, m) => Math.max(max, m.position + 1), 0)
  }

  const { error } = await db.from('shop_family_products').upsert(
    {
      product_id: productId,
      family_id: familyId,
      option_values: values,
      position,
    },
    { onConflict: 'product_id' },
  )
  if (error) throw error
}

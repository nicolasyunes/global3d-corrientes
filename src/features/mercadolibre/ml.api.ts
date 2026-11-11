import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { MlOrderItem, PriceRule } from './ml'

// Las tablas ml_* y price_rules las creó el gestor de MercadoLibre y todavía no
// están en database.types.ts (falta correr `npm run gen:types`). Hasta entonces
// se consultan con el cliente sin tipar y los tipos se declaran acá.
const db = supabase as unknown as SupabaseClient

function fail(error: { message: string }): never {
  throw new Error(error.message)
}

export interface MlOrder {
  ml_order_id: number
  pack_id: number | null
  sale_id: string | null
  status: string | null
  buyer_nickname: string | null
  shipping_status: string | null
  handling_limit: string | null
  items: MlOrderItem[] | null
  created_at: string
}

export interface MlListing {
  id: string
  family_id: string | null
  product_id: string | null
  ml_item_id: string
  status: string
  title: string | null
  ml_price: number | null
  ml_stock: number | null
  permalink: string | null
  needs_review: boolean
  last_synced_at: string | null
}

export interface MlTaskRun {
  task: 'ventas' | 'sync'
  ran_at: string
  ok: boolean
  summary: Record<string, unknown> | null
}

export interface ProductPriceRow {
  product_id: string
  name: string
  price_web: number
  price_efectivo: number
  price_ml: number
  efectivo_manual: boolean
  ml_manual: boolean
}

export interface FamilyWithProducts {
  id: string
  name: string
  slug: string
  sale_mode: string | null
  lead_days: number | null
  published: boolean
  shop_family_products: {
    position: number | null
    products: {
      id: string
      name: string
      stock_quantity: number | null
      active: boolean
    } | null
  }[]
}

export interface PriceOverride {
  product_id: string
  channel: 'ml' | 'efectivo'
  price: number
  products: { name: string } | null
}

// Ventas de ML sin entregar (las que el taller todavía tiene que preparar o despachar).
export async function listPendingDispatches(): Promise<MlOrder[]> {
  const { data, error } = await db
    .from('ml_orders')
    .select(
      'ml_order_id, pack_id, sale_id, status, buyer_nickname, shipping_status, handling_limit, items, created_at',
    )
    .eq('voided', false)
    .or(
      'shipping_status.is.null,shipping_status.not.in.(delivered,not_delivered,cancelled)',
    )
    .order('handling_limit', { ascending: true, nullsFirst: false })
  if (error) fail(error)
  return (data ?? []) as MlOrder[]
}

export async function latestRuns(): Promise<MlTaskRun[]> {
  const { data, error } = await db
    .from('ml_task_runs')
    .select('task, ran_at, ok, summary')
    .order('ran_at', { ascending: false })
    .limit(10)
  if (error) fail(error)
  return (data ?? []) as MlTaskRun[]
}

export async function listListings(): Promise<MlListing[]> {
  const { data, error } = await db
    .from('ml_listings')
    .select(
      'id, family_id, product_id, ml_item_id, status, title, ml_price, ml_stock, permalink, needs_review, last_synced_at',
    )
    .neq('status', 'closed')
  if (error) fail(error)
  return (data ?? []) as MlListing[]
}

export async function listFamilies(): Promise<FamilyWithProducts[]> {
  const { data, error } = await db
    .from('shop_families')
    .select(
      'id, name, slug, sale_mode, lead_days, published, shop_family_products(position, products(id, name, stock_quantity, active))',
    )
    .eq('published', true)
    .order('position', { ascending: true })
  if (error) fail(error)
  return (data ?? []) as FamilyWithProducts[]
}

export async function listProductPrices(): Promise<ProductPriceRow[]> {
  const { data, error } = await db
    .from('v_product_prices')
    .select('*')
    .order('name', { ascending: true })
  if (error) fail(error)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    price_web: Number(r.price_web),
    price_efectivo: Number(r.price_efectivo),
    price_ml: Number(r.price_ml),
  })) as ProductPriceRow[]
}

export async function listPriceRules(): Promise<PriceRule[]> {
  const { data, error } = await db
    .from('price_rules')
    .select('channel, markup_pct, fixed_add, round_to')
  if (error) fail(error)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    channel: r.channel,
    markup_pct: Number(r.markup_pct),
    fixed_add: Number(r.fixed_add),
    round_to: Number(r.round_to),
  })) as PriceRule[]
}

export async function savePriceRule(rule: PriceRule): Promise<void> {
  const { error } = await db
    .from('price_rules')
    .update({
      markup_pct: rule.markup_pct,
      fixed_add: rule.fixed_add,
      round_to: rule.round_to,
    })
    .eq('channel', rule.channel)
  if (error) fail(error)
}

export async function listOverrides(): Promise<PriceOverride[]> {
  const { data, error } = await db
    .from('product_prices')
    .select('product_id, channel, price, products(name)')
    .order('channel', { ascending: true })
  if (error) fail(error)
  return (data ?? []) as PriceOverride[]
}

export async function saveOverride(
  productId: string,
  channel: 'ml' | 'efectivo',
  price: number,
): Promise<void> {
  const { error } = await db
    .from('product_prices')
    .upsert({ product_id: productId, channel, price })
  if (error) fail(error)
}

export async function deleteOverride(
  productId: string,
  channel: 'ml' | 'efectivo',
): Promise<void> {
  const { error } = await db
    .from('product_prices')
    .delete()
    .eq('product_id', productId)
    .eq('channel', channel)
  if (error) fail(error)
}

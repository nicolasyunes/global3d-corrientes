import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { SalePayload } from './ticket'

export type SaleRow = Database['public']['Tables']['sales']['Row']
export type SaleItemRow = Database['public']['Tables']['sale_items']['Row']
export type SaleLogRow = Database['public']['Tables']['sale_log']['Row']
export type SaleWithRefs = SaleRow & {
  sale_items: SaleItemRow[]
  customers: { name: string; wholesale: boolean } | null
  orders: { id: string; title: string | null } | null
}

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// Stock, totals and the history row are handled by the database function.
export async function createSale(
  p: SalePayload,
  operatorId: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale', {
    p: p as never,
    p_operator: operatorId as string,
  })
  if (error) fail(error)
  return data as string
}

// Admin only (checked in the database).
export async function editSale(
  id: string,
  p: SalePayload,
  operatorId: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('edit_sale', {
    p_sale: id,
    p: p as never,
    p_operator: operatorId as string,
  })
  if (error) fail(error)
  return data as string
}

export async function voidSale(
  id: string,
  operatorId: string | null,
  reason: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('void_sale', {
    p_sale: id,
    p_operator: operatorId as string,
    p_reason: reason,
  })
  if (error) fail(error)
  return data as string
}

export async function listSales(from: Date, to: Date): Promise<SaleWithRefs[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*), customers(name, wholesale), orders(id, title)')
    .gte('sold_at', from.toISOString())
    .lt('sold_at', to.toISOString())
    .order('sold_at', { ascending: false })
  if (error) fail(error)
  return (data ?? []) as SaleWithRefs[]
}

export async function getSaleLog(saleId: string): Promise<SaleLogRow[]> {
  const { data, error } = await supabase
    .from('sale_log')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })
  if (error) fail(error)
  return data ?? []
}

export async function getOrderSale(orderId: string): Promise<SaleRow | null> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()
  if (error) fail(error)
  return data
}

export async function setCustomerWholesale(
  customerId: string,
  wholesale: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ wholesale })
    .eq('id', customerId)
  if (error) fail(error)
}

export interface SaleCustomerHit {
  id: string
  name: string
  phone: string | null
  wholesale: boolean
}

// Same matching as the order form's customer search, plus the wholesale flag.
export async function searchSaleCustomers(
  query: string,
): Promise<SaleCustomerHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, wholesale')
    .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
    .order('updated_at', { ascending: false })
    .limit(6)
  if (error) fail(error)
  return data ?? []
}

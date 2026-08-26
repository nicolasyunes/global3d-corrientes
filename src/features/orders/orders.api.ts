import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Thin typed helpers over the existing Supabase client. No repository layer —
// RLS is the security boundary; these are plain functions so callers stay close
// to the query they run.

type CustomerRow = Database['public']['Tables']['customers']['Row']
export type OrderRow = Database['public']['Tables']['orders']['Row']

export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']

export type OrderWithCustomer = OrderRow & {
  customers: Pick<CustomerRow, 'name' | 'phone'> | null
}

export interface CustomerInput {
  name: string
  phone?: string | null
  whatsapp?: string | null
}

// Match an existing customer by phone (then whatsapp); otherwise create by
// name. Both columns carry partial unique indexes, so a match prevents a
// duplicate on re-capture of the same contact.
export async function upsertCustomer(
  input: CustomerInput,
): Promise<CustomerRow> {
  const { name, phone = null, whatsapp = null } = input

  if (phone) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()
    if (data) return data
  }

  if (whatsapp) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('whatsapp', whatsapp)
      .maybeSingle()
    if (data) return data
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({ name, phone, whatsapp })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createOrder(input: OrderInsert): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateOrder(
  id: string,
  patch: OrderUpdate,
): Promise<OrderRow> {
  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Update the linked customer's contact in place (rename / phone change) during
// detail editing. Never re-upserts — a re-match by phone could create a new
// customer and orphan the existing order link.
export async function updateCustomer(
  id: string,
  patch: { name?: string; phone?: string | null },
): Promise<CustomerRow> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Load a single order with its customer relation for the detail view.
export async function getOrder(id: string): Promise<OrderWithCustomer | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, phone)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as OrderWithCustomer | null
}

export async function listOrders(): Promise<OrderWithCustomer[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, phone)')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrderWithCustomer[]
}

// Undo for a just-created quick order: the 5-second "Deshacer" toast calls
// this directly rather than a soft-delete/status flag — the row hasn't been
// seen by anyone yet, so there's nothing to preserve a trail of.
export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
}

export type OrderItemRow = Database['public']['Tables']['order_items']['Row']
export type OrderItemInsert =
  Database['public']['Tables']['order_items']['Insert']

// One order_id per row, no relation columns — cheapest shape for the list
// view to reduce into a per-order count client-side (a table this small
// doesn't need a grouped-count RPC).
export async function listOrderItemCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('order_items').select('order_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.order_id] = (counts[row.order_id] ?? 0) + 1
  }
  return counts
}

export async function listOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Delete-then-insert: simplest correct semantics for a short, wholly
// re-submitted list — the form owns the full set of items on every save,
// there is no partial/incremental edit UI to reconcile against.
export async function replaceOrderItems(
  orderId: string,
  items: Omit<OrderItemInsert, 'order_id'>[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
  if (deleteError) throw deleteError

  if (items.length === 0) return

  const { error: insertError } = await supabase
    .from('order_items')
    .insert(items.map((item) => ({ ...item, order_id: orderId })))
  if (insertError) throw insertError
}

// Production checklist: unlike order_items (a batch the OrderForm re-submits
// wholesale), these are checked off one at a time over the course of
// production — sometimes days apart, sometimes by a different person at a
// different location — so each task gets its own row-level create/update/
// delete rather than a replace-all.
export type ProductionTaskRow =
  Database['public']['Tables']['order_production_tasks']['Row']
export type ProductionTaskUpdate =
  Database['public']['Tables']['order_production_tasks']['Update']

export async function listProductionTasks(
  orderId: string,
): Promise<ProductionTaskRow[]> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select('*')
    .eq('order_id', orderId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createProductionTask(
  orderId: string,
  input: { label: string; location: string | null },
  position: number,
): Promise<ProductionTaskRow> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .insert({
      order_id: orderId,
      label: input.label,
      location: input.location,
      position,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateProductionTask(
  id: string,
  patch: ProductionTaskUpdate,
): Promise<ProductionTaskRow> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteProductionTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('order_production_tasks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

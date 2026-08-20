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

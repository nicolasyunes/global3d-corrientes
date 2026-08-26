import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Thin typed helpers over Supabase, same shape as orders.api.ts — no
// repository layer, RLS is the security boundary.

export type InventoryRow = Database['public']['Tables']['inventory']['Row']
export type TransactionRow = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert =
  Database['public']['Tables']['transactions']['Insert']

// Active spools only, for the sale form's picker.
export async function listInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('active', true)
    .order('material', { ascending: true })
  if (error) throw error
  return data ?? []
}

export interface SaleInput {
  inventoryId: string | null
  quantityGrams: number | null
  amount: number
  method: string | null
}

// Inserts a `supplies_sale` transaction. When `inventoryId` + `quantityGrams`
// are both set, `trg_transactions_consume_inventory` decrements the spool's
// `remaining_grams` and the whole insert rolls back if it would go negative —
// the Postgres error surfaces through `error` for the caller to translate
// into an inline message.
export async function createSale(input: SaleInput): Promise<TransactionRow> {
  const insert: TransactionInsert = {
    type: 'supplies_sale',
    inventory_id: input.inventoryId,
    quantity_grams: input.quantityGrams,
    amount: input.amount,
    method: input.method,
  }
  const { data, error } = await supabase
    .from('transactions')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export type SaleWithInventory = TransactionRow & {
  inventory: Pick<InventoryRow, 'material' | 'color' | 'brand'> | null
}

export async function listSales(): Promise<SaleWithInventory[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, inventory(material, color, brand)')
    .eq('type', 'supplies_sale')
    .order('transacted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SaleWithInventory[]
}

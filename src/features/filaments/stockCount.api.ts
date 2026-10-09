import { supabase } from '@/lib/supabase'
import type { StockCount, StockCountRow } from './count'

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// Closes a count: the database stores what was counted and what the system
// expected at that moment.
export async function submitStockCount(
  operatorId: string | null,
  items: { color_id: string; refill: boolean; counted: number }[],
): Promise<StockCountRow> {
  const { data, error } = await supabase.rpc('submit_stock_count', {
    p_operator: operatorId as string, // the database rejects null with a message
    p_items: items,
  })
  if (error) fail(error)
  return data as StockCountRow
}

// Admin only (checked in the database). Approving adjusts the stock by the
// difference of each counted row; discarding leaves it untouched.
export async function resolveStockCount(
  countId: string,
  operatorId: string | null,
  approve: boolean,
): Promise<StockCountRow> {
  const { data, error } = await supabase.rpc('resolve_stock_count', {
    p_count: countId,
    p_operator: operatorId as string, // the database rejects null with a message
    p_approve: approve,
  })
  if (error) fail(error)
  return data as StockCountRow
}

export async function listStockCounts(limit = 20): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*, items:stock_count_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail(error)
  return (data ?? []) as unknown as StockCount[]
}

// Just enough to know when the shelf was last counted and what awaits review.
export async function listCountStatus(): Promise<
  Pick<StockCountRow, 'created_at' | 'status'>[]
> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('created_at, status')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) fail(error)
  return (data ?? []) as Pick<StockCountRow, 'created_at' | 'status'>[]
}

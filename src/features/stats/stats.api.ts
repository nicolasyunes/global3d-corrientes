import { supabase } from '@/lib/supabase'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import { listDeliveredOrders } from '@/features/orders/orders.api'
import { listProductSales } from '@/features/orders/productSales.api'
import { inRange, toDeliveredRows, type DeliveredRow, type Range } from './stats'

export const STATS_LOG_KINDS = ['sale', 'used', 'transfer', 'personal', 'adjust', 'count']

export interface StatsData {
  sales: FilamentSale[]
  log: FilamentLogRow[]
  delivered: DeliveredRow[]
}

// The latest move to "Entregado" per order (an order can be re-delivered).
async function deliveredMoments(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('production_events')
    .select('order_id, created_at')
    .eq('kind', 'stage')
    .eq('to_status', 'delivered')
  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  for (const e of data ?? []) {
    const prev = map.get(e.order_id)
    if (!prev || e.created_at > prev) map.set(e.order_id, e.created_at)
  }
  return map
}

// Everything the stats screen needs for one period. Volumes are small (tens of
// rows a month), so delivered orders and product sales are filtered here.
export async function loadStats(range: Range): Promise<StatsData> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const [sales, log, orders, productSales, moments] = await Promise.all([
    supabase
      .from('filament_sales')
      .select('*')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as FilamentSale[]
      }),
    supabase
      .from('filament_log')
      .select('*')
      .in('kind', STATS_LOG_KINDS)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as FilamentLogRow[]
      }),
    listDeliveredOrders(),
    listProductSales(),
    deliveredMoments(),
  ])
  const delivered = toDeliveredRows(orders, productSales, moments).filter((r) =>
    inRange(r.at, range),
  )
  return { sales, log, delivered }
}

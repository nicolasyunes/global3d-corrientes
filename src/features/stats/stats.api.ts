import { supabase } from '@/lib/supabase'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import { listSales } from '@/features/sales/sales.api'
import { pageAll } from './paging'
import { saleToDeliveredRow, type DeliveredRow, type Range } from './stats'

export const STATS_LOG_KINDS = ['sale', 'used', 'transfer', 'personal', 'adjust', 'count']

export interface StatsData {
  sales: FilamentSale[]
  log: FilamentLogRow[]
  delivered: DeliveredRow[]
}

// The latest move to "Entregado" per order (an order can be re-delivered).
export async function deliveredMoments(): Promise<Map<string, string>> {
  const data = await pageAll((from, to) =>
    supabase
      .from('production_events')
      .select('order_id, created_at')
      .eq('kind', 'stage')
      .eq('to_status', 'delivered')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
  const map = new Map<string, string>()
  for (const e of data) {
    const prev = map.get(e.order_id)
    if (!prev || e.created_at > prev) map.set(e.order_id, e.created_at)
  }
  return map
}

// Everything the stats screen needs for one period. Volumes are small (tens of
// rows a month); sales come from the ledger already limited to the period.
export async function loadStats(range: Range): Promise<StatsData> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const [sales, log, ledger] = await Promise.all([
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
    listSales(range.from, range.to),
  ])
  const delivered = ledger.filter((s) => !s.voided_at).map(saleToDeliveredRow)
  return { sales, log, delivered }
}

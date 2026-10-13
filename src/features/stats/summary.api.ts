import { supabase } from '@/lib/supabase'
import { deliveredMoments } from './stats.api'
import type { Range } from './stats'
import type { SummaryOrder, SummaryPayment } from './summary'

export interface SummaryData {
  orders: SummaryOrder[]
  payments: SummaryPayment[]
  deliveredAt: Map<string, string>
}

const PAGE = 1000

// PostgREST caps a response at 1000 rows: read the orders page by page.
async function allOrders(): Promise<SummaryOrder[]> {
  const out: SummaryOrder[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, customer_id, created_at, due_date, status, total_amount, pending_balance, flexible, origin_channel, order_items(quantity)',
      )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as (Omit<SummaryOrder, 'quantity'> & {
      order_items: { quantity: number }[] | null
    })[]
    for (const { order_items, ...o } of rows) {
      out.push({ ...o, quantity: (order_items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0) })
    }
    if (rows.length < PAGE) return out
  }
}

// Orders are read whole (tens a month; "Por cobrar" and "clientes nuevos" need
// the history). Payments and sales only from the oldest day any card needs.
export async function loadSummary(range: Range, cmp: Range | null): Promise<SummaryData> {
  const since = (cmp && cmp.from.getTime() < range.from.getTime() ? cmp.from : range.from).toISOString()
  const until = range.to.toISOString()

  const [orders, tx, filament, deliveredAt] = await Promise.all([
    allOrders(),
    supabase
      .from('transactions')
      .select('id, type, amount, method, transacted_at')
      .in('type', ['3d_service', 'product_sale'])
      .is('voided_at', null)
      .gte('transacted_at', since)
      .lt('transacted_at', until)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    supabase
      .from('filament_sales')
      .select('id, total, payment, created_at')
      .is('voided_at', null)
      .gte('created_at', since)
      .lt('created_at', until)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    deliveredMoments(),
  ])

  const payments: SummaryPayment[] = [
    ...tx.map((t): SummaryPayment => ({
      id: t.id,
      amount: t.amount,
      method: t.method,
      at: t.transacted_at,
      source: t.type === '3d_service' ? 'order' : 'direct',
    })),
    ...filament.map((s): SummaryPayment => ({
      id: s.id,
      amount: s.total ?? 0,
      method: s.payment,
      at: s.created_at,
      source: 'filament',
    })),
  ]
  return { orders, payments, deliveredAt }
}

import { supabase } from '@/lib/supabase'
import type { OrderStatus } from '@/lib/domain-constants'
import type { PieceRow } from './production.api'

// One piece of an open, confirmed order, flattened with what the workshop
// needs to group, sort and label it.
export interface WorkPiece extends PieceRow {
  due_date: string
  order_status: OrderStatus
  order_title: string | null
  order_created_at: string
  order_updated_at: string
  customer_id: string
  customer_name: string
  flexible: boolean
  urgent: boolean
  pp_sand: boolean
  pp_paint: boolean
  pp_notes: string | null
  sand_done: boolean
  paint_done: boolean
  item_label: string | null
}

type Raw = PieceRow & {
  orders: {
    due_date: string
    status: OrderStatus
    title: string | null
    created_at: string
    updated_at: string
    customer_id: string
    flexible: boolean
    urgent: boolean
    pp_sand: boolean
    pp_paint: boolean
    pp_notes: string | null
    sand_done: boolean
    paint_done: boolean
    customers: { name: string } | null
  } | null
  order_items: { description: string } | null
}

// Every piece (printed ones too, for "x/y impresas") of the orders that are in
// the workshop: not delivered, not cancelled, not "en espera".
export async function listWorkshopPieces(): Promise<WorkPiece[]> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select(
      '*, orders!inner(due_date, status, title, created_at, updated_at, customer_id, flexible, urgent, pp_sand, pp_paint, pp_notes, sand_done, paint_done, customers(name)), order_items(description)',
    )
    .not('orders.status', 'in', '(delivered,cancelled)')
    .is('orders.waiting_reason', null)
    .order('position', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Raw[])
    .filter((row) => row.orders)
    .map(({ orders, order_items, ...piece }) => ({
      ...piece,
      due_date: orders!.due_date,
      order_status: orders!.status,
      order_title: orders!.title,
      order_created_at: orders!.created_at,
      order_updated_at: orders!.updated_at,
      customer_id: orders!.customer_id,
      customer_name: orders!.customers?.name ?? 'Sin nombre',
      flexible: orders!.flexible ?? false,
      urgent: orders!.urgent ?? false,
      pp_sand: orders!.pp_sand ?? false,
      pp_paint: orders!.pp_paint ?? false,
      pp_notes: orders!.pp_notes ?? null,
      sand_done: orders!.sand_done ?? false,
      paint_done: orders!.paint_done ?? false,
      item_label: order_items?.description ?? null,
    }))
}

export type OrderEventKind =
  'stage' | 'priority' | 'postprocess' | 'payment' | 'edited'

// Order-level history (piece changes are logged by the database itself).
// Best effort: a failed log never blocks the action it describes.
export async function logOrderEvent(
  orderId: string,
  operatorId: string | null,
  kind: OrderEventKind,
  label: string,
  delta?: number,
): Promise<void> {
  await supabase
    .rpc('log_order_event', {
      p_order: orderId,
      p_operator: operatorId,
      p_kind: kind,
      p_label: label,
      p_delta: delta ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    )
}

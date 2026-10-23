import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { PieceStatus } from './pieces'

export type PieceRow =
  Database['public']['Tables']['order_production_tasks']['Row']
export type ProductionEventRow =
  Database['public']['Tables']['production_events']['Row']

export interface NewPiece {
  orderId: string
  orderItemId: string | null
  label: string
  color: string | null
  quantityTotal: number
  location: string | null
  position: number
}

export async function listPieces(orderId: string): Promise<PieceRow[]> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select('*')
    .eq('order_id', orderId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPiece(
  input: NewPiece,
  operatorId: string | null,
): Promise<PieceRow> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .insert({
      order_id: input.orderId,
      order_item_id: input.orderItemId,
      label: input.label,
      color: input.color,
      quantity_total: input.quantityTotal,
      location: input.location,
      position: input.position,
      updated_by: operatorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setPieceStatus(
  id: string,
  status: PieceStatus,
  operatorId: string | null,
): Promise<PieceRow> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .update({ status, updated_by: operatorId })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function incrementPiece(
  id: string,
  delta: number,
  operatorId: string | null,
): Promise<PieceRow> {
  const { data, error } = await supabase.rpc('increment_task', {
    p_task: id,
    p_delta: delta,
    p_operator: operatorId,
  })
  if (error) throw error
  return data as PieceRow
}

export async function registerPieceFailure(
  id: string,
  operatorId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('register_task_failure', {
    p_task: id,
    p_operator: operatorId,
  })
  if (error) throw error
}

// The delete event is attributed to whoever touched the piece last, so stamp
// the current operator first.
export async function deletePiece(
  id: string,
  operatorId: string | null,
): Promise<void> {
  if (operatorId) {
    await supabase
      .from('order_production_tasks')
      .update({ updated_by: operatorId })
      .eq('id', id)
  }
  const { error } = await supabase
    .from('order_production_tasks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function listEvents(
  orderId: string,
  limit = 30,
): Promise<ProductionEventRow[]> {
  const { data, error } = await supabase
    .from('production_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export interface QueuePiece extends PieceRow {
  due_date: string
  order_status: string
  customer_id: string
  customer_name: string
  item_label: string | null
  item_position: number | null
  flexible: boolean
  urgent: boolean
  order_created_at: string
}

type QueueRaw = PieceRow & {
  orders: {
    due_date: string
    status: string
    flexible: boolean
    urgent: boolean
    created_at: string
    customer_id: string
    customers: { name: string } | null
  } | null
  order_items: { description: string; position: number } | null
}

const CLOSED_ORDER_STATUSES = '(delivered,cancelled)'

// "¿Qué imprimo?": every unfinished piece of an open order, flattened with the
// order data the queue needs to sort and label it.
export async function listOpenPieces(): Promise<QueuePiece[]> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select(
      '*, orders!inner(due_date, status, flexible, urgent, created_at, customer_id, customers(name)), order_items(description, position)',
    )
    .neq('status', 'done')
    .not('orders.status', 'in', CLOSED_ORDER_STATUSES)
    // "En espera" orders aren't confirmed: nothing of theirs gets printed.
    .is('orders.waiting_reason', null)
  if (error) throw error
  return ((data ?? []) as unknown as QueueRaw[])
    .filter((row) => row.orders)
    .map(({ orders, order_items, ...piece }) => ({
      ...piece,
      due_date: orders!.due_date,
      order_status: orders!.status,
      customer_id: orders!.customer_id,
      flexible: orders!.flexible ?? false,
      urgent: orders!.urgent ?? false,
      order_created_at: orders!.created_at,
      customer_name: orders!.customers?.name ?? 'Sin nombre',
      item_label: order_items?.description ?? null,
      item_position: order_items?.position ?? null,
    }))
}

export interface OrderProgress {
  done: number
  total: number
  pieces: number
  lastOperatorId: string | null
}

// Per-order piece progress for the list, board and "Hoy" (quantities, not
// piece counts: 21/33 llaveros reads as 21/33).
export async function listOrderProgress(): Promise<
  Record<string, OrderProgress>
> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select('order_id, quantity_done, quantity_total, updated_by, updated_at')
  if (error) throw error
  const out: Record<string, OrderProgress & { lastAt: string }> = {}
  for (const row of data ?? []) {
    const entry = (out[row.order_id] ??= {
      done: 0,
      total: 0,
      pieces: 0,
      lastOperatorId: null,
      lastAt: '',
    })
    entry.done += row.quantity_done
    entry.total += row.quantity_total
    entry.pieces += 1
    if (row.updated_by && row.updated_at > entry.lastAt) {
      entry.lastAt = row.updated_at
      entry.lastOperatorId = row.updated_by
    }
  }
  return out
}

export interface PieceEdit {
  label: string
  color: string | null
  quantityTotal: number
  // Left out = keep it; null = no filament chosen.
  filamentColorId?: string | null
}

// Rename / recolor / re-count a piece. The database keeps the done count and
// the status coherent when the total changes.
export async function updatePiece(
  id: string,
  edit: PieceEdit,
  operatorId: string | null,
): Promise<PieceRow> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .update({
      label: edit.label,
      color: edit.color,
      quantity_total: edit.quantityTotal,
      ...(edit.filamentColorId !== undefined && {
        filament_color_id: edit.filamentColorId,
      }),
      updated_by: operatorId,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

import { supabase } from '@/lib/supabase'
import type { PaymentMethod } from '@/lib/domain-constants'
import type { PaymentRow } from './payments'

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// The database checks the amount against the balance, keeps the order's
// deposit / pending balance in step and logs the payment in the order's activity.
export async function registerOrderPayment(
  orderId: string,
  amount: number,
  method: PaymentMethod,
  operatorId: string | null,
  note?: string,
): Promise<PaymentRow> {
  const { data, error } = await supabase.rpc('register_order_payment', {
    p_order: orderId,
    p_amount: amount,
    p_method: method,
    p_operator: operatorId as string, // the database rejects null with a message
    p_note: note ?? null,
  })
  if (error) fail(error)
  return data as PaymentRow
}

// Admin only (checked in the database); gives the amount back to the balance.
export async function voidOrderPayment(
  txId: string,
  operatorId: string | null,
  reason: string,
): Promise<PaymentRow> {
  const { data, error } = await supabase.rpc('void_order_payment', {
    p_tx: txId,
    p_operator: operatorId as string, // the database rejects null with a message
    p_reason: reason,
  })
  if (error) fail(error)
  return data as PaymentRow
}

export async function listOrderPayments(orderId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', orderId)
    .eq('type', '3d_service')
    .order('transacted_at', { ascending: false })
  if (error) fail(error)
  return data ?? []
}

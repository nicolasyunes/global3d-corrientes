import { supabase } from '@/lib/supabase'

// Read-only view of the "Pedidos" Google Sheet (SALDO > 0), served by the
// read-pending-orders Edge Function — the sheet's service-account credentials
// never reach the client. See supabase/functions/read-pending-orders/.
export interface PendingSheetOrder {
  nombre: string
  producto: string
  detalles: string
  fechaEntrega: string | null
  fechaEntregaSortKey: string
  total: number | null
  saldo: number
  canal: string
}

export async function listPendingSheetOrders(): Promise<PendingSheetOrder[]> {
  const { data, error } = await supabase.functions.invoke<{
    orders?: PendingSheetOrder[]
    error?: string
  }>('read-pending-orders')

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.orders ?? []
}

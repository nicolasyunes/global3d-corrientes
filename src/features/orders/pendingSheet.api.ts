import {
  ORIGIN_CHANNEL_LABELS,
  PRODUCT_TYPE_LABELS,
  type OrderStatus,
  type OriginChannel,
  type ProductType,
} from '@/lib/domain-constants'
import { supabase } from '@/lib/supabase'
import type { OrderWithCustomer } from './orders.api'

// A row as shown in the "Planilla" tab. Its natural source is the "Pedidos"
// Google Sheet (via the read-pending-orders Edge Function — the sheet's
// service-account credentials never reach the client), but the tab also folds
// in the app's own `orders` so nothing depends on sync latency to appear. See
// supabase/functions/read-pending-orders/ and appOrderToSheetRow below.
export interface PendingSheetOrder {
  id: string // app order id; '' for a row typed straight into the sheet
  nombre: string
  producto: string
  detalles: string
  fechaEntrega: string | null
  fechaEntregaSortKey: string
  total: number | null
  saldo: number
  canal: string
  estado: string
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

// The subset of OrderStatus the sheet expresses as ESTADO text — the only
// states the Planilla's semaphore and estado filter care about. Everything
// else (new, printing, post_processing, …) reads as an empty cell, i.e.
// "pendiente". Mirrors STATUS_ES in sync-order-to-sheet/mapping.ts.
const STATUS_ESTADO: Partial<Record<OrderStatus, string>> = {
  finished: 'listo',
  delivered: 'entregado',
  cancelled: 'cancelado',
}

// Maps an app `orders` row into the Planilla row shape. Used both to merge the
// app's own orders into the tab (so an order shows the instant it's saved,
// without waiting for the sync-order-to-sheet round-trip) and, right after a
// quick capture, to prepend the new order optimistically.
export function appOrderToSheetRow(order: OrderWithCustomer): PendingSheetOrder {
  const iso = order.due_date
  const isDated = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const [year, month, day] = iso.split('-')

  const detalles = [
    order.personalization,
    order.measurements,
    order.observations,
  ]
    .filter((part): part is string => Boolean(part && part.trim() !== ''))
    .join(' — ')

  return {
    id: order.id,
    nombre: order.customers?.name ?? '',
    producto:
      PRODUCT_TYPE_LABELS[order.product_type as ProductType] ??
      order.product_type,
    detalles,
    fechaEntrega: isDated ? `${day}/${month}/${year}` : null,
    fechaEntregaSortKey: isDated ? iso : '9999-99-99',
    total: order.total_amount,
    saldo: order.pending_balance ?? 0,
    canal: order.origin_channel
      ? (ORIGIN_CHANNEL_LABELS[order.origin_channel as OriginChannel] ??
        order.origin_channel)
      : '',
    estado: STATUS_ESTADO[order.status] ?? '',
  }
}

// Folds the app's own orders together with the rows read from the sheet. App
// orders win: a sheet row whose column K matches an app order is dropped as a
// stale mirror of it. Rows typed straight into the sheet (no id) and rows
// whose order no longer exists are kept. Sorted by delivery date ascending,
// the same order the sheet read returns.
export function mergeSheetOrders(
  sheetRows: readonly PendingSheetOrder[],
  appOrders: readonly OrderWithCustomer[],
): PendingSheetOrder[] {
  const appRows = appOrders.map(appOrderToSheetRow)
  const appIds = new Set(appRows.map((row) => row.id))
  const sheetOnly = sheetRows.filter((row) => !row.id || !appIds.has(row.id))

  return [...appRows, ...sheetOnly].sort((a, b) =>
    a.fechaEntregaSortKey.localeCompare(b.fechaEntregaSortKey),
  )
}

import {
  ORIGIN_CHANNEL_LABELS,
  PRODUCT_TYPE_LABELS,
  type OriginChannel,
  type ProductType,
} from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'
import type { ProductSaleRow } from './productSales.api'

// /admin/ventas-pedidos shows two revenue sources side by side: orders the
// shop has delivered, and direct product sales (a `product_sale` transaction).
// They have different columns, so both are normalized to this one row shape
// before grouping/summing.
export interface VentaRow {
  id: string
  kind: 'order' | 'product'
  date: string // 'YYYY-MM-DD' — due_date for orders, sale date for products
  customerName: string | null
  productLabel: string
  channelLabel: string | null // origin channel for orders; null for product sales
  amount: number | null
  href: string | null // order detail link; null for product sales
}

export interface MonthGroup {
  month: string // 'YYYY-MM'
  label: string // 'agosto de 2026' via toLocaleDateString
  rows: VentaRow[]
  total: number
}

export function orderToVentaRow(order: OrderWithCustomer): VentaRow {
  return {
    id: order.id,
    kind: 'order',
    date: order.due_date,
    customerName: order.customers?.name ?? null,
    productLabel:
      PRODUCT_TYPE_LABELS[order.product_type as ProductType] ??
      order.product_type,
    channelLabel: order.origin_channel
      ? ORIGIN_CHANNEL_LABELS[order.origin_channel as OriginChannel] ??
        order.origin_channel
      : null,
    amount: order.total_amount,
    href: `/admin/orders/${order.id}`,
  }
}

export function productSaleToVentaRow(sale: ProductSaleRow): VentaRow {
  return {
    id: sale.id,
    kind: 'product',
    date: sale.transacted_at.slice(0, 10),
    customerName: sale.customers?.name ?? null,
    productLabel: sale.products?.name ?? sale.note ?? 'Producto',
    channelLabel: null,
    amount: sale.amount,
    href: null,
  }
}

// Merge both sources into one newest-first list. listDeliveredOrders() and
// listProductSales() are each already date-sorted, but interleaving them needs
// an explicit re-sort by the normalized `date`.
export function toVentaRows(
  orders: readonly OrderWithCustomer[],
  productSales: readonly ProductSaleRow[],
): VentaRow[] {
  return [
    ...orders.map(orderToVentaRow),
    ...productSales.map(productSaleToVentaRow),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Buckets rows by month of `date`. Group order follows first-encounter order
// in `rows`, so a date-descending input yields newest-month-first groups.
export function groupVentasByMonth(rows: readonly VentaRow[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  const byMonth = new Map<string, MonthGroup>()

  for (const row of rows) {
    const month = row.date.slice(0, 7)
    let group = byMonth.get(month)
    if (!group) {
      group = {
        month,
        label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('es-AR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        rows: [],
        total: 0,
      }
      byMonth.set(month, group)
      groups.push(group)
    }
    group.rows.push(row)
    group.total += row.amount ?? 0
  }

  return groups
}

export function ventasTotal(rows: readonly VentaRow[]): number {
  return rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
}

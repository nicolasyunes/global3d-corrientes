import type { SaleWithInventory } from './sales.api'

export interface SaleDayGroup {
  day: string // 'YYYY-MM-DD', local to the sale's transacted_at
  label: string // 'mié, 19 ago' via toLocaleDateString — matches orders' date format
  sales: SaleWithInventory[]
  total: number
}

// Groups the already-newest-first sales list into day buckets, preserving
// order (both the day buckets and the sales within each stay newest-first).
// Each bucket carries its own revenue subtotal so the ledger reads like a
// daily cash-out sheet instead of an undifferentiated stream of rows.
export function groupSalesByDay(
  sales: readonly SaleWithInventory[],
): SaleDayGroup[] {
  const groups: SaleDayGroup[] = []
  const byDay = new Map<string, SaleDayGroup>()

  for (const sale of sales) {
    const date = new Date(sale.transacted_at)
    const day = sale.transacted_at.slice(0, 10)
    let group = byDay.get(day)
    if (!group) {
      group = {
        day,
        label: date.toLocaleDateString('es-AR', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        sales: [],
        total: 0,
      }
      byDay.set(day, group)
      groups.push(group)
    }
    group.sales.push(sale)
    group.total += sale.amount
  }

  return groups
}

export function totalAmount(sales: readonly SaleWithInventory[]): number {
  return sales.reduce((sum, sale) => sum + sale.amount, 0)
}

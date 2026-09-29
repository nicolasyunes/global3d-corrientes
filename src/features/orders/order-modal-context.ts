import { createContext, useContext } from 'react'
import type { OrderRow } from './orders.api'

export interface OrderModalApi {
  openNew: () => void
  openEdit: (orderId: string, onSaved?: (order: OrderRow) => void) => void
}

export const OrderModalContext = createContext<OrderModalApi | null>(null)

export function useOrderModal(): OrderModalApi {
  const ctx = useContext(OrderModalContext)
  if (!ctx)
    throw new Error('useOrderModal must be used inside OrderModalProvider')
  return ctx
}

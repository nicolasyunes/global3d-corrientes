import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/useToast'
import OrderModal from './OrderModal'
import { OrderModalContext, type OrderModalApi } from './order-modal-context'
import type { OrderRow } from './orders.api'

type State =
  | { open: false }
  | {
      open: true
      orderId: string | null
      onSaved?: (order: OrderRow) => void
      key: number
    }

export function OrderModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false })
  const [toast, showToast] = useToast(2400)
  const navigate = useNavigate()

  const openNew = useCallback(
    () => setState({ open: true, orderId: null, key: Date.now() }),
    [],
  )
  const openEdit = useCallback(
    (orderId: string, onSaved?: (order: OrderRow) => void) =>
      setState({ open: true, orderId, onSaved, key: Date.now() }),
    [],
  )
  const api = useMemo<OrderModalApi>(
    () => ({ openNew, openEdit }),
    [openNew, openEdit],
  )

  function handleSaved(order: OrderRow) {
    if (!state.open) return
    const editing = state.orderId !== null
    state.onSaved?.(order)
    setState({ open: false })
    if (editing) {
      showToast('Pedido actualizado')
    } else {
      showToast('Pedido cargado. Sumale las piezas que lleva.')
      navigate(`/admin/orders/${order.id}`)
    }
  }

  return (
    <OrderModalContext.Provider value={api}>
      {children}
      {state.open && (
        <OrderModal
          key={state.key}
          orderId={state.orderId}
          onClose={() => setState({ open: false })}
          onSaved={handleSaved}
        />
      )}
      {toast}
    </OrderModalContext.Provider>
  )
}

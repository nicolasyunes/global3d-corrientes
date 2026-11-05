import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatMoney } from './format'
import { useOrderModal } from './order-modal-context'
import {
  listNewWebOrders,
  markSeen,
  readSeen,
  unseen,
  type WebOrder,
} from './webOrders'
import './webOrders.css'

const POLL_MS = 60_000

/**
 * Aviso flotante cuando entra un pedido de la tienda. Revisa cada minuto y al
 * volver a la pestaña; mientras haya pedidos sin ver, también lo indica en el
 * título de la pestaña. "Ver" abre el pedido (o la lista si son varios).
 */
export function WebOrdersAlert() {
  const [pending, setPending] = useState<WebOrder[]>([])
  const { openEdit } = useOrderModal()
  const navigate = useNavigate()
  const location = useLocation()

  const check = useCallback(() => {
    listNewWebOrders()
      .then((orders) => setPending(unseen(orders, readSeen())))
      .catch(() => {})
  }, [])

  useEffect(() => {
    check()
    const timer = setInterval(() => {
      if (!document.hidden) check()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  useEffect(() => check(), [location.pathname, check])

  useEffect(() => {
    if (!pending.length) return
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = `(${pending.length}) ${base}`
    return () => {
      document.title = document.title.replace(/^\(\d+\) /, '')
    }
  }, [pending.length])

  if (!pending.length) return null

  const one = pending.length === 1 ? pending[0] : null
  const dismiss = () => {
    markSeen(pending)
    setPending([])
  }
  const open = () => {
    dismiss()
    if (one) openEdit(one.id)
    else navigate('/admin/orders')
  }

  return (
    <div className="web-orders-alert" role="status" aria-live="polite">
      <span className="web-orders-alert__dot" aria-hidden="true" />
      <p>
        <strong>
          {one
            ? 'Pedido nuevo de la tienda'
            : `${pending.length} pedidos nuevos de la tienda`}
        </strong>
        {one && (
          <span>
            {one.customer ?? 'Sin nombre'}
            {one.total != null ? ` · ${formatMoney(one.total)}` : ''}
          </span>
        )}
      </p>
      <button type="button" className="web-orders-alert__open" onClick={open}>
        Ver
      </button>
      <button
        type="button"
        className="web-orders-alert__close"
        onClick={dismiss}
        aria-label="Ya lo vi"
      >
        Listo
      </button>
    </div>
  )
}

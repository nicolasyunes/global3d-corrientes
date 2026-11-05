import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatMoney } from './format'
import {
  listPendingWebOrders,
  markSeen,
  readSeen,
  unseen,
  type WebOrder,
} from './webOrders'
import { WebOrdersPanel } from './WebOrdersPanel'
import './webOrders.css'

const POLL_MS = 60_000

/**
 * Pedidos de la tienda por confirmar. Si entró alguno que este dispositivo no
 * vio, muestra un aviso; si ya se vieron pero siguen sin confirmar, queda una
 * pastilla chica. Las dos abren el panel para confirmar o descartar. Revisa
 * cada minuto y al volver a la pestaña, y pone "(N)" en el título.
 */
export function WebOrdersAlert() {
  const [pending, setPending] = useState<WebOrder[]>([])
  const [seenAt, setSeenAt] = useState(readSeen)
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const check = useCallback(() => {
    listPendingWebOrders()
      .then(setPending)
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

  const fresh = unseen(pending, seenAt)

  useEffect(() => {
    if (!fresh.length) return
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = `(${fresh.length}) ${base}`
    return () => {
      document.title = document.title.replace(/^\(\d+\) /, '')
    }
  }, [fresh.length])

  const acknowledge = () => {
    markSeen(pending)
    setSeenAt(readSeen())
  }
  const review = () => {
    acknowledge()
    setOpen(true)
  }

  if (!pending.length) return null

  const one = fresh.length === 1 ? fresh[0] : null

  return (
    <>
      {fresh.length > 0 ? (
        <div className="web-orders-alert" role="status" aria-live="polite">
          <span className="web-orders-alert__dot" aria-hidden="true" />
          <p>
            <strong>
              {one
                ? 'Pedido de la tienda por confirmar'
                : `${fresh.length} pedidos de la tienda por confirmar`}
            </strong>
            {one && (
              <span>
                {one.customer ?? 'Sin nombre'}
                {one.total ? ` · ${formatMoney(one.total)}` : ''}
              </span>
            )}
          </p>
          <button
            type="button"
            className="web-orders-alert__open"
            onClick={review}
          >
            Revisar
          </button>
          <button
            type="button"
            className="web-orders-alert__close"
            onClick={acknowledge}
          >
            Después
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="web-orders-pill"
          onClick={() => setOpen(true)}
        >
          <span className="web-orders-alert__dot" aria-hidden="true" />
          Tienda: {pending.length} por confirmar
        </button>
      )}
      {open && (
        <WebOrdersPanel
          orders={pending}
          onClose={() => setOpen(false)}
          onChanged={check}
        />
      )}
    </>
  )
}

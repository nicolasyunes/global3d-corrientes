import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { formatMoney } from './format'
import {
  confirmWebOrder,
  customerWhatsApp,
  DELIVERY_LABEL,
  discardWebOrder,
  type WebOrder,
} from './webOrders'

/**
 * Panel con los pedidos de la tienda por confirmar. "Confirmar" lo pasa a
 * pedido normal del taller (aparece en Hoy, Semana y Pedidos); "Descartar" lo
 * cancela. Los que nadie toca se cancelan solos a las 72 horas.
 */
export function WebOrdersPanel({
  orders,
  onClose,
  onChanged,
}: {
  orders: WebOrder[]
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const act = async (o: WebOrder, kind: 'confirm' | 'discard') => {
    if (
      kind === 'discard' &&
      !window.confirm(
        `¿Descartar el pedido ${o.code} de ${o.customer ?? 'sin nombre'}? Queda cancelado.`,
      )
    )
      return
    setBusy(o.id)
    setError(null)
    try {
      const ok =
        kind === 'confirm'
          ? await confirmWebOrder(o.id)
          : await discardWebOrder(o.id)
      if (!ok)
        setError(
          `El pedido ${o.code} ya no estaba pendiente; actualicé la lista.`,
        )
      onChanged()
    } catch {
      setError('No se pudo guardar. Revisá la conexión y probá de nuevo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="web-orders-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-orders-title"
    >
      <button
        type="button"
        className="web-orders-panel__scrim"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="web-orders-panel__sheet">
        <header>
          <h2 id="web-orders-title">Pedidos de la tienda por confirmar</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="web-orders-panel__help">
          Confirmalos cuando llegue la seña o el mensaje del cliente. Los que no
          se confirman en 72 horas se cancelan solos.
        </p>
        {error && (
          <p className="web-orders-panel__error" role="alert">
            {error}
          </p>
        )}
        {orders.length === 0 ? (
          <p className="web-orders-panel__empty">No hay pedidos pendientes.</p>
        ) : (
          <ul>
            {orders.map((o) => {
              const wa = customerWhatsApp(o)
              const deposit = o.payment?.deposit
              return (
                <li key={o.id}>
                  <div className="web-orders-panel__head">
                    <strong>{o.customer ?? 'Sin nombre'}</strong>
                    <span>
                      {o.code} ·{' '}
                      {new Date(o.createdAt).toLocaleString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <ul className="web-orders-panel__items">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.quantity} × {it.description}
                        {it.personalization ? ` (${it.personalization})` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="web-orders-panel__meta">
                    {o.total ? formatMoney(o.total) : 'A cotizar'}
                    {o.payment?.mode === 'sena' && deposit
                      ? ` · seña ${formatMoney(deposit)}`
                      : ''}
                    {' · '}
                    {o.payment?.method === 'cash'
                      ? 'efectivo'
                      : 'transferencia'}
                    {' · '}
                    {DELIVERY_LABEL[o.delivery?.mode] ?? ''}
                    {o.delivery?.address ? ` (${o.delivery.address})` : ''}
                  </p>
                  <div className="web-orders-panel__actions">
                    <button
                      type="button"
                      className="web-orders-panel__confirm"
                      disabled={busy === o.id}
                      onClick={() => void act(o, 'confirm')}
                    >
                      Confirmar
                    </button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      className="web-orders-panel__discard"
                      disabled={busy === o.id}
                      onClick={() => void act(o, 'discard')}
                    >
                      Descartar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

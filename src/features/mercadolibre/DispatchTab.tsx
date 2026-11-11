import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import {
  fabricateTotals,
  orderUrl,
  shippingLabel,
  toFabricate,
  urgency,
  URGENCY_LABELS,
} from './ml'
import { listPendingDispatches, type MlOrder } from './ml.api'

function limitText(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Ventas de ML que todavía hay que preparar o despachar, las más urgentes primero.
export default function DispatchTab() {
  const [rows, setRows] = useState<MlOrder[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(() => {
    setStatus('loading')
    listPendingDispatches()
      .then((list) => {
        setRows(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const now = new Date()
  const fabricate = fabricateTotals(rows)

  return (
    <div className="ml-tab">
      {status === 'error' && (
        <p className="banner banner--error" role="alert">
          No se pudieron cargar los despachos.{' '}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={load}
          >
            Reintentar
          </button>
        </p>
      )}

      {fabricate.length > 0 && (
        <div className="card ml-fabricate">
          <h2 className="card__title">
            <Icon name="printer" /> A fabricar para ML
          </h2>
          <ul>
            {fabricate.map((f) => (
              <li key={f.description}>
                <strong>{f.qty}×</strong> {f.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'ready' && rows.length === 0 && (
        <div className="empty">
          <strong>Nada para despachar</strong>
          Las ventas nuevas de MercadoLibre aparecen acá cuando el gestor las
          registra.
        </div>
      )}

      <ul className="ml-list">
        {rows.map((o) => {
          const u = urgency(o.handling_limit, now)
          const fab = toFabricate(o.items)
          return (
            <li key={o.ml_order_id} className={`ml-order ml-order--${u}`}>
              <div className="ml-order__top">
                <span className={`ml-urg ml-urg--${u}`}>
                  {URGENCY_LABELS[u]}
                </span>
                {o.handling_limit && (
                  <span className="muted">
                    antes del {limitText(o.handling_limit)}
                  </span>
                )}
              </div>
              <ul className="ml-order__items">
                {(o.items ?? []).map((i, k) => (
                  <li key={k}>
                    {i.quantity}× {i.description}
                  </li>
                ))}
              </ul>
              {fab.length > 0 && (
                <p className="ml-order__fab">
                  <Icon name="printer" size={16} /> Imprimir:{' '}
                  {fab.map((f) => `${f.qty}× ${f.description}`).join(', ')}
                </p>
              )}
              <p className="ml-order__meta muted">
                {[
                  o.buyer_nickname,
                  shippingLabel(o.shipping_status),
                  `Venta #${o.ml_order_id}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                <a
                  href={orderUrl(o.ml_order_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver en ML <Icon name="external" size={14} />
                </a>
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

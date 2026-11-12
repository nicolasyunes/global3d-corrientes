import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CopyButton } from '../components/bits'
import { IconWhatsApp } from '../components/Icons'
import { MpCardPayment } from '../components/MpCardPayment'
import { api } from '../lib/api'
import { useShop } from '../lib/data'
import { ars, shortDate } from '../lib/format'
import { writeReviewUrl } from '../lib/reviews'
import { trackingDate } from '../lib/shipping'
import type { OrderStatus, OrderStatusResult } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { DELIVERY_LABEL, waLink } from '../lib/whatsapp'
import type { FreshOrderState } from './Checkout'

// Pasos que ve el cliente, en orden. Varios estados del taller caen en el mismo paso.
const STEPS: Array<{ label: string; statuses: OrderStatus[] }> = [
  { label: 'Pedido recibido', statuses: ['new'] },
  { label: 'Confirmado', statuses: ['in_queue'] },
  { label: 'En impresión', statuses: ['printing', 'post_processing'] },
  { label: 'Listo', statuses: ['finished'] },
  { label: 'Entregado', statuses: ['delivered'] },
]

const HEADLINE: Record<OrderStatus, string> = {
  new: 'Recibimos tu pedido',
  in_queue: 'Tu pedido está confirmado',
  printing: 'Estamos imprimiendo tu pedido',
  post_processing: 'Le estamos dando las terminaciones',
  finished: '¡Tu pedido está listo!',
  delivered: 'Pedido entregado',
  cancelled: 'Pedido cancelado',
}

export function Order() {
  const { token = '' } = useParams()
  const loc = useLocation()
  const fresh = (loc.state as FreshOrderState | null)?.fresh
    ? (loc.state as FreshOrderState)
    : null
  const { settings } = useShop()
  const [order, setOrder] = useState<OrderStatusResult | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    'loading',
  )
  usePageTitle(order ? `Pedido #${order.code}` : 'Tu pedido')
  const [reloadKey, setReloadKey] = useState(0)
  // El pago se registra en el servidor: se vuelve a leer el pedido un momento
  // después para mostrar la seña cobrada y el estado confirmado.
  const refresh = useCallback(() => {
    setTimeout(() => setReloadKey((k) => k + 1), 1500)
  }, [])
  // Vuelta de "Pagar con Mercado Pago": el resultado viene en la dirección y
  // el pago lo registra el aviso de Mercado Pago unos segundos después.
  const mpReturn = new URLSearchParams(loc.search).get('collection_status')
  useEffect(() => {
    if (mpReturn !== 'approved' && mpReturn !== 'in_process') return
    const timers = [3000, 8000].map((ms) =>
      setTimeout(() => setReloadKey((k) => k + 1), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [mpReturn])

  useEffect(() => {
    let alive = true
    api
      .orderStatus(token)
      .then((o) => {
        if (!alive) return
        setOrder(o)
        setState(o ? 'ready' : 'missing')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [token, reloadKey])

  if (state === 'loading')
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="skeleton" style={{ height: 380 }} />
      </div>
    )
  if (state !== 'ready' || !order)
    return (
      <div className="container empty">
        <h1 style={{ fontSize: '1.8rem' }}>
          {state === 'missing'
            ? 'No encontramos este pedido'
            : 'No pudimos cargar el pedido'}
        </h1>
        <p className="muted">
          Revisá el link o escribinos por WhatsApp con tu nombre.
        </p>
        <a
          className="btn btn-wa"
          href={waLink(
            settings.whatsapp,
            '¡Hola Global3D! Quiero consultar por mi pedido.',
          )}
          target="_blank"
          rel="noreferrer"
        >
          Escribir por WhatsApp
        </a>
      </div>
    )

  const cancelled = order.status === 'cancelled'
  const currentStep = STEPS.findIndex((s) => s.statuses.includes(order.status))
  const total = order.total ?? 0
  const paid = order.deposit
  const balance = order.pendingBalance ?? Math.max(0, total - paid)
  const toTransfer = fresh ? fresh.deposit : order.payment.deposit
  const isTransfer = (fresh?.method ?? order.payment.method) === 'transfer'
  const isCard = (fresh?.method ?? order.payment.method) === 'mercadopago'
  const mpKey = settings.mercadopago?.publicKey
  const waText =
    fresh?.waText ??
    `¡Hola Global3D! Consulto por mi pedido #${order.code}: ${window.location.href}`
  const t = settings.transferencia

  return (
    <div className="container" style={{ maxWidth: 760, paddingBottom: 48 }}>
      <div className="page-title">
        <span className="muted" style={{ fontWeight: 700 }}>
          Pedido #{order.code}
        </span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4.4vw, 2.6rem)' }}>
          {fresh
            ? `¡Listo, ${order.customerFirstName}! Falta un paso`
            : order.pendingConfirmation
              ? 'Falta confirmar tu pedido'
              : HEADLINE[order.status]}
        </h1>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        {order.status === 'delivered' && (
          <section className="panel rev-ask" aria-labelledby="rev-ask-title">
            <h2 id="rev-ask-title">¿Te gustó tu pedido?</h2>
            <p className="muted">
              Dejanos tu reseña en Google. Nos ayuda mucho a que otros nos
              encuentren.
            </p>
            <a
              className="btn btn-primary"
              href={writeReviewUrl(settings.resenas, settings.local.mapsQuery)}
              target="_blank"
              rel="noreferrer"
            >
              Dejá tu reseña
            </a>
          </section>
        )}
        {mpReturn === 'approved' && (
          <div className="notice n-ok" role="status">
            ¡Pago aprobado con Mercado Pago! En unos segundos lo vas a ver
            acreditado acá.
          </div>
        )}
        {(mpReturn === 'in_process' || mpReturn === 'pending') && (
          <div className="notice n-info" role="status">
            Tu pago con Mercado Pago quedó en revisión. Te avisamos apenas se
            acredite; no hace falta pagar de nuevo.
          </div>
        )}
        {isCard &&
          mpKey &&
          !cancelled &&
          paid < toTransfer &&
          mpReturn !== 'approved' && (
            <MpCardPayment
              orderToken={token}
              amount={toTransfer - paid}
              publicKey={mpKey}
              onPaid={refresh}
            />
          )}
        {(fresh || order.pendingConfirmation) && (
          <section
            className="panel"
            style={{ borderColor: 'var(--accent)', borderWidth: 2 }}
          >
            <h2>Mandanos el pedido por WhatsApp</h2>
            <p className="muted">
              {fresh
                ? 'Ya lo guardamos. Abrí WhatsApp y mandanos el mensaje que te dejamos escrito'
                : 'Todavía no lo confirmamos. Mandanos el mensaje por WhatsApp'}
              {isTransfer ? ', con el comprobante de la transferencia.' : '.'}{' '}
              Si no lo confirmamos en 72 horas, se cancela solo.
            </p>
            <a
              className="btn btn-wa btn-block"
              href={waLink(settings.whatsapp, waText)}
              target="_blank"
              rel="noreferrer"
            >
              <IconWhatsApp size={22} /> Enviar pedido por WhatsApp
            </a>
          </section>
        )}

        {isTransfer && !cancelled && paid < toTransfer && (
          <section className="panel" aria-labelledby="t-title">
            <h2 id="t-title">Datos para transferir</h2>
            <div>
              <div className="copy-row">
                <span>Monto</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{ars(toTransfer)}</strong>
                  <CopyButton
                    text={String(Math.round(toTransfer))}
                    label="monto"
                  />
                </span>
              </div>
              <div className="copy-row">
                <span>Alias</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{t.alias}</strong>
                  <CopyButton text={t.alias} label="alias" />
                </span>
              </div>
              <div className="copy-row wide">
                <span>CBU</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{t.cbu}</strong>
                  <CopyButton text={t.cbu} label="CBU" />
                </span>
              </div>
              <div className="copy-row wide">
                <span>Titular</span>
                <strong>{t.titular}</strong>
              </div>
              <div className="copy-row">
                <span>Banco</span>
                <strong>{t.banco}</strong>
              </div>
            </div>
            <p className="hint">
              Mandanos el comprobante por WhatsApp. Lo arrancamos apenas
              confirmamos el pago.
            </p>
          </section>
        )}

        {cancelled ? (
          <div className="notice n-danger">
            Este pedido se canceló. Si es un error, escribinos por WhatsApp.
          </div>
        ) : (
          <section className="panel" aria-labelledby="s-title">
            <h2 id="s-title">Estado</h2>
            <ol className="timeline">
              {STEPS.map((s, i) => {
                const cls =
                  i < currentStep
                    ? 'done'
                    : i === currentStep
                      ? 'current'
                      : 'todo'
                return (
                  <li key={s.label} className={cls}>
                    <div>
                      <div className="tl-dot">
                        {i < currentStep ? '✓' : i + 1}
                      </div>
                      {i < STEPS.length - 1 && <div className="tl-line" />}
                    </div>
                    <div className="tl-text">
                      <strong>{s.label}</strong>
                      {i === 0 && (
                        <span className="hint">
                          {new Date(order.createdAt).toLocaleDateString(
                            'es-AR',
                          )}
                        </span>
                      )}
                      {s.label === 'Listo' &&
                        i >= currentStep &&
                        order.dueDate && (
                          <span className="hint">
                            Estimado: {shortDate(order.dueDate)}
                          </span>
                        )}
                      {s.label === 'Listo' && i === currentStep && (
                        <span className="hint">
                          {order.delivery.mode === 'retiro'
                            ? `Pasá a buscarlo por ${settings.local.direccion} (${settings.local.horarios}).`
                            : 'Te escribimos para coordinar el envío.'}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        <section className="panel" aria-labelledby="d-title">
          <h2 id="d-title">Detalle</h2>
          {order.items.map((i, idx) => (
            <div
              key={idx}
              className="sum-row"
              style={{ alignItems: 'flex-start' }}
            >
              <span>
                {i.quantity} × {i.description}
                {i.personalization && (
                  <span className="li-sub" style={{ display: 'block' }}>
                    {i.personalization}
                  </span>
                )}
              </span>
              <span className="num" style={{ whiteSpace: 'nowrap' }}>
                {i.unitPrice === null
                  ? 'A cotizar'
                  : ars(i.unitPrice * i.quantity)}
              </span>
            </div>
          ))}
          <div
            className="sum-row"
            style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}
          >
            <span>Total</span>
            <span className="num">{ars(total)}</span>
          </div>
          <div className="sum-row">
            <span>Pagado</span>
            <span className="num">{ars(paid)}</span>
          </div>
          <div className="sum-row big">
            <span>Saldo</span>
            <span className="num">{ars(balance)}</span>
          </div>
          <div className="sum-row">
            <span>Entrega</span>
            <span style={{ textAlign: 'right' }}>
              {DELIVERY_LABEL[order.delivery.mode]}
              {order.delivery.address && (
                <span className="li-sub" style={{ display: 'block' }}>
                  {order.delivery.address}
                </span>
              )}
            </span>
          </div>
        </section>

        {order.shipment?.trackingNumber && (
          <section className="panel" aria-labelledby="track-title">
            <h2 id="track-title">Seguimiento del envío</h2>
            <p className="hint">
              Correo Argentino · N° <strong>{order.shipment.trackingNumber}</strong>
            </p>
            {order.shipment.events.length ? (
              <ol className="track-events">
                {order.shipment.events.map((e, i) => (
                  <li key={i}>
                    <span className="num">{trackingDate(e.date)}</span>{' '}
                    <strong>{e.event}</strong>
                    {e.branch ? ` · ${e.branch}` : ''}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="hint">
                Todavía no hay movimientos. Aparecen cuando Correo lo recibe.
              </p>
            )}
          </section>
        )}

        <div className="grid-2">
          {!fresh && (
            <a
              className="btn btn-wa"
              href={waLink(settings.whatsapp, waText)}
              target="_blank"
              rel="noreferrer"
            >
              Consultar por WhatsApp
            </a>
          )}
          <Link to="/catalogo" className="btn btn-ghost">
            Seguir mirando
          </Link>
        </div>
        <p className="hint">
          Guardá este link: acá vas a ver cuándo está listo tu pedido.
        </p>
      </div>
    </div>
  )
}

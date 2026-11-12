import { useEffect, useState } from 'react'
import { formatMoney } from '@/features/orders/format'
import {
  eventDate,
  initialRecipient,
  isCorreoShipping,
  recipientError,
  shipmentErrorMessage,
  type SavedShipping,
  type ShipmentRecipient,
  type ShipmentRow,
} from './shipment'
import {
  getOrderShipment,
  importShipment,
  refreshTracking,
} from './shipment.api'
import { PROVINCE_OPTIONS } from './provinces'
import './shipment.css'

interface Props {
  orderId: string
  customer: { name?: string | null; phone?: string | null }
}

/**
 * Tarjeta "Envío por Correo" del pedido: solo aparece en pedidos web cotizados
 * con Correo Argentino. Crea el envío en MiCorreo (después se genera la
 * etiqueta allá) y sigue el envío con el número que pega el taller.
 */
export default function OrderShipment({ orderId, customer }: Props) {
  const [shipping, setShipping] = useState<SavedShipping | null>(null)
  const [shipment, setShipment] = useState<ShipmentRow | null>(null)
  const [form, setForm] = useState<ShipmentRecipient | null>(null)
  const [tracking, setTracking] = useState('')
  const [busy, setBusy] = useState<'import' | 'tracking' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    let alive = true
    getOrderShipment(orderId)
      .then(({ shipping, shipment }) => {
        if (!alive) return
        setShipping(shipping)
        setShipment(shipment)
        setTracking(shipment?.tracking_number ?? '')
        if (isCorreoShipping(shipping))
          setForm(
            initialRecipient(shipping, {
              name: customer.name,
              whatsapp: customer.phone,
            }),
          )
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [orderId, customer.name, customer.phone])

  if (!isCorreoShipping(shipping) || !form) return null
  const type = shipping.type!
  const imported = !!shipment?.imported_at
  const formError = recipientError(form, type)
  const set = (k: keyof ShipmentRecipient, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  const doImport = async () => {
    setTried(true)
    setError(null)
    if (formError) return
    setBusy('import')
    const res = await importShipment(orderId, form)
    setBusy(null)
    if (!res.ok) {
      setError(shipmentErrorMessage(res.error, res.message))
      // Puede haber quedado el error guardado.
      void getOrderShipment(orderId).then((d) => setShipment(d.shipment))
      return
    }
    const d = await getOrderShipment(orderId)
    setShipment(d.shipment)
  }

  const doTracking = async () => {
    setError(null)
    setBusy('tracking')
    const changed = tracking.trim() !== (shipment?.tracking_number ?? '')
    const res = await refreshTracking(orderId, changed ? tracking : undefined)
    setBusy(null)
    if (!res.ok) {
      setError(shipmentErrorMessage(res.error, res.message))
      return
    }
    setTracking(res.trackingNumber)
    setShipment((s) =>
      s
        ? {
            ...s,
            tracking_number: res.trackingNumber,
            tracking_events: res.events,
            tracking_checked_at: res.checkedAt,
          }
        : s,
    )
  }

  const field = (
    k: keyof ShipmentRecipient,
    label: string,
    opts: { wide?: boolean; type?: string; max?: number } = {},
  ) => (
    <label
      className={`shipment__field${opts.wide ? ' shipment__field--wide' : ''}`}
    >
      <span className="field-label">{label}</span>
      <input
        className="input"
        type={opts.type ?? 'text'}
        maxLength={opts.max}
        value={form[k]}
        disabled={imported}
        onChange={(e) => set(k, e.target.value)}
      />
    </label>
  )

  return (
    <section className="card shipment">
      <div className="card__head">
        <h2 className="card__title">Envío por Correo</h2>
        <span className="spacer" />
        <span className={`badge ${imported ? 'badge--ready' : 'badge--new'}`}>
          {imported ? 'En MiCorreo' : 'Sin crear'}
        </span>
      </div>

      <p className="shipment__summary">
        <strong>
          {shipping.productName ?? 'Correo Argentino'}{' '}
          {type === 'S' ? 'a sucursal' : 'a domicilio'}
        </strong>
        {shipping.price ? ` · ${formatMoney(shipping.price)}` : ''} · CP{' '}
        {shipping.postalCode}
        {type === 'S' && (
          <>
            <br />
            Sucursal {shipping.agencyName ?? shipping.agencyCode}
          </>
        )}
      </p>

      <div className="shipment__grid">
        {field('name', 'Destinatario', { wide: true, max: 80 })}
        {field('email', 'Email', { wide: true, type: 'email', max: 120 })}
        {field('phone', 'Celular', { max: 20 })}
        {type === 'D' && (
          <>
            {field('street', 'Calle', { wide: true, max: 80 })}
            {field('number', 'Número', { max: 10 })}
            {field('floor', 'Piso', { max: 3 })}
            {field('apartment', 'Depto', { max: 3 })}
            {field('city', 'Ciudad', { wide: true, max: 60 })}
            <label className="shipment__field shipment__field--wide">
              <span className="field-label">Provincia</span>
              <select
                className="input"
                value={form.province}
                disabled={imported}
                onChange={(e) => set('province', e.target.value)}
              >
                <option value="">Elegí…</option>
                {PROVINCE_OPTIONS.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {!imported && (
        <>
          {tried && formError && <p className="shipment__err">{formError}</p>}
          {shipment?.last_error && !error && (
            <p className="shipment__err">
              Último intento: MiCorreo lo rechazó: {shipment.last_error}
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => void doImport()}
            disabled={busy !== null}
          >
            {busy === 'import' ? 'Creando…' : 'Crear envío en Correo'}
          </button>
          <p className="muted shipment__hint">
            Se carga en MiCorreo con las cajas del pedido. Después pagás e
            imprimís la etiqueta desde MiCorreo.
          </p>
        </>
      )}

      {imported && (
        <>
          <p className="muted shipment__hint">
            Cargado en MiCorreo como <strong>{shipment!.ext_order_id}</strong>.
            Generá la etiqueta allá y pegá acá el número de seguimiento.
          </p>
          <div className="shipment__track">
            <label className="shipment__field shipment__field--wide">
              <span className="field-label">Número de seguimiento</span>
              <input
                className="input"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Ej: 000500076393019A3G0C701"
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void doTracking()}
              disabled={busy !== null || !tracking.trim()}
            >
              {busy === 'tracking'
                ? 'Buscando…'
                : tracking.trim() !== (shipment?.tracking_number ?? '')
                  ? 'Guardar y seguir'
                  : 'Actualizar'}
            </button>
          </div>
          {shipment?.tracking_number &&
            (shipment.tracking_events.length ? (
              <ol className="shipment__events">
                {shipment.tracking_events.map((e, i) => (
                  <li key={i}>
                    <span className="shipment__date">{eventDate(e.date)}</span>{' '}
                    <strong>{e.event}</strong>
                    {e.branch ? ` · ${e.branch}` : ''}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted shipment__hint">
                Todavía no hay movimientos en Correo.
              </p>
            ))}
        </>
      )}

      {error && (
        <p className="shipment__err" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, orderErrorMessage } from '../lib/api'
import { cart, cartHasQuote, cartTotal, useCart } from '../lib/cart'
import { useShop } from '../lib/data'
import { ars, onlyDigits } from '../lib/format'
import type { DeliveryMode, PaymentMethod, PaymentMode } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { orderMessage } from '../lib/whatsapp'
import { itemStatus } from './Cart'

const CONTACT_KEY = 'g3d.tienda.contact'

function loadContact(): { name: string; whatsapp: string } {
  try {
    const raw = localStorage.getItem(CONTACT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // sin datos guardados
  }
  return { name: '', whatsapp: '' }
}

export interface FreshOrderState {
  fresh: true
  waText: string
  total: number
  deposit: number
  quote: boolean
  method: PaymentMethod
  payMode: PaymentMode
}

export function Checkout() {
  usePageTitle('Confirmar pedido')
  const items = useCart()
  const { settings } = useShop()
  const navigate = useNavigate()
  const saved = loadContact()
  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.whatsapp)
  const [delivery, setDelivery] = useState<DeliveryMode>('retiro')
  const [address, setAddress] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('sena')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) return <Navigate to="/carrito" replace />

  const total = cartTotal(items)
  const quote = cartHasQuote(items)
  const deposit =
    payMode === 'sena'
      ? Math.ceil((total * settings.sena.porcentaje) / 100)
      : total
  const cashAllowed = delivery === 'retiro'
  const effMethod: PaymentMethod = cashAllowed ? method : 'transfer'

  const errs = {
    name: name.trim().length < 2 ? 'Escribí tu nombre.' : null,
    phone:
      onlyDigits(phone).length < 10
        ? 'Escribí tu WhatsApp con característica (ej: 379 4123456).'
        : null,
    address:
      delivery !== 'retiro' && address.trim().length < 5
        ? 'Escribí la dirección de entrega.'
        : null,
  }
  const valid = !errs.name && !errs.phone && !errs.address

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!valid || sending) return
    setSending(true)
    try {
      try {
        localStorage.setItem(
          CONTACT_KEY,
          JSON.stringify({ name: name.trim(), whatsapp: phone.trim() }),
        )
      } catch {
        // no se pudo recordar el contacto: no pasa nada
      }
      const res = await api.createOrder({
        customer: { name: name.trim(), whatsapp: phone },
        items: items.map((i) => ({
          productId: i.productId ?? undefined,
          familySlug: i.productId ? undefined : i.familySlug,
          quantity: i.quantity,
          personalization:
            [
              i.variantLabel && !i.productId ? i.variantLabel : '',
              i.personalizationText,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
        })),
        delivery: {
          mode: delivery,
          address: delivery === 'retiro' ? undefined : address.trim(),
        },
        payment: { mode: payMode, method: effMethod },
        notes: notes.trim() || undefined,
      })
      const trackingUrl = new URL(
        `${import.meta.env.BASE_URL}pedido/${res.token}`,
        window.location.origin,
      ).toString()
      const waText = orderMessage({
        code: res.code,
        items,
        total: res.total,
        deposit: res.deposit,
        quote: res.quote,
        payMode,
        method: effMethod,
        delivery,
        address: address.trim(),
        trackingUrl,
        name: name.trim(),
      })
      const state: FreshOrderState = {
        fresh: true,
        waText,
        total: res.total,
        deposit: res.deposit,
        quote: res.quote,
        method: effMethod,
        payMode,
      }
      // Primero navegamos y después vaciamos: si se vacía antes, esta página
      // redirige al carrito vacío
      navigate(`/pedido/${res.token}`, { replace: true, state })
      window.setTimeout(() => cart.clear(), 0)
    } catch (err) {
      setError(orderErrorMessage(err))
      setSending(false)
    }
  }

  return (
    <div className="container">
      <div className="page-title">
        <Link to="/carrito" style={{ fontWeight: 700 }}>
          ← Volver al carrito
        </Link>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)' }}>
          Confirmá tu pedido
        </h1>
        <p className="muted">
          Te lo guardamos y lo terminás de coordinar con nosotros por WhatsApp.
        </p>
      </div>

      <form className="split" onSubmit={submit} noValidate>
        <div className="stack" style={{ gap: 18 }}>
          <section className="panel" aria-labelledby="c-datos">
            <h2 id="c-datos">Tus datos</h2>
            <div className="grid-2">
              <label className="field">
                <span className="label">Nombre y apellido</span>
                <input
                  id="nombre"
                  className="input"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={(tried && !!errs.name) || undefined}
                />
                {tried && errs.name && (
                  <span className="error-text">{errs.name}</span>
                )}
              </label>
              <label className="field">
                <span className="label">WhatsApp</span>
                <input
                  id="whatsapp"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="379 4123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={(tried && !!errs.phone) || undefined}
                />
                {tried && errs.phone && (
                  <span className="error-text">{errs.phone}</span>
                )}
              </label>
            </div>
          </section>

          <fieldset className="panel" style={{ margin: 0 }}>
            <legend className="sr-only">Entrega</legend>
            <h2 aria-hidden="true">Entrega</h2>
            <div className="choice-list">
              <label className="choice">
                <input
                  type="radio"
                  name="entrega"
                  checked={delivery === 'retiro'}
                  onChange={() => setDelivery('retiro')}
                />
                <span>
                  <strong>Retiro en el local</strong>
                  <small>
                    {settings.local.direccion} · {settings.local.horarios}. Te
                    avisamos cuando está listo.
                  </small>
                </span>
                <span className="end">Gratis</span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="entrega"
                  checked={delivery === 'corrientes'}
                  onChange={() => setDelivery('corrientes')}
                />
                <span>
                  <strong>Envío en Corrientes</strong>
                  <small>{settings.envios.corrientes}.</small>
                </span>
                <span className="end">A coordinar</span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="entrega"
                  checked={delivery === 'pais'}
                  onChange={() => setDelivery('pais')}
                />
                <span>
                  <strong>Envío al resto del país</strong>
                  <small>{settings.envios.pais}.</small>
                </span>
                <span className="end">A cotizar</span>
              </label>
            </div>
            {delivery !== 'retiro' && (
              <label className="field">
                <span className="label">Dirección, ciudad y código postal</span>
                <input
                  id="direccion"
                  className="input"
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  aria-invalid={(tried && !!errs.address) || undefined}
                />
                {tried && errs.address && (
                  <span className="error-text">{errs.address}</span>
                )}
              </label>
            )}
          </fieldset>

          <fieldset className="panel" style={{ margin: 0 }}>
            <legend className="sr-only">Pago</legend>
            <h2 aria-hidden="true">¿Cuánto pagás ahora?</h2>
            <div className="choice-list">
              <label className="choice">
                <input
                  type="radio"
                  name="modo"
                  checked={payMode === 'sena'}
                  onChange={() => setPayMode('sena')}
                />
                <span>
                  <strong>Seña del {settings.sena.porcentaje}%</strong>
                  <small>El saldo lo pagás al retirar o antes del envío.</small>
                </span>
                <span className="end num">
                  {ars(Math.ceil((total * settings.sena.porcentaje) / 100))}
                </span>
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="modo"
                  checked={payMode === 'total'}
                  onChange={() => setPayMode('total')}
                />
                <span>
                  <strong>El total</strong>
                  <small>Y te olvidás del saldo.</small>
                </span>
                <span className="end num">{ars(total)}</span>
              </label>
            </div>
            <h2 aria-hidden="true" style={{ marginTop: 6 }}>
              Medio de pago
            </h2>
            <div className="choice-list">
              <label className="choice">
                <input
                  type="radio"
                  name="medio"
                  checked={effMethod === 'transfer'}
                  onChange={() => setMethod('transfer')}
                />
                <span>
                  <strong>Transferencia</strong>
                  <small>
                    Al confirmar te mostramos el alias y el CBU (
                    {settings.transferencia.banco}).
                  </small>
                </span>
              </label>
              <label
                className="choice"
                style={cashAllowed ? undefined : { opacity: 0.5 }}
              >
                <input
                  type="radio"
                  name="medio"
                  disabled={!cashAllowed}
                  checked={effMethod === 'cash'}
                  onChange={() => setMethod('cash')}
                />
                <span>
                  <strong>Efectivo en el local</strong>
                  <small>
                    {cashAllowed
                      ? 'Pagás cuando pasás a retirar.'
                      : 'Solo para retiro en el local.'}
                  </small>
                </span>
              </label>
            </div>
          </fieldset>

          <section className="panel">
            <label className="field">
              <span className="label">
                ¿Algo más que tengamos que saber? (opcional)
              </span>
              <textarea
                id="notas"
                className="textarea"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: lo necesito para el sábado, es para regalo…"
              />
            </label>
          </section>
        </div>

        <aside className="panel summary" aria-label="Resumen del pedido">
          <h2>Tu pedido</h2>
          {items.map((i) => (
            <div
              key={i.key}
              className="sum-row"
              style={{ alignItems: 'flex-start' }}
            >
              <span>
                {i.quantity} × {i.name}
                {i.variantLabel && (
                  <span className="li-sub" style={{ display: 'block' }}>
                    {i.variantLabel}
                  </span>
                )}
                <span className="li-sub" style={{ display: 'block' }}>
                  {itemStatus(i)}
                </span>
              </span>
              <span className="num" style={{ whiteSpace: 'nowrap' }}>
                {i.unitPrice === null
                  ? 'A cotizar'
                  : ars(i.unitPrice * i.quantity)}
              </span>
            </div>
          ))}
          <div
            className="sum-row big"
            style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}
          >
            <span>Total</span>
            <span className="num">{ars(total)}</span>
          </div>
          {quote && (
            <div className="notice n-info">
              Los productos a cotizar se suman cuando te pasemos el precio.
            </div>
          )}
          <div className="sum-row">
            <span>
              {effMethod === 'cash' ? 'Pagás al retirar' : 'Transferís ahora'}
            </span>
            <strong className="num">{ars(deposit)}</strong>
          </div>
          {error && (
            <div className="notice n-danger" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block desktop-only"
            disabled={sending}
          >
            {sending ? 'Guardando…' : 'Confirmar pedido'}
          </button>
          <p className="hint">
            Después te abrimos WhatsApp con el pedido escrito para que nos lo
            mandes.
          </p>
        </aside>

        <div className="mobile-bar">
          {error && (
            <div className="notice n-danger" role="alert">
              {error}
            </div>
          )}
          <div className="sum-row big">
            <span>
              {effMethod === 'cash' ? 'Pagás al retirar' : 'Transferís ahora'}
            </span>
            <span className="num">{ars(deposit)}</span>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={sending}
          >
            {sending ? 'Guardando…' : 'Confirmar pedido'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/domain-constants'
import { useCart } from './CartContext'
import { fmt, shippingCost } from './pricing'

type ShipMethod = 'domicilio' | 'retiro'

// The design's payment picker has no "other" option — keep parity with it.
const CHECKOUT_PAYMENT_METHODS = PAYMENT_METHOD.filter((m): m is Exclude<PaymentMethod, 'other'> => m !== 'other')

export default function CheckoutPage() {
  const navigate = useNavigate()
  const cart = useCart()

  const [contact, setContact] = useState({ name: '', phone: '', email: '' })
  const [shipMethod, setShipMethod] = useState<ShipMethod>('domicilio')
  const [address, setAddress] = useState({ calle: '', ciudad: 'Corrientes', cp: '' })
  const [payMethod, setPayMethod] = useState<PaymentMethod>('mercadopago')
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  const shipping = shippingCost(shipMethod, cart.subtotal)
  const total = cart.subtotal + shipping

  const placeOrder = () => {
    if (cart.lines.length === 0) return
    setOrderNumber('G3D-' + String(Date.now()).slice(-6))
    cart.clear()
  }

  if (orderNumber) {
    return (
      <div className="sf-section" style={{ maxWidth: '40rem' }}>
        <div className="sf-checkout__done">
          <div className="sf-checkout__check">✓</div>
          <h1 className="sf-checkout__title">¡Pedido confirmado!</h1>
          <p className="sf-muted" style={{ marginBottom: '0.5rem' }}>
            Número de pedido <strong>{orderNumber}</strong>
          </p>
          <p className="sf-muted" style={{ marginBottom: '1.75rem' }}>
            Nos vamos a contactar para coordinar los detalles.
          </p>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/')}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-section" style={{ maxWidth: '40rem' }}>
      <h1 className="sf-checkout__title">Finalizar compra</h1>

      <div className="sf-checkout__section">
        <div className="sf-checkout__heading">Datos de contacto</div>
        <div className="sf-checkout__row" style={{ marginBottom: '0.75rem' }}>
          <div className="sf-field" style={{ marginTop: 0 }}>
            <input
              className="sf-input"
              type="text"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              placeholder="Nombre y apellido"
            />
          </div>
          <div className="sf-field" style={{ marginTop: 0 }}>
            <input
              className="sf-input"
              type="tel"
              inputMode="tel"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              placeholder="Teléfono"
            />
          </div>
        </div>
        <div className="sf-field" style={{ marginTop: 0 }}>
          <input
            className="sf-input"
            type="email"
            value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
            placeholder="Email"
          />
        </div>
      </div>

      <div className="sf-checkout__section">
        <div className="sf-checkout__heading">Método de envío</div>
        <div className="sf-ship-options">
          {(['domicilio', 'retiro'] as ShipMethod[]).map((m) => (
            <label key={m} className="sf-ship-option">
              <input
                type="radio"
                name="ship-method"
                checked={shipMethod === m}
                onChange={() => setShipMethod(m)}
              />
              {m === 'domicilio' ? 'Envío a domicilio' : 'Retiro en Corrientes'}
            </label>
          ))}
        </div>
        {shipMethod === 'domicilio' && (
          <div className="sf-address-grid">
            <input
              className="sf-input"
              type="text"
              value={address.calle}
              onChange={(e) => setAddress({ ...address, calle: e.target.value })}
              placeholder="Calle y número"
            />
            <input
              className="sf-input"
              type="text"
              value={address.ciudad}
              onChange={(e) => setAddress({ ...address, ciudad: e.target.value })}
              placeholder="Ciudad"
            />
            <input
              className="sf-input"
              type="text"
              value={address.cp}
              onChange={(e) => setAddress({ ...address, cp: e.target.value })}
              placeholder="CP"
            />
          </div>
        )}
      </div>

      <div className="sf-checkout__section">
        <div className="sf-checkout__heading">Método de pago</div>
        <div className="sf-pay-options">
          {CHECKOUT_PAYMENT_METHODS.map((pm) => (
            <span
              key={pm}
              className={`sf-tag sf-pay-option ${payMethod === pm ? 'sf-tag--accent' : 'sf-tag--outline'}`}
              onClick={() => setPayMethod(pm)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setPayMethod(pm)
                }
              }}
            >
              {PAYMENT_METHOD_LABELS[pm]}
            </span>
          ))}
        </div>
      </div>

      <div className="sf-card" style={{ marginBottom: '1.5rem' }}>
        <div className="sf-summary-row">
          <span>Subtotal</span>
          <span>{fmt(cart.subtotal)}</span>
        </div>
        <div className="sf-summary-row">
          <span>Envío</span>
          <span>{fmt(shipping)}</span>
        </div>
        <hr className="sf-hr" style={{ margin: '0.5rem 0' }} />
        <div className="sf-summary-row sf-summary-row--total">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        style={{ fontSize: '1rem', padding: '0.875rem' }}
        disabled={cart.lines.length === 0}
        onClick={placeOrder}
      >
        Confirmar pedido
      </button>
    </div>
  )
}

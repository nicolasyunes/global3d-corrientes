import { useNavigate } from 'react-router-dom'
import { useCart } from './CartContext'
import { fmt, lineDiscountRate, lineTotal } from './pricing'

export default function CartPage() {
  const navigate = useNavigate()
  const cart = useCart()

  return (
    <div className="sf-section" style={{ maxWidth: '48rem' }}>
      <h1 className="sf-product__title">Tu carrito</h1>

      {cart.lines.length === 0 ? (
        <div className="sf-cart-empty">
          <p className="sf-muted" style={{ marginBottom: '1.25rem' }}>
            Tu carrito está vacío.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/categoria/todas')}>
            Ver catálogo
          </button>
        </div>
      ) : (
        <div className="sf-cart-body">
          <div>
            {cart.lines.map((l) => {
              const opts = [l.color, l.engraving ? `Texto: ${l.engraving}` : null].filter(Boolean).join(' · ')
              const discount = lineDiscountRate(l)
              return (
                <div key={l.id} className="sf-cart-line">
                  <div className="sf-cart-line__image sf-ph">Foto</div>
                  <div>
                    <div className="sf-cart-line__name">{l.name}</div>
                    <div className="sf-cart-line__meta sf-muted">{opts || '—'}</div>
                    {discount > 0 && (
                      <div className="sf-cart-line__discount">Descuento por cantidad (10%)</div>
                    )}
                    <div className="sf-cart-line__controls">
                      <div className="sf-qty__control">
                        <button type="button" className="sf-qty__btn" onClick={() => cart.dec(l.id)}>
                          −
                        </button>
                        <span className="sf-qty__value">{l.qty}</span>
                        <button type="button" className="sf-qty__btn" onClick={() => cart.inc(l.id)}>
                          +
                        </button>
                      </div>
                      <button type="button" className="sf-cart-line__remove" onClick={() => cart.remove(l.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <div className="sf-cart-line__total">{fmt(lineTotal(l))}</div>
                </div>
              )
            })}
            <div style={{ paddingTop: '1rem' }}>
              <button
                type="button"
                className="sf-cart-line__remove"
                style={{ color: 'var(--color-accent-700)' }}
                onClick={() => navigate('/categoria/todas')}
              >
                Seguir comprando
              </button>
            </div>
          </div>
          <div className="sf-card">
            <div className="sf-summary-row">
              <span>Subtotal</span>
              <span style={{ fontWeight: 800 }}>{fmt(cart.subtotal)}</span>
            </div>
            <div className="sf-muted" style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              El envío se calcula en el siguiente paso.
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => navigate('/checkout')}
            >
              Continuar compra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

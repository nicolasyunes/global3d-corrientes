import { Link } from 'react-router-dom'
import { Img, QtyStepper } from '../components/bits'
import { CorreoShipping } from '../components/CorreoShipping'
import { IconTrash } from '../components/Icons'
import {
  cart,
  cartHasQuote,
  cartTotal,
  useCart,
  type CartItem,
} from '../lib/cart'
import { useShop } from '../lib/data'
import { ars, businessDays } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

export function itemStatus(i: CartItem): string {
  if (i.unitPrice === null) return 'A cotizar'
  if (i.productId && i.stock >= i.quantity && !i.personalizationText)
    return 'Listo para retirar'
  return `A pedido · ${businessDays(i.leadDays)}`
}

export function Cart() {
  usePageTitle('Carrito')
  const items = useCart()
  const { settings } = useShop()
  const total = cartTotal(items)
  const quote = cartHasQuote(items)
  const deposit = Math.ceil((total * settings.sena.porcentaje) / 100)

  if (items.length === 0)
    return (
      <div
        className="container empty"
        style={{ minHeight: '50vh', alignContent: 'center' }}
      >
        <h1 style={{ fontSize: '2rem' }}>Tu carrito está vacío</h1>
        <p className="muted">
          Mirá lo que tenemos listo para llevar o pedinos algo a medida.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link to="/catalogo" className="btn btn-primary">
            Ver catálogo
          </Link>
          <Link to="/a-medida" className="btn btn-ghost">
            Pedido a medida
          </Link>
        </div>
      </div>
    )

  return (
    <div className="container">
      <div className="page-title">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)' }}>Tu carrito</h1>
      </div>
      <div className="split">
        <div className="panel" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {items.map((i) => (
            <div key={i.key} className="line-item">
              <Link
                to={`/p/${i.familySlug}`}
                className="media"
                aria-label={i.name}
              >
                <Img src={i.image} alt="" label="3D" size="thumb" />
              </Link>
              <div>
                <div className="li-top">
                  <Link
                    to={`/p/${i.familySlug}`}
                    className="li-name"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {i.name}
                  </Link>
                  <span className="price num">
                    {i.unitPrice === null
                      ? 'A cotizar'
                      : ars(i.unitPrice * i.quantity)}
                  </span>
                </div>
                {i.variantLabel && (
                  <div className="li-sub">{i.variantLabel}</div>
                )}
                {i.personalizationText && (
                  <div className="li-sub">{i.personalizationText}</div>
                )}
                <div className="li-sub" style={{ fontWeight: 700 }}>
                  {itemStatus(i)}
                  {i.unitPrice !== null && ` · ${ars(i.unitPrice)} c/u`}
                </div>
                <div className="li-actions">
                  <QtyStepper
                    value={i.quantity}
                    min={i.minQty}
                    onChange={(n) => cart.setQuantity(i.key, n)}
                    label={`Cantidad de ${i.name}`}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Quitar ${i.name}`}
                    onClick={() => cart.remove(i.key)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="panel summary" aria-label="Resumen">
          <h2>Resumen</h2>
          <div className="sum-row">
            <span>Productos</span>
            <span className="num">{ars(total)}</span>
          </div>
          {quote && (
            <div className="notice n-info">
              Hay productos a cotizar: te pasamos el precio por WhatsApp.
            </div>
          )}
          <div className="sum-row">
            <span>Seña del {settings.sena.porcentaje}% para empezar</span>
            <span className="num">{ars(deposit)}</span>
          </div>
          <div className="sum-row big">
            <span>Total</span>
            <span className="num">{ars(total)}</span>
          </div>
          <Link
            to="/checkout"
            className="btn btn-primary btn-block desktop-only"
          >
            Continuar
          </Link>
          <Link to="/catalogo" className="btn btn-ghost btn-block">
            Seguir comprando
          </Link>
          <CorreoShipping
            items={items}
            mode="preview"
            heading={
              <>
                <h3>Calculá el envío</h3>
                <p className="hint">
                  Por Correo Argentino o Andreani, a sucursal o a domicilio.
                  Retirar en el local es gratis.
                </p>
              </>
            }
          />
        </aside>
      </div>
      <div className="mobile-bar">
        <div className="sum-row big">
          <span>Total</span>
          <span className="num">{ars(total)}</span>
        </div>
        <Link to="/checkout" className="btn btn-primary btn-block">
          Continuar
        </Link>
      </div>
    </div>
  )
}

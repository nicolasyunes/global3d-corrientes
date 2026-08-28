import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { colorBg, colorName, findCategory, findProduct } from './data/products'
import { cashPrice, fmt, installmentPrice, leadTimeText, stockCount } from './pricing'
import { useCart } from './CartContext'
import { useToast } from './ToastContext'
import CustomOrderCTA from './CustomOrderCTA'

const SHOW_INSTALLMENTS = true

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const toast = useToast()
  const product = id ? findProduct(id) : undefined

  const [selColor, setSelColor] = useState<string | null>(product?.colors ? colorName(product.colors[0]) : null)
  const [engraving, setEngraving] = useState('')
  const [qty, setQty] = useState(1)

  if (!product) return <Navigate to="/" replace />

  const category = findCategory(product.cat)
  const leadTime = product.personalizable ? leadTimeText(product) : null

  const addToCart = () => {
    cart.add(product, selColor, engraving, qty)
    toast.show('Agregado al carrito')
  }
  const buyNow = () => {
    cart.add(product, selColor, engraving, qty)
    navigate('/checkout')
  }

  return (
    <div className="sf-section">
      <div className="sf-breadcrumb">
        <button type="button" className="sf-breadcrumb__link" onClick={() => navigate('/')}>
          Inicio
        </button>
        {' / '}
        {category && (
          <>
            <button type="button" className="sf-breadcrumb__link" onClick={() => navigate(`/categoria/${category.slug}`)}>
              {category.name}
            </button>
            {' / '}
          </>
        )}
        <span className="sf-breadcrumb__current">{product.name}</span>
      </div>

      <div className="sf-product">
        <div>
          <div className="sf-product__gallery-main sf-ph">Foto principal del producto</div>
          <div className="sf-product__thumbs">
            <div className="sf-product__thumb sf-ph">Foto 2</div>
            <div className="sf-product__thumb sf-ph">Foto 3</div>
            <div className="sf-product__thumb sf-ph">Foto 4</div>
          </div>
        </div>

        <div>
          <div className="sf-product__tags">
            <span className={`sf-tag ${product.stock === 'low' ? 'sf-tag--accent' : 'sf-tag--neutral'}`}>
              {product.stock === 'low' ? `¡Últimas ${stockCount(product)} unidades!` : 'En stock'}
            </span>
            {product.personalizable && <span className="sf-tag sf-tag--outline">Personalizable</span>}
            {!product.personalizable && product.customOnRequest && (
              <span className="sf-tag sf-tag--soft">Personalizable a pedido</span>
            )}
          </div>
          <h1 className="sf-product__title">{product.name}</h1>
          <div className="sf-product__price">
            {fmt(product.price)}
            {product.unit ? ` / ${product.unit}` : ''}
          </div>
          <div className="sf-product__cash sf-muted">{fmt(cashPrice(product.price))} con efectivo</div>
          {SHOW_INSTALLMENTS && (
            <div className="sf-product__installments">3 cuotas sin interés de {fmt(installmentPrice(product.price))}</div>
          )}
          {leadTime && <div className="sf-product__leadtime sf-muted">Listo en {leadTime}</div>}
          <p className="sf-product__desc sf-muted">{product.desc}</p>

          {product.colors && (
            <div className="sf-product__section">
              <div className="sf-product__section-title">Color</div>
              <div className="sf-swatch-list">
                {product.colors.map((c) => {
                  const name = colorName(c)
                  const active = selColor === name
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`sf-swatch-opt ${active ? 'sf-swatch-opt--active' : ''}`}
                      onClick={() => setSelColor(name)}
                    >
                      <span className="swatch" style={{ background: colorBg(c) }} />
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {product.personalizable && (
            <div className="sf-field" style={{ marginBottom: '1.5rem' }}>
              <label className="sf-field__label" htmlFor="engraving">
                Personalización (texto o nombre)
              </label>
              <input
                id="engraving"
                className="sf-input"
                type="text"
                value={engraving}
                onChange={(e) => setEngraving(e.target.value)}
                placeholder="Ej: Juan"
              />
            </div>
          )}

          <div className="sf-qty">
            <div className="sf-qty__label">Cantidad</div>
            <div className="sf-qty__control">
              <button type="button" className="sf-qty__btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="sf-qty__value">{qty}</span>
              <button type="button" className="sf-qty__btn" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="sf-product__actions">
            <button type="button" className="btn btn--secondary" onClick={addToCart}>
              Agregar al carrito
            </button>
            <button type="button" className="btn btn--primary" onClick={buyNow}>
              Comprar ahora
            </button>
          </div>

          {product.customOnRequest && <CustomOrderCTA variant="card" />}

          <hr className="sf-hr" />
          <div>
            <div className="sf-product__section-title">Detalles</div>
            <div className="sf-specs">
              {product.specs.map((sp) => (
                <div key={sp} className="sf-specs__item">
                  {sp}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

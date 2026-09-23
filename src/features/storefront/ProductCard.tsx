import { useNavigate } from 'react-router-dom'
import type { Product } from './data/products'
import { colorBg, colorName } from './data/products'
import { cashPrice, fmt, installmentPrice, leadTimeText, stockCount } from './pricing'
import { useCart } from './CartContext'
import { useToast } from './ToastContext'

const SHOW_INSTALLMENTS = true
const MAX_SWATCHES = 5

export default function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const cart = useCart()
  const toast = useToast()

  const leadTime = product.personalizable ? leadTimeText(product) : null
  const swatches = (product.colors || []).slice(0, MAX_SWATCHES)
  const moreColors = (product.colors || []).length - MAX_SWATCHES

  const open = () => navigate(`/producto/${product.id}`)

  return (
    <div
      className="product-card"
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <div className="product-card__image sf-ph">Foto del producto</div>
      <div className="product-card__body">
        <div className="product-card__tags">
          <span className={`sf-tag ${product.stock === 'low' ? 'sf-tag--accent' : 'sf-tag--neutral'}`}>
            {product.stock === 'low' ? `¡Últimas ${stockCount(product)} unidades!` : 'En stock'}
          </span>
          {product.personalizable && <span className="sf-tag sf-tag--outline">Personalizable</span>}
          {!product.personalizable && product.customOnRequest && (
            <span className="sf-tag sf-tag--soft">Personalizable a pedido</span>
          )}
        </div>
        <div className="product-card__name">{product.name}</div>
        <div className="product-card__price">
          {fmt(product.price)}
          {product.unit ? ` / ${product.unit}` : ''}
        </div>
        <div className="product-card__cash sf-muted">{fmt(cashPrice(product.price))} con efectivo</div>
        {SHOW_INSTALLMENTS && (
          <div className="product-card__installments">
            3 cuotas sin interés de {fmt(installmentPrice(product.price))}
          </div>
        )}
        {leadTime && <div className="product-card__leadtime sf-muted">Listo en {leadTime}</div>}
        {swatches.length > 0 && (
          <div className="product-card__swatches">
            {swatches.map((c) => (
              <span key={colorName(c)} className="swatch" style={{ background: colorBg(c) }} />
            ))}
            {moreColors > 0 && <span className="sf-muted" style={{ fontSize: '0.7rem' }}>+{moreColors}</span>}
          </div>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={(e) => {
            e.stopPropagation()
            cart.add(product, product.colors ? colorName(product.colors[0]) : null, '', 1)
            toast.show('Agregado al carrito')
          }}
        >
          Agregar al carrito
        </button>
      </div>
    </div>
  )
}

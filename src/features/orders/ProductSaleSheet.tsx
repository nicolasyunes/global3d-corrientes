import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/lib/domain-constants'
import type { ProductRow } from '@/features/products/products.api'
import { listSellableProducts, type ProductSaleRow } from './productSales.api'
import { useProductSaleDraft } from './useProductSaleDraft'
import {
  FREE_TEXT_PRODUCT,
  parsePositiveInt,
  remainingStockAfterSale,
  selectedCatalogProduct,
  suggestedAmount,
} from './productSaleValidation'

interface ProductSaleSheetProps {
  open: boolean
  onClose: () => void
  onCreated: (sale: ProductSaleRow) => void
}

function productOptionLabel(product: ProductRow): string {
  return `${product.name} · ${product.stock_quantity} en stock`
}

// "Agregar venta" opens this: a sheet for logging a direct sale (something
// already in stock, sold and paid on the spot — no order / production flow).
// A catalog product decrements its stock via the DB trigger; "Otro" captures
// a one-off by name. Save closes the sheet so the new row + undo toast are
// visible in the list behind it. Same dialog shape as QuickOrderSheet.
export default function ProductSaleSheet({
  open,
  onClose,
  onCreated,
}: ProductSaleSheetProps) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const productSelectRef = useRef<HTMLSelectElement>(null)

  const { draft, errors, submitting, submitError, setField, reset, submit } =
    useProductSaleDraft(products)

  // Refetch each time the sheet opens so stock counts in the picker are
  // current; skip entirely while closed.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setProductsLoading(true)
    listSellableProducts()
      .then((rows) => {
        if (!cancelled) setProducts(rows)
      })
      .catch(() => {
        // Non-fatal: the picker offers only the free-text option; the form
        // still validates and saves.
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const isFreeText = draft.productId === FREE_TEXT_PRODUCT
  const catalogProduct = selectedCatalogProduct(draft, products)
  const quantity = parsePositiveInt(draft.quantity)
  const remaining = remainingStockAfterSale(catalogProduct, quantity)

  function handleProductChange(value: string) {
    setField('productId', value)
    if (
      value !== '' &&
      value !== FREE_TEXT_PRODUCT &&
      draft.amount.trim() === ''
    ) {
      const product = products.find((p) => p.id === value)
      const suggested = suggestedAmount(product, quantity ?? 1)
      if (suggested !== null) setField('amount', String(suggested))
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await submit()
    if (created) {
      onCreated(created)
      onClose()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') handleClose()
  }

  return (
    <div
      className="sale-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Agregar venta"
      onKeyDown={handleKeyDown}
    >
      <div
        className="sale-sheet__backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <form
        className="sale-sheet__panel"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <header className="sale-sheet__header">
          <h2 className="sale-sheet__title">Agregar venta</h2>
          <button
            type="button"
            className="sale-sheet__close"
            aria-label="Cerrar"
            onClick={handleClose}
          >
            ×
          </button>
        </header>

        <div className="field">
          <label className="field__label" htmlFor="sale-product">
            Producto
          </label>
          <select
            id="sale-product"
            ref={productSelectRef}
            className="field__input"
            aria-invalid={Boolean(errors.productId)}
            value={draft.productId}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            <option value="">
              {productsLoading ? 'Cargando productos…' : 'Elegí un producto'}
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {productOptionLabel(product)}
              </option>
            ))}
            <option value={FREE_TEXT_PRODUCT}>
              Otro / no está en el catálogo
            </option>
          </select>
          {errors.productId && (
            <p className="field__error">{errors.productId}</p>
          )}
        </div>

        {isFreeText && (
          <div className="field">
            <label className="field__label" htmlFor="sale-product-name">
              Nombre del producto
            </label>
            <input
              id="sale-product-name"
              className="field__input"
              type="text"
              aria-invalid={Boolean(errors.productName)}
              value={draft.productName}
              onChange={(e) => setField('productName', e.target.value)}
            />
            {errors.productName && (
              <p className="field__error">{errors.productName}</p>
            )}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="sale-quantity">
            Cantidad
          </label>
          <input
            id="sale-quantity"
            className="field__input"
            type="text"
            inputMode="numeric"
            aria-invalid={Boolean(errors.quantity)}
            value={draft.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
          />
          {errors.quantity && (
            <p className="field__error">{errors.quantity}</p>
          )}
          {!errors.quantity && remaining !== null && (
            <p className="field__hint">
              Quedan {remaining} en stock después de esta venta.
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="sale-customer">
            Cliente (opcional)
          </label>
          <input
            id="sale-customer"
            className="field__input"
            type="text"
            value={draft.customerName}
            onChange={(e) => setField('customerName', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="sale-amount">
            Total
          </label>
          <input
            id="sale-amount"
            className="field__input"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={Boolean(errors.amount)}
            value={draft.amount}
            onChange={(e) => setField('amount', e.target.value)}
          />
          {errors.amount && <p className="field__error">{errors.amount}</p>}
        </div>

        <fieldset className="field fieldset">
          <legend className="field__label">Medio de pago</legend>
          <div className="chips">
            {PAYMENT_METHOD.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip${draft.method === option ? ' chip--selected' : ''}`}
                aria-pressed={draft.method === option}
                onClick={() =>
                  setField('method', draft.method === option ? '' : option)
                }
              >
                {PAYMENT_METHOD_LABELS[option as PaymentMethod]}
              </button>
            ))}
          </div>
        </fieldset>

        {submitError && (
          <p className="form-banner form-banner--error" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar venta'}
        </button>
      </form>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney } from '@/features/orders/format'
import { CASH_DISCOUNT } from '@/features/storefront/pricing'
import {
  createProduct,
  getProduct,
  listCategories,
  listProductImages,
  updateProduct,
  type CategoryRow,
  type ProductImageRow,
  type ProductRow,
} from './products.api'
import { SUBCATEGORY_OPTIONS, slugify } from './catalog-taxonomy'
import {
  emptyProductDraft,
  parseNonNegativeDecimal,
  parseNonNegativeInt,
  validateProduct,
  type FieldErrors,
  type ProductDraft,
} from './validation'
import ProductImageGallery from './ProductImageGallery'
import '@/features/orders/orders.css'
import './products.css'

function draftFromProduct(product: ProductRow): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    basePrice: product.base_price === null ? '' : String(product.base_price),
    compareAtPrice:
      product.compare_at_price === null ? '' : String(product.compare_at_price),
    stockQuantity: String(product.stock_quantity),
    sku: product.sku ?? '',
    weightGrams:
      product.weight_grams === null ? '' : String(product.weight_grams),
    slug: product.slug ?? '',
    categoryId: product.category_id ?? '',
    subcategory: product.subcategory ?? '',
    personalizable: product.personalizable,
    customOnRequest: product.custom_on_request,
    active: product.active,
  }
}

// Editor de una página para alta (/admin/productos/nuevo) y edición
// (/admin/productos/:id). Columna principal: identidad, medios, precios,
// inventario. Columna lateral: estado y organización. El alta guarda y redirige
// a /:id para poder cargar imágenes (la galería necesita el id del producto).
export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [images, setImages] = useState<ProductImageRow[]>([])
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows)
      })
      .catch(() => {
        /* la organización queda sin opciones; no bloquea el form */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getProduct(id), listProductImages(id)])
      .then(([product, imgs]) => {
        if (cancelled) return
        if (!product) {
          setLoadError('Producto no encontrado.')
          return
        }
        setDraft(draftFromProduct(product))
        setImages(imgs)
        setSlugTouched(true)
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el producto.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  function setField<K extends keyof ProductDraft>(
    field: K,
    value: ProductDraft[K],
  ) {
    setDraft((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'name' && !slugTouched && !isEdit) {
        next.slug = slugify(String(value))
      }
      if (field === 'categoryId') {
        next.subcategory = ''
      }
      return next
    })
    if (field === 'slug') setSlugTouched(true)
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next: FieldErrors = { ...prev }
      delete next[field]
      return next
    })
  }

  const selectedCategory = categories.find((c) => c.id === draft.categoryId)
  const subcategoryOptions = selectedCategory
    ? (SUBCATEGORY_OPTIONS[selectedCategory.slug] ?? [])
    : []

  const basePriceNum = parseNonNegativeDecimal(draft.basePrice)
  const compareNum = parseNonNegativeDecimal(draft.compareAtPrice)
  const showDiscount =
    basePriceNum !== null && compareNum !== null && compareNum > basePriceNum
  const discountPct = showDiscount
    ? Math.round((1 - basePriceNum / compareNum) * 100)
    : 0
  const cashPrice =
    basePriceNum !== null ? basePriceNum * (1 - CASH_DISCOUNT) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateProduct(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    try {
      const patch = {
        name: draft.name.trim(),
        slug: draft.slug.trim() || slugify(draft.name) || null,
        description: draft.description.trim() || null,
        base_price: parseNonNegativeDecimal(draft.basePrice),
        compare_at_price: parseNonNegativeDecimal(draft.compareAtPrice),
        stock_quantity: parseNonNegativeInt(draft.stockQuantity) ?? 0,
        sku: draft.sku.trim() || null,
        weight_grams: parseNonNegativeInt(draft.weightGrams),
        category_id: draft.categoryId || null,
        subcategory: draft.subcategory || null,
        personalizable: draft.personalizable,
        custom_on_request: draft.customOnRequest,
        active: draft.active,
      }

      const saved =
        isEdit && id
          ? await updateProduct(id, patch)
          : await createProduct(patch)

      navigate(isEdit ? '/admin/productos' : `/admin/productos/${saved.id}`)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar el producto.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="order-form">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="order-form">
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {loadError}
        </p>
        <Link to="/admin/productos" className="link-btn back-link">
          Volver a productos
        </Link>
      </main>
    )
  }

  return (
    <main className="order-form">
      <form onSubmit={handleSubmit} noValidate>
        <div className="order-form__content">
          <header className="order-form__header">
            <Link to="/admin/productos" className="link-btn back-link">
              Volver a productos
            </Link>
            <h1 className="order-form__title">
              {isEdit ? 'Editar producto' : 'Nuevo producto'}
            </h1>
            <p className="order-form__subtitle">
              Identidad, medios, precios, inventario y organización.
            </p>
          </header>

          <div className="product-editor">
            <div className="product-editor__main">
              <section className="form-section">
                <div className="field">
                  <label className="field__label" htmlFor="product-name">
                    Nombre
                  </label>
                  <input
                    id="product-name"
                    className="field__input"
                    type="text"
                    value={draft.name}
                    onChange={(e) => setField('name', e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="field__error">{errors.name}</p>}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="product-slug">
                    Slug
                  </label>
                  <input
                    id="product-slug"
                    className="field__input"
                    type="text"
                    value={draft.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    aria-invalid={Boolean(errors.slug)}
                  />
                  <p className="product-editor__hint">
                    URL del producto en la tienda.
                  </p>
                  {errors.slug && <p className="field__error">{errors.slug}</p>}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="product-description">
                    Descripción
                  </label>
                  <textarea
                    id="product-description"
                    className="field__input field__input--textarea"
                    value={draft.description}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </div>
              </section>

              <section className="form-section">
                <h2 className="form-section__heading">Medios</h2>
                {isEdit && id ? (
                  <ProductImageGallery
                    productId={id}
                    images={images}
                    onChange={setImages}
                  />
                ) : (
                  <p className="product-editor__hint">
                    Guardá el producto para poder cargar imágenes.
                  </p>
                )}
              </section>

              <section className="form-section">
                <h2 className="form-section__heading">Precios</h2>
                <div className="field">
                  <label className="field__label" htmlFor="product-price">
                    Precio base
                  </label>
                  <input
                    id="product-price"
                    className="field__input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.basePrice}
                    onChange={(e) => setField('basePrice', e.target.value)}
                    aria-invalid={Boolean(errors.basePrice)}
                  />
                  {errors.basePrice && (
                    <p className="field__error">{errors.basePrice}</p>
                  )}
                </div>

                <div className="field">
                  <label
                    className="field__label"
                    htmlFor="product-compare-price"
                  >
                    Precio comparativo
                  </label>
                  <input
                    id="product-compare-price"
                    className="field__input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.compareAtPrice}
                    onChange={(e) => setField('compareAtPrice', e.target.value)}
                    aria-invalid={Boolean(errors.compareAtPrice)}
                  />
                  {errors.compareAtPrice && (
                    <p className="field__error">{errors.compareAtPrice}</p>
                  )}
                </div>

                {(showDiscount || cashPrice !== null) && (
                  <p className="product-editor__hint">
                    {showDiscount && <>−{discountPct}% · </>}
                    {cashPrice !== null && (
                      <>contado {formatMoney(cashPrice)}</>
                    )}
                  </p>
                )}
              </section>

              <section className="form-section">
                <h2 className="form-section__heading">Inventario</h2>
                <div className="field">
                  <label className="field__label" htmlFor="product-sku">
                    SKU
                  </label>
                  <input
                    id="product-sku"
                    className="field__input"
                    type="text"
                    value={draft.sku}
                    onChange={(e) => setField('sku', e.target.value)}
                    aria-invalid={Boolean(errors.sku)}
                  />
                  {errors.sku && <p className="field__error">{errors.sku}</p>}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="product-stock">
                    Stock
                  </label>
                  <input
                    id="product-stock"
                    className="field__input"
                    type="text"
                    inputMode="numeric"
                    value={draft.stockQuantity}
                    onChange={(e) => setField('stockQuantity', e.target.value)}
                    aria-invalid={Boolean(errors.stockQuantity)}
                  />
                  {errors.stockQuantity && (
                    <p className="field__error">{errors.stockQuantity}</p>
                  )}
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="product-weight">
                    Peso (g)
                  </label>
                  <input
                    id="product-weight"
                    className="field__input"
                    type="text"
                    inputMode="numeric"
                    value={draft.weightGrams}
                    onChange={(e) => setField('weightGrams', e.target.value)}
                    aria-invalid={Boolean(errors.weightGrams)}
                  />
                  {errors.weightGrams && (
                    <p className="field__error">{errors.weightGrams}</p>
                  )}
                </div>
              </section>
            </div>

            <aside className="product-editor__aside">
              <section className="form-section">
                <h2 className="form-section__heading">Estado</h2>
                <label className="product-form__active">
                  <input
                    type="radio"
                    name="product-active"
                    checked={draft.active}
                    onChange={() => setField('active', true)}
                  />
                  Activo
                </label>
                <label className="product-form__active">
                  <input
                    type="radio"
                    name="product-active"
                    checked={!draft.active}
                    onChange={() => setField('active', false)}
                  />
                  Inactivo
                </label>
              </section>

              <section className="form-section">
                <h2 className="form-section__heading">Organización</h2>
                <div className="field">
                  <label className="field__label" htmlFor="product-category">
                    Categoría
                  </label>
                  <select
                    id="product-category"
                    className="field__input"
                    value={draft.categoryId}
                    onChange={(e) => setField('categoryId', e.target.value)}
                  >
                    <option value="">— sin categoría —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="product-subcategory">
                    Subcategoría
                  </label>
                  <select
                    id="product-subcategory"
                    className="field__input"
                    value={draft.subcategory}
                    onChange={(e) => setField('subcategory', e.target.value)}
                    disabled={subcategoryOptions.length === 0}
                  >
                    <option value="">— sin asignar —</option>
                    {subcategoryOptions.map((o) => (
                      <option key={o.slug} value={o.slug}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="product-form__active">
                  <input
                    type="checkbox"
                    checked={draft.personalizable}
                    onChange={(e) =>
                      setField('personalizable', e.target.checked)
                    }
                  />
                  Personalizable (hecho a medida)
                </label>
                <label className="product-form__active">
                  <input
                    type="checkbox"
                    checked={draft.customOnRequest}
                    onChange={(e) =>
                      setField('customOnRequest', e.target.checked)
                    }
                  />
                  Personalizable a pedido
                </label>
              </section>
            </aside>
          </div>

          {submitError && (
            <p className="form-banner form-banner--error" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="sticky-cta">
          <div className="sticky-cta__inner">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar producto'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}

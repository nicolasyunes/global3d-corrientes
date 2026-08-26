import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createProduct,
  getProduct,
  updateProduct,
  uploadProductImage,
  type ProductRow,
} from './products.api'
import {
  emptyProductDraft,
  parseNonNegativeDecimal,
  parseNonNegativeInt,
  validateProduct,
  type FieldErrors,
  type ProductDraft,
} from './validation'
import '@/features/orders/orders.css'
import './products.css'

function draftFromProduct(product: ProductRow): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    basePrice: product.base_price === null ? '' : String(product.base_price),
    stockQuantity: String(product.stock_quantity),
    active: product.active,
  }
}

// Single form for both create (/admin/productos/nuevo) and edit
// (/admin/productos/:id) — products are simple master data (no status
// workflow like orders), so one component covers both instead of splitting
// into a Detail + Form pair. The image file is staged locally and only
// uploaded on submit, after the product row exists (its id names the storage
// path), then the row is patched with the resulting public URL.
export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getProduct(id)
      .then((product) => {
        if (cancelled) return
        if (!product) {
          setLoadError('Producto no encontrado.')
          return
        }
        setDraft(draftFromProduct(product))
        setImageUrl(product.image_url)
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el producto.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Revoke the local object URL when it's replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  function setField<K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next: FieldErrors = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleImageChange(file: File | null) {
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

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
        description: draft.description.trim() || null,
        base_price: parseNonNegativeDecimal(draft.basePrice),
        stock_quantity: parseNonNegativeInt(draft.stockQuantity) ?? 0,
        active: draft.active,
      }

      const saved = isEdit && id ? await updateProduct(id, patch) : await createProduct(patch)

      if (imageFile) {
        const publicUrl = await uploadProductImage(saved.id, imageFile)
        await updateProduct(saved.id, { image_url: publicUrl })
      }

      navigate('/admin/productos')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar el producto.')
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
        <p className="form-banner form-banner--error orders-list__status" role="alert">
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
            <h1 className="order-form__title">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
            <p className="order-form__subtitle">
              Nombre, descripción, precio, stock e imagen de portada.
            </p>
          </header>

          <section className="form-section">
            <div className="field">
              <label className="field__label" htmlFor="product-image">
                Imagen
              </label>
              <div className="product-form__image-row">
                {(imagePreview || imageUrl) && (
                  <img
                    className="product-form__image-preview"
                    src={imagePreview ?? imageUrl ?? undefined}
                    alt=""
                  />
                )}
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

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
              {errors.basePrice && <p className="field__error">{errors.basePrice}</p>}
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
              {errors.stockQuantity && <p className="field__error">{errors.stockQuantity}</p>}
            </div>

            <label className="product-form__active">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setField('active', e.target.checked)}
              />
              Activo (visible para gestión)
            </label>
          </section>

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

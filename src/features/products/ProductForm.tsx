import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '@/components/Icon'
import { parseMoney } from '@/features/orders/orderDraft'
import { colorSwatch } from '@/features/production/pieces'
import {
  createProduct,
  getProduct,
  listProductImages,
  listProductParts,
  saveProductParts,
  updateProduct,
  type ProductImageRow,
  type ProductRow,
} from './products.api'
import { cleanParts, newPartDraft, partQty, type PartDraft } from './parts'
import {
  emptyProductDraft,
  parseNonNegativeInt,
  validateProduct,
  type FieldErrors,
  type ProductDraft,
} from './validation'
import ProductImageGallery from './ProductImageGallery'
import './products.css'

const COMMON_COLORS = [
  'negro',
  'blanco',
  'rojo',
  'azul',
  'celeste',
  'amarillo',
  'dorado',
  'plateado',
  'gris',
  'verde',
  'rosa',
  'naranja',
  'violeta',
  'marrón',
  'piel',
]

function draftFromProduct(product: ProductRow): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    basePrice: product.base_price === null ? '' : String(product.base_price),
    stockQuantity: String(product.stock_quantity),
    active: product.active,
  }
}

function PartsEditor({
  parts,
  onChange,
}: {
  parts: PartDraft[]
  onChange: (next: PartDraft[]) => void
}) {
  function patch(key: string, change: Partial<PartDraft>) {
    onChange(parts.map((p) => (p.key === key ? { ...p, ...change } : p)))
  }
  function move(index: number, delta: number) {
    const next = [...parts]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    onChange(next)
  }

  return (
    <div className="parts-editor">
      {parts.length > 0 && (
        <ol className="parts-editor__list">
          {parts.map((part, index) => {
            const hex = colorSwatch(part.color)
            return (
              <li key={part.key} className="parts-editor__row">
                <span
                  className={`swatch${hex ? '' : ' swatch--unknown'}`}
                  style={hex ? { background: hex } : undefined}
                  aria-hidden="true"
                />
                <input
                  className="input"
                  placeholder="Pieza (ej: cabeza)"
                  aria-label={`Pieza ${index + 1}`}
                  value={part.label}
                  onChange={(e) => patch(part.key, { label: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Color"
                  list="part-colors"
                  aria-label={`Color de la pieza ${index + 1}`}
                  value={part.color}
                  onChange={(e) => patch(part.key, { color: e.target.value })}
                />
                <label className="parts-editor__qty">
                  <span aria-hidden="true">×</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label={`Cantidad por unidad de la pieza ${index + 1}`}
                    value={part.quantity}
                    onChange={(e) =>
                      patch(part.key, { quantity: e.target.value })
                    }
                  />
                </label>
                <div className="parts-editor__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Subir pieza ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Bajar pieza ${index + 1}`}
                    disabled={index === parts.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Quitar pieza ${index + 1}`}
                    onClick={() =>
                      onChange(parts.filter((p) => p.key !== part.key))
                    }
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => onChange([...parts, newPartDraft()])}
      >
        <Icon name="plus" size={16} />
        Agregar pieza
      </button>
      <datalist id="part-colors">
        {COMMON_COLORS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  )
}

// Ficha de un producto guardado (/admin/productos/nuevo y /:id). Lo central es
// la lista de piezas: al cargar un pedido con este producto, esas piezas (con
// sus colores, × la cantidad pedida) aparecen solas en el checklist.
export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft())
  const [parts, setParts] = useState<PartDraft[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [images, setImages] = useState<ProductImageRow[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setParts([newPartDraft()])
      return
    }
    let cancelled = false
    Promise.all([getProduct(id), listProductImages(id), listProductParts(id)])
      .then(([product, imgs, rows]) => {
        if (cancelled) return
        if (!product) {
          setLoadError('Producto no encontrado.')
          return
        }
        setDraft(draftFromProduct(product))
        setImages(imgs)
        setParts(
          rows.map((r) =>
            newPartDraft({
              label: r.label,
              color: r.color ?? '',
              quantity: r.quantity,
            }),
          ),
        )
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
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next: FieldErrors = { ...prev }
      delete next[field]
      return next
    })
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
        base_price: parseMoney(draft.basePrice),
        stock_quantity: parseNonNegativeInt(draft.stockQuantity) ?? 0,
        active: draft.active,
      }
      const saved =
        isEdit && id
          ? await updateProduct(id, patch)
          : await createProduct(patch)
      await saveProductParts(saved.id, cleanParts(parts))
      navigate(isEdit ? '/admin/productos' : `/admin/productos/${saved.id}`)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar el producto.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="muted">Cargando…</p>

  if (loadError) {
    return (
      <>
        <p className="banner banner--error" role="alert">
          {loadError}
        </p>
        <Link to="/admin/productos" className="back">
          <Icon name="back" size={16} /> Volver a productos
        </Link>
      </>
    )
  }

  const filled = cleanParts(parts)
  const totalPerUnit = filled.reduce((sum, p) => sum + partQty(p.quantity), 0)

  return (
    <form className="pform" onSubmit={handleSubmit} noValidate>
      <Link to="/admin/productos" className="back">
        <Icon name="back" size={16} /> Productos
      </Link>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">
            {isEdit ? 'Producto guardado' : 'Nuevo producto'}
          </p>
          <h1 className="page-title">
            {draft.name.trim() || (isEdit ? 'Producto' : 'Nuevo producto')}
          </h1>
        </div>
        <div className="page-head__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
      </div>

      {submitError && (
        <p className="banner banner--error" role="alert">
          {submitError}
        </p>
      )}

      <div className="pform__grid">
        <section className="card pform__parts">
          <div className="card__head">
            <h2 className="card__title">Piezas para imprimir</h2>
            <span className="spacer" />
            {filled.length > 0 && (
              <span className="badge num">
                {filled.length} pieza{filled.length === 1 ? '' : 's'} ·{' '}
                {totalPerUnit} por unidad
              </span>
            )}
          </div>
          <p className="muted pform__hint">
            Cuando cargues un pedido con este producto, estas piezas aparecen
            solas en el checklist, multiplicadas por la cantidad pedida. Los
            colores se pueden cambiar en cada pedido.
          </p>
          <PartsEditor parts={parts} onChange={setParts} />
        </section>

        <div className="pform__side">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Datos</h2>
            </div>
            <label className="field-label" htmlFor="product-name">
              Nombre
            </label>
            <input
              id="product-name"
              className="input"
              placeholder="Ej: Vaso milkshake Spiderman"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="pform__err">{errors.name}</p>}
            <p className="muted pform__hint">
              Es el nombre que se escribe al cargar el pedido.
            </p>

            <div className="pform__row">
              <div>
                <label className="field-label" htmlFor="product-price">
                  Precio de lista ($)
                </label>
                <input
                  id="product-price"
                  className="input"
                  inputMode="decimal"
                  value={draft.basePrice}
                  onChange={(e) => setField('basePrice', e.target.value)}
                  aria-invalid={Boolean(errors.basePrice)}
                />
                {errors.basePrice && (
                  <p className="pform__err">{errors.basePrice}</p>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="product-stock">
                  Stock armado
                </label>
                <input
                  id="product-stock"
                  className="input"
                  inputMode="numeric"
                  value={draft.stockQuantity}
                  onChange={(e) => setField('stockQuantity', e.target.value)}
                  aria-invalid={Boolean(errors.stockQuantity)}
                />
                {errors.stockQuantity && (
                  <p className="pform__err">{errors.stockQuantity}</p>
                )}
              </div>
            </div>

            <label className="field-label" htmlFor="product-description">
              Notas para el taller
            </label>
            <textarea
              id="product-description"
              className="input pform__textarea"
              rows={3}
              placeholder="Archivo, tiempos, relleno, cómo se arma…"
              value={draft.description}
              onChange={(e) => setField('description', e.target.value)}
            />

            <label className="pform__check">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setField('active', e.target.checked)}
              />
              Aparece al cargar pedidos
            </label>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Fotos</h2>
            </div>
            {isEdit && id ? (
              <ProductImageGallery
                productId={id}
                images={images}
                onChange={setImages}
              />
            ) : (
              <p className="muted pform__hint">
                Guardá el producto para poder cargar fotos.
              </p>
            )}
          </section>
        </div>
      </div>
    </form>
  )
}

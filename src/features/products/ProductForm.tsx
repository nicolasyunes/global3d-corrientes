import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  uploadProductImage,
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
import ProductImageGallery, { PhotoGrid } from './ProductImageGallery'
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
  // New products: photos wait here and upload right after the product exists.
  const [pendingPhotos, setPendingPhotos] = useState<
    { key: string; file: File; url: string }[]
  >([])
  const pendingRef = useRef(pendingPhotos)
  pendingRef.current = pendingPhotos
  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  )

  function addPendingPhotos(files: File[]) {
    setPendingPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({
        key: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  function movePendingPhoto(index: number, delta: number) {
    setPendingPhotos((prev) => {
      const next = [...prev]
      ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
      return next
    })
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url)
      return prev.filter((_, i) => i !== index)
    })
  }

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
      if (!isEdit && pendingPhotos.length) {
        try {
          for (const [position, photo] of pendingPhotos.entries())
            await uploadProductImage(saved.id, photo.file, position)
        } catch {
          // The product exists already: open it so the photos can be retried
          // there instead of saving (and duplicating) it again.
          navigate(`/admin/productos/${saved.id}`)
          return
        }
      }
      navigate('/admin/productos')
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
  const cover = isEdit ? images[0]?.url : pendingPhotos[0]?.url

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
      </div>

      {submitError && (
        <p className="banner banner--error" role="alert">
          {submitError}
        </p>
      )}

      <div className="pform__stack">
        <section className="card pform__hero">
          <div className="pform__cover" aria-hidden="true">
            {cover ? <img src={cover} alt="" /> : <Icon name="box" size={34} />}
          </div>
          <div className="pform__fields">
            <label className="field-label" htmlFor="product-name">
              Nombre del producto
            </label>
            <input
              id="product-name"
              className="input pform__name"
              placeholder="Ej: Vaso milkshake Spiderman"
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="pform__err">{errors.name}</p>
            ) : (
              <p className="muted pform__hint">
                Es el nombre que se escribe al cargar el pedido.
              </p>
            )}

            <div className="pform__row">
              <div>
                <label className="field-label" htmlFor="product-price">
                  Precio de lista ($)
                </label>
                <input
                  id="product-price"
                  className="input num"
                  inputMode="decimal"
                  placeholder="0"
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
                  className="input num"
                  inputMode="numeric"
                  value={draft.stockQuantity}
                  onChange={(e) => setField('stockQuantity', e.target.value)}
                  aria-invalid={Boolean(errors.stockQuantity)}
                />
                {errors.stockQuantity && (
                  <p className="pform__err">{errors.stockQuantity}</p>
                )}
              </div>
              <label className="pform__switch">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setField('active', e.target.checked)}
                />
                <span className="pform__switch-track" aria-hidden="true" />
                <span>
                  <strong>{draft.active ? 'Activo' : 'Pausado'}</strong>
                  <small>
                    {draft.active
                      ? 'Aparece al cargar pedidos'
                      : 'No aparece en pedidos'}
                  </small>
                </span>
              </label>
            </div>

            <label className="field-label" htmlFor="product-description">
              Notas para el taller
            </label>
            <textarea
              id="product-description"
              className="input pform__textarea"
              rows={2}
              placeholder="Archivo, tiempos, relleno, cómo se arma…"
              value={draft.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
        </section>

        <section className="card">
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

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Fotos</h2>
            <span className="muted pform__optional">opcional</span>
          </div>
          {isEdit && id ? (
            <ProductImageGallery
              productId={id}
              images={images}
              onChange={setImages}
            />
          ) : (
            <PhotoGrid
              tiles={pendingPhotos.map((p) => ({ key: p.key, url: p.url }))}
              onAdd={addPendingPhotos}
              onMove={movePendingPhoto}
              onRemove={removePendingPhoto}
            />
          )}
        </section>
      </div>

      <div className="pform__footer">
        <Link to="/admin/productos" className="btn btn--ghost">
          Cancelar
        </Link>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting
            ? pendingPhotos.length
              ? 'Guardando y subiendo fotos…'
              : 'Guardando…'
            : 'Guardar producto'}
        </button>
      </div>
    </form>
  )
}

import { useState, type ChangeEvent } from 'react'
import {
  deleteProductImage,
  reorderProductImages,
  uploadProductImage,
  type ProductImageRow,
} from './products.api'

// Galería de medios del editor de producto. Cada archivo subido crea una fila
// en product_images; la primera (position 0) es la portada y se espeja en
// products.image_url del lado de la API. El reordenamiento reescribe position.
export default function ProductImageGallery({
  productId,
  images,
  onChange,
}: {
  productId: string
  images: ProductImageRow[]
  onChange: (next: ProductImageRow[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      let next = images
      for (const file of files) {
        const row = await uploadProductImage(productId, file, next.length)
        next = [...next, row]
        onChange(next)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo subir la imagen.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function persistOrder(next: ProductImageRow[]) {
    onChange(next)
    setBusy(true)
    setError(null)
    try {
      await reorderProductImages(
        productId,
        next.map((i) => i.id),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reordenar.')
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    void persistOrder(next)
  }

  async function remove(image: ProductImageRow) {
    setBusy(true)
    setError(null)
    try {
      await deleteProductImage(image)
      onChange(images.filter((i) => i.id !== image.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo quitar la imagen.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="product-gallery">
      <label className="field__label" htmlFor="product-gallery-input">
        Imágenes
      </label>
      <input
        id="product-gallery-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        disabled={busy}
      />

      {error && <p className="field__error">{error}</p>}

      {images.length > 0 && (
        <ul className="product-gallery__grid">
          {images.map((image, index) => (
            <li key={image.id} className="product-gallery__item">
              <img src={image.url} alt={image.alt ?? ''} />
              {index === 0 && (
                <span className="product-gallery__badge">Portada</span>
              )}
              <div className="product-gallery__controls">
                <button
                  type="button"
                  aria-label={`Mover ${index + 1} a la izquierda`}
                  onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${index + 1} a la derecha`}
                  onClick={() => move(index, 1)}
                  disabled={busy || index === images.length - 1}
                >
                  ▶
                </button>
                <button
                  type="button"
                  aria-label={`Quitar imagen ${index + 1}`}
                  onClick={() => void remove(image)}
                  disabled={busy}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

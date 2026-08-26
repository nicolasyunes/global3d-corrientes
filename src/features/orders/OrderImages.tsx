import { useEffect, useRef, useState } from 'react'
import {
  deleteOrderImage,
  listOrderImages,
  publicImageUrl,
  uploadOrderImage,
  validateImageFile,
  type OrderImageRow,
} from './orderImages.api'

interface OrderImagesProps {
  orderId: string
}

// Per-order image gallery: reference photos, generated mockups, logos to
// create — one flat gallery with an optional note per image (see
// openspec/changes/2026-08-26-order-images-and-link/design.md). Mounted on
// the order detail page, next to ProductionChecklist, since it needs an
// existing order_id.
export default function OrderImages({ orderId }: OrderImagesProps) {
  const [images, setImages] = useState<OrderImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listOrderImages(orderId)
      .then((rows) => {
        if (!cancelled) setImages(rows)
      })
      .catch(() => {
        // Non-fatal: the rest of the order detail page still works without
        // its image gallery.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  useEffect(() => {
    if (viewerIndex !== null && viewerRef.current) {
      viewerRef.current.focus()
    }
  }, [viewerIndex])

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadOrderImage(orderId, file, note.trim() || null)
      setImages((prev) => [...prev, uploaded])
      setNote('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo subir la imagen.',
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(image: OrderImageRow) {
    try {
      await deleteOrderImage(image)
      setImages((prev) => prev.filter((row) => row.id !== image.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar la imagen.',
      )
    }
  }

  function closeViewer() {
    setViewerIndex(null)
  }

  function showNext() {
    setViewerIndex((prev) =>
      prev === null ? null : (prev + 1) % images.length,
    )
  }

  function showPrev() {
    setViewerIndex((prev) =>
      prev === null ? null : (prev - 1 + images.length) % images.length,
    )
  }

  function handleViewerKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') closeViewer()
    if (event.key === 'ArrowRight') showNext()
    if (event.key === 'ArrowLeft') showPrev()
  }

  if (loading) return null

  return (
    <section className="order-images">
      <h2 className="order-images__heading">Imágenes</h2>

      <div className="order-images__upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="order-images__file-input"
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading}
          aria-label="Elegir imagen"
        />
        <input
          type="text"
          className="field__input order-images__note-input"
          placeholder="Nota (opcional) — ej: foto que mandó el cliente"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={uploading}
        />
      </div>

      {error && (
        <p className="form-banner form-banner--error" role="alert">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <ul className="order-images__grid">
          {images.map((image, index) => (
            <li key={image.id} className="order-images__thumb-wrap">
              <button
                type="button"
                className="order-images__thumb"
                onClick={() => setViewerIndex(index)}
              >
                <img
                  src={publicImageUrl(image.storage_path)}
                  alt={image.note ?? 'Imagen del pedido'}
                />
              </button>
              <button
                type="button"
                className="order-images__delete"
                aria-label="Eliminar imagen"
                onClick={() => void handleDelete(image)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewerIndex !== null && images[viewerIndex] && (
        <div
          ref={viewerRef}
          className="order-images__viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imagen"
          tabIndex={-1}
          onKeyDown={handleViewerKeyDown}
          onClick={closeViewer}
        >
          <div
            className="order-images__viewer-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={publicImageUrl(images[viewerIndex].storage_path)}
              alt={images[viewerIndex].note ?? 'Imagen del pedido'}
            />
            {images[viewerIndex].note && (
              <p className="order-images__viewer-note">
                {images[viewerIndex].note}
              </p>
            )}
            <div className="order-images__viewer-controls">
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={showPrev}
                disabled={images.length < 2}
              >
                ←
              </button>
              <button type="button" aria-label="Cerrar" onClick={closeViewer}>
                Cerrar
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={showNext}
                disabled={images.length < 2}
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

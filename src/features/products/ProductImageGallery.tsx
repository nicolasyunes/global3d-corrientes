import { useState } from 'react'
import Icon from '@/components/Icon'
import {
  deleteProductImage,
  reorderProductImages,
  uploadProductImage,
  type ProductImageRow,
} from './products.api'

export interface PhotoTile {
  key: string
  url: string
}

// Shared photo grid: the first photo is the cover; arrows reorder.
export function PhotoGrid({
  tiles,
  busy,
  onMove,
  onRemove,
  onAdd,
}: {
  tiles: PhotoTile[]
  busy?: boolean
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
  onAdd: (files: File[]) => void
}) {
  return (
    <div className="photos">
      {tiles.length > 0 && (
        <ul className="photos__grid">
          {tiles.map((tile, index) => (
            <li key={tile.key} className="photo">
              <img src={tile.url} alt="" />
              {index === 0 && <span className="photo__cover">Portada</span>}
              <div className="photo__tools">
                <button
                  type="button"
                  aria-label={`Mover foto ${index + 1} a la izquierda`}
                  disabled={busy || index === 0}
                  onClick={() => onMove(index, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`Mover foto ${index + 1} a la derecha`}
                  disabled={busy || index === tiles.length - 1}
                  onClick={() => onMove(index, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`Quitar foto ${index + 1}`}
                  disabled={busy}
                  onClick={() => onRemove(index)}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className={`photos__add${busy ? ' is-busy' : ''}`}>
        <Icon name="plus" size={20} />
        <span>
          <strong>{busy ? 'Subiendo…' : 'Agregar fotos'}</strong>
          <small>JPG o PNG · la primera es la portada</small>
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden"
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).filter((f) =>
              f.type.startsWith('image/'),
            )
            e.target.value = ''
            if (files.length) onAdd(files)
          }}
        />
      </label>
    </div>
  )
}

// Photos of a saved product: every change goes straight to storage.
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

  async function run(fn: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const add = (files: File[]) =>
    run(async () => {
      let next = images
      for (const file of files) {
        const row = await uploadProductImage(productId, file, next.length)
        next = [...next, row]
        onChange(next)
      }
    }, 'No se pudo subir la foto.')

  const move = (index: number, delta: number) => {
    const next = [...images]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    onChange(next)
    void run(
      () =>
        reorderProductImages(
          productId,
          next.map((i) => i.id),
        ),
      'No se pudo reordenar.',
    )
  }

  const remove = (index: number) =>
    run(async () => {
      await deleteProductImage(images[index])
      onChange(images.filter((_, i) => i !== index))
    }, 'No se pudo quitar la foto.')

  return (
    <>
      <PhotoGrid
        tiles={images.map((i) => ({ key: i.id, url: i.url }))}
        busy={busy}
        onAdd={(files) => void add(files)}
        onMove={move}
        onRemove={(index) => void remove(index)}
      />
      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

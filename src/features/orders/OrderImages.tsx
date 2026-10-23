import { useEffect, useState } from 'react'
import { AddAttachment, AttachmentGrid } from './attachments'
import {
  deleteOrderImage,
  isPdf,
  listOrderImages,
  publicImageUrl,
  uploadOrderImage,
  type OrderImageRow,
} from './orderImages.api'

// Files of an existing order (detail page): uploads as soon as they're chosen.
export default function OrderImages({ orderId }: { orderId: string }) {
  const [images, setImages] = useState<OrderImageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listOrderImages(orderId)
      .then((rows) => !cancelled && setImages(rows))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [orderId])

  async function upload(files: File[], note: string) {
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const row = await uploadOrderImage(orderId, file, note)
        setImages((prev) => [...prev, row])
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo subir el archivo.',
      )
    } finally {
      setUploading(false)
    }
  }

  async function remove(image: OrderImageRow) {
    if (!window.confirm(`¿Borrar ${image.note ?? 'este archivo'}?`)) return
    try {
      await deleteOrderImage(image)
      setImages((prev) => prev.filter((row) => row.id !== image.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo borrar el archivo.',
      )
    }
  }

  if (loading) return null

  return (
    <div>
      <AddAttachment
        busy={uploading}
        onError={setError}
        onFiles={(files, note) => void upload(files, note)}
      />
      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      <AttachmentGrid
        items={images.map((image) => ({
          key: image.id,
          url: publicImageUrl(image.storage_path),
          pdf: isPdf(image.storage_path),
          label: image.note,
          onRemove: () => void remove(image),
        }))}
      />
    </div>
  )
}

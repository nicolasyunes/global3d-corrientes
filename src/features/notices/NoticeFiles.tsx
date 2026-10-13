import { useEffect, useRef, useState } from 'react'
import {
  AddAttachment,
  AttachmentGrid,
} from '@/features/orders/attachments'
import { isPdf } from '@/features/orders/orderImages.api'
import {
  deleteNoticeImage,
  listNoticeImages,
  noticeImageUrl,
  uploadNoticeImage,
  type NoticeImageRow,
} from './noticeImages.api'

interface PendingFile {
  id: string
  file: File
  note: string
  url: string
}

// Files of a task. Chosen files wait in `pending` and go up with `flush`
// once the task exists; the ones already stored are listed and removable.
export function useNoticeFiles(noticeId: string | null) {
  const [saved, setSaved] = useState<NoticeImageRow[]>([])
  const [pending, setPending] = useState<PendingFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  useEffect(() => {
    if (!noticeId) return
    let cancelled = false
    listNoticeImages(noticeId)
      .then((rows) => !cancelled && setSaved(rows))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [noticeId])

  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  )

  function add(files: File[], note: string) {
    setPending((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        note,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  function dropPending(id: string) {
    setPending((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  async function dropSaved(image: NoticeImageRow) {
    if (!window.confirm(`¿Borrar ${image.note ?? 'este archivo'}?`)) return
    try {
      await deleteNoticeImage(image)
      setSaved((prev) => prev.filter((row) => row.id !== image.id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo borrar el archivo.',
      )
    }
  }

  // Uploads what is waiting for `id`; returns the names that failed (they
  // stay pending so a retry picks them up).
  async function flush(id: string): Promise<string[]> {
    const failed: string[] = []
    let position =
      saved.length === 0 ? 0 : Math.max(...saved.map((r) => r.position)) + 1
    for (const item of pendingRef.current) {
      try {
        const row = await uploadNoticeImage(id, item.file, item.note, position)
        position += 1
        setSaved((prev) => [...prev, row])
        dropPending(item.id)
      } catch {
        failed.push(item.file.name)
      }
    }
    return failed
  }

  return { saved, pending, error, setError, add, dropPending, dropSaved, flush }
}

export default function NoticeFiles({
  files,
}: {
  files: ReturnType<typeof useNoticeFiles>
}) {
  const { saved, pending, error, setError, add, dropPending, dropSaved } = files
  return (
    <div>
      <AddAttachment onFiles={add} onError={setError} />
      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      <AttachmentGrid
        items={[
          ...saved.map((image) => ({
            key: image.id,
            url: noticeImageUrl(image.storage_path),
            pdf: isPdf(image.storage_path),
            label: image.note,
            onRemove: () => void dropSaved(image),
          })),
          ...pending.map((p) => ({
            key: p.id,
            url: p.url,
            pdf: p.file.type === 'application/pdf',
            label: p.note,
            pending: true,
            onRemove: () => dropPending(p.id),
          })),
        ]}
      />
    </div>
  )
}

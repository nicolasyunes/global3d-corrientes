import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { groupQueueByColor } from './pieces'
import {
  incrementPiece,
  listOpenPieces,
  type QueuePiece,
} from './production.api'

export function useQueue(onToast?: (text: string) => void) {
  const { current } = useOperator()
  const [pieces, setPieces] = useState<QueuePiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setPieces(await listOpenPieces())
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la cola.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const plus = useCallback(
    async (piece: QueuePiece) => {
      setBusyId(piece.id)
      try {
        const updated = await incrementPiece(piece.id, 1, current?.id ?? null)
        setPieces((prev) =>
          updated.status === 'done'
            ? prev.filter((p) => p.id !== piece.id)
            : prev.map((p) => (p.id === piece.id ? { ...p, ...updated } : p)),
        )
        onToast?.(
          updated.status === 'done'
            ? `${piece.label}: ¡lista!`
            : `+1 ${piece.label} · ${updated.quantity_done}/${updated.quantity_total}`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo registrar.')
      } finally {
        setBusyId(null)
      }
    },
    [current, onToast],
  )

  // "Sin apuro" pieces are kept apart from the urgent queue.
  const urgent = useMemo(() => pieces.filter((p) => !p.flexible), [pieces])
  const relaxed = useMemo(() => pieces.filter((p) => p.flexible), [pieces])
  const groups = useMemo(() => groupQueueByColor(urgent), [urgent])
  return {
    pieces: urgent,
    relaxed,
    groups,
    loading,
    error,
    busyId,
    plus,
    reload,
  }
}

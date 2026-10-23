import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ToastAction } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import { groupQueueByColor } from './pieces'
import {
  incrementPiece,
  listOpenPieces,
  type QueuePiece,
} from './production.api'

export function useQueue(
  onToast?: (text: string, action?: ToastAction) => void,
) {
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

  // Adds `delta` finished units in one call (a held "+" or "Completar"),
  // with an undo that takes them back.
  const add = useCallback(
    async (piece: QueuePiece, delta: number) => {
      if (delta <= 0) return
      setBusyId(piece.id)
      const operator = current?.id ?? null
      try {
        const updated = await incrementPiece(piece.id, delta, operator)
        setPieces((prev) =>
          updated.status === 'done'
            ? prev.filter((p) => p.id !== piece.id)
            : prev.map((p) => (p.id === piece.id ? { ...p, ...updated } : p)),
        )
        const text =
          updated.status === 'done'
            ? `${piece.label}: ¡lista!`
            : `+${delta} ${piece.label} · ${updated.quantity_done}/${updated.quantity_total}`
        onToast?.(text, {
          label: 'Deshacer',
          onClick: () => {
            void incrementPiece(piece.id, -delta, operator)
              .then(() => reload())
              .catch((err) =>
                setError(
                  err instanceof Error ? err.message : 'No se pudo deshacer.',
                ),
              )
          },
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo registrar.')
      } finally {
        setBusyId(null)
      }
    },
    [current, onToast, reload],
  )

  const plus = useCallback((piece: QueuePiece) => add(piece, 1), [add])

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
    add,
    reload,
  }
}

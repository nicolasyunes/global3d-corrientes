import { useCallback, useEffect, useState } from 'react'
import type { Notice } from './notices'
import { listNotices } from './notices.api'

export interface NoticesState {
  rows: Notice[] | null
  setRows: React.Dispatch<React.SetStateAction<Notice[] | null>>
  error: string | null
  setError: (message: string | null) => void
  reload: () => Promise<void>
}

// The notices of Hoy, loaded once so the strip on top and the card below
// show the same list and change together.
export function useNotices(): NoticesState {
  const [rows, setRows] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setRows(await listNotices())
      setError(null)
    } catch (err) {
      setRows([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los avisos.',
      )
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, setRows, error, setError, reload }
}

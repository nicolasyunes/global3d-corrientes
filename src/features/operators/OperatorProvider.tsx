import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  listOperators,
  verifyOperatorPin,
  type Operator,
} from './operators.api'
import { OperatorContext, type OperatorContextValue } from './operator-context'

const STORAGE_KEY = 'g3d.operator'
const IDLE_LOCK_MS = 30 * 60 * 1000

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode / blocked storage: the operator just re-picks next load.
  }
}

// "Who is at the workshop": the whole team shares one Supabase session, so the
// person acting is picked here (with a PIN) and stamped on every write.
export function OperatorProvider({ children }: { children: ReactNode }) {
  const [operators, setOperators] = useState<Operator[]>([])
  const [currentId, setCurrentId] = useState<string | null>(readStored)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setOperators(await listOperators())
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las personas.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const lock = useCallback(() => {
    setCurrentId(null)
    writeStored(null)
  }, [])

  // Idle lock: after 30 min without interaction, ask for the PIN again (never
  // the workshop password).
  useEffect(() => {
    if (!currentId) return
    let timer = setTimeout(lock, IDLE_LOCK_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(lock, IDLE_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown'] as const
    events.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [currentId, lock])

  const select = useCallback(async (id: string, pin: string) => {
    const ok = await verifyOperatorPin(id, pin)
    if (ok) {
      setCurrentId(id)
      writeStored(id)
    }
    return ok
  }, [])

  const value = useMemo<OperatorContextValue>(() => {
    const current = operators.find((o) => o.id === currentId) ?? null
    return {
      operators,
      current,
      loading,
      error,
      isAdmin: current?.role === 'admin',
      select,
      lock,
      refresh,
      byId: (id) => (id ? operators.find((o) => o.id === id) : undefined),
    }
  }, [operators, currentId, loading, error, select, lock, refresh])

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  )
}

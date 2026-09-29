import { createContext, useContext } from 'react'
import type { Operator } from './operators.api'

export interface OperatorContextValue {
  operators: Operator[]
  current: Operator | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  select: (id: string, pin: string) => Promise<boolean>
  lock: () => void
  refresh: () => Promise<void>
  byId: (id: string | null | undefined) => Operator | undefined
}

export const OperatorContext = createContext<OperatorContextValue | null>(null)

export function useOperator(): OperatorContextValue {
  const ctx = useContext(OperatorContext)
  if (!ctx) throw new Error('useOperator must be used inside OperatorProvider')
  return ctx
}

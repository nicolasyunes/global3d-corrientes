import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

// Shared auth context, split from AuthProvider.tsx so the provider file only
// exports components (react-refresh/only-export-components). The provider
// owns the session state; useAuth.ts reads it.

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  role: string | null
  roleLoading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

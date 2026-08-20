import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './auth-context'

// Access the auth context set up by <AuthProvider />. Throws when used
// outside the provider so a misuse fails loud instead of returning nulls.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === undefined) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return value
}

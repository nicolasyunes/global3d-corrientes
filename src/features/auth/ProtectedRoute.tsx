import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

// Gate for protected admin routes. Renders a loading state while the session
// is unresolved (no premature redirect), renders children once a session
// exists, and redirects to /admin/login otherwise, carrying the intended
// destination in location.state.from so the login flow can route back.
//
// Mounted inside the lazy admin.route.tsx module (PR3) with the orders
// subtree as children — never wired at the top-level router, so auth code
// stays out of the public bundle.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="auth-status">
        Loading…
      </p>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

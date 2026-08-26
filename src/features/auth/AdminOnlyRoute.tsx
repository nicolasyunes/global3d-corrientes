import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'

// Stricter gate than ProtectedRoute: requires profiles.role = 'admin', not
// just a session. Mounted inside ProtectedRoute (so session is already
// resolved) around the product-management subtree — stock/pricing/image
// edits are admin-only, unlike orders/sales which any operator can work.
export function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { isAdmin, roleLoading } = useAuth()

  if (roleLoading) {
    return (
      <p role="status" className="auth-status">
        Cargando…
      </p>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/admin/orders" replace />
  }

  return <>{children}</>
}

import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import '../auth/auth.css'

// Shared shell for the protected admin area: the single Global3D wordmark
// header plus a sign-out control, with the routed page rendered in the
// outlet. Owns the wordmark so page components (e.g. OrdersList) never render
// their own. Sign-out clears the session via AuthProvider; ProtectedRoute then
// bounces the user back to /admin/login.
export default function AdminLayout() {
  const { signOut } = useAuth()

  return (
    <div className="admin-shell">
      <header className="admin-shell__header">
        <div className="admin-shell__header-inner">
          <p className="admin-shell__wordmark">
            Global<span className="admin-shell__wordmark-accent">3D</span>
          </p>
          <button
            type="button"
            className="admin-shell__signout"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

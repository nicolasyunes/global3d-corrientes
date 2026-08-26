import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import '../auth/auth.css'

// Shared shell for the protected admin area: the single Global3D wordmark
// header plus a sign-out control, with the routed page rendered in the
// outlet. Owns the wordmark so page components (e.g. OrdersList) never render
// their own. Sign-out clears the session via AuthProvider; ProtectedRoute then
// bounces the user back to /admin/login.
export default function AdminLayout() {
  const { signOut, isAdmin } = useAuth()

  return (
    <div className="admin-shell">
      <header className="admin-shell__header">
        <div className="admin-shell__header-inner">
          <p className="admin-shell__wordmark">
            Global<span className="admin-shell__wordmark-accent">3D</span>
          </p>
          <nav className="admin-shell__nav" aria-label="Secciones">
            <Link to="/admin/orders" className="admin-shell__nav-link">
              Pedidos
            </Link>
            <Link to="/admin/ventas" className="admin-shell__nav-link">
              Ventas
            </Link>
            {isAdmin && (
              <Link to="/admin/productos" className="admin-shell__nav-link">
                Productos
              </Link>
            )}
          </nav>
          <button
            type="button"
            className="admin-shell__signout"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

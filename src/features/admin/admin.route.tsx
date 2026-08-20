import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import LoginPage from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import OrderForm from '@/features/orders/OrderForm'
import OrdersList from '@/features/orders/OrdersList'
import OrderDetail from '@/features/orders/OrderDetail'
import AdminLayout from './AdminLayout'

// Admin boundary: everything here lives in the lazy /admin chunk, so auth
// libraries never enter the public bundle. AuthProvider is the session source
// of truth; /admin/login is the open sign-in surface; the orders subtree is
// gated by ProtectedRoute and rendered inside the AdminLayout shell. The old
// env-gated dev-session seam is retired — real magic-link auth replaces it.
export function Component() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          {/* The former placeholder landing now forwards to the orders queue. */}
          <Route path="*" element={<Navigate to="/admin/orders" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

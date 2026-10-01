import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import LoginPage from '@/features/auth/LoginPage'
import RecoveryRedirect from '@/features/auth/RecoveryRedirect'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { OperatorProvider } from '@/features/operators/OperatorProvider'
import OperatorGate from '@/features/operators/OperatorGate'
import { useOperator } from '@/features/operators/operator-context'
import PeoplePage from '@/features/operators/PeoplePage'
import OrdersList from '@/features/orders/OrdersList'
import OrderProduction from '@/features/orders/OrderProduction'
import DeliveredOrdersList from '@/features/orders/DeliveredOrdersList'
import ProductForm from '@/features/products/ProductForm'
import ProductsList from '@/features/products/ProductsList'
import TodayPage from '@/features/production/TodayPage'
import WeekPage from '@/features/production/WeekPage'
import WorkshopPage from '@/features/production/WorkshopPage'
import CalculatorPage from '@/features/calculator/CalculatorPage'
import NoticesPage from '@/features/notices/NoticesPage'
import IdeasPage from '@/features/ideas/IdeasPage'
import FilamentsPage from '@/features/filaments/FilamentsPage'
import AdminLayout from './AdminLayout'

function OperatorAdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useOperator()
  return isAdmin ? <>{children}</> : <Navigate to="/admin/hoy" replace />
}

// Two gates: the workshop Supabase session (ProtectedRoute → /admin/login),
// then who is working (OperatorGate → profile + PIN).
export function Component() {
  return (
    <AuthProvider>
      <RecoveryRedirect />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="nueva-clave" element={<ResetPasswordPage />} />
        <Route
          element={
            <ProtectedRoute>
              <OperatorProvider>
                <OperatorGate>
                  <AdminLayout />
                </OperatorGate>
              </OperatorProvider>
            </ProtectedRoute>
          }
        >
          <Route path="hoy" element={<TodayPage />} />
          <Route path="semana" element={<WeekPage />} />
          <Route path="taller" element={<WorkshopPage />} />
          <Route
            path="imprimir"
            element={<Navigate to="/admin/taller" replace />}
          />
          <Route path="avisos" element={<NoticesPage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="filamentos" element={<FilamentsPage />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/:id" element={<OrderProduction />} />
          <Route path="ventas-pedidos" element={<DeliveredOrdersList />} />
          <Route path="calculadora" element={<CalculatorPage />} />
          <Route
            path="productos"
            element={
              <OperatorAdminOnly>
                <ProductsList />
              </OperatorAdminOnly>
            }
          />
          <Route
            path="productos/nuevo"
            element={
              <OperatorAdminOnly>
                <ProductForm />
              </OperatorAdminOnly>
            }
          />
          <Route
            path="productos/:id"
            element={
              <OperatorAdminOnly>
                <ProductForm />
              </OperatorAdminOnly>
            }
          />
          <Route
            path="personas"
            element={
              <OperatorAdminOnly>
                <PeoplePage />
              </OperatorAdminOnly>
            }
          />
          <Route path="*" element={<Navigate to="/admin/hoy" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

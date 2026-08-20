import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import OrderForm from '@/features/orders/OrderForm'
import AdminPage from './AdminPage'
import { ensureDevOperatorSession } from './dev-session'

// Auth-guard seam: wrap the routes in a <ProtectedRoute /> here once
// authentication lands (magic-link + handle_new_user). Keeping the wrapper
// inside this lazy module guarantees auth libraries never enter the public
// bundle. The dev-session seam is invoked on mount so dev can exercise RLS
// without a login UI; it is a no-op in production.
export function Component() {
  useEffect(() => {
    void ensureDevOperatorSession()
  }, [])

  return (
    <Routes>
      <Route path="orders/new" element={<OrderForm />} />
      <Route path="*" element={<AdminPage />} />
    </Routes>
  )
}

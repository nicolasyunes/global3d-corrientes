import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Component as AdminRoutes } from './admin.route'

// Stub the auth wrappers (they call Supabase) and every page component so the
// test exercises only the routing table.
vi.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/features/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('@/features/auth/AdminOnlyRoute', () => ({
  AdminOnlyRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('@/features/auth/LoginPage', () => ({
  default: () => <div>LOGIN</div>,
}))
vi.mock('@/features/admin/AdminLayout', async () => {
  const rr = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { default: () => <rr.Outlet /> }
})
vi.mock('@/features/orders/OrderProduction', () => ({
  default: () => <div>PRODUCTION SCREEN</div>,
}))
vi.mock('@/features/orders/OrderEdit', () => ({
  default: () => <div>EDIT SCREEN</div>,
}))
vi.mock('@/features/orders/OrdersList', () => ({
  default: () => <div>LIST</div>,
}))
vi.mock('@/features/orders/OrderForm', () => ({
  default: () => <div>NEW FORM</div>,
}))
vi.mock('@/features/orders/DeliveredOrdersList', () => ({
  default: () => <div />,
}))
vi.mock('@/features/sales/SalesForm', () => ({ default: () => <div /> }))
vi.mock('@/features/sales/SalesList', () => ({ default: () => <div /> }))
vi.mock('@/features/insumos/InsumosList', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductForm', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductsList', () => ({ default: () => <div /> }))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('admin routing table', () => {
  it('mounts OrderProduction at /admin/orders/:id', () => {
    renderAt('/admin/orders/abc')
    expect(screen.getByText('PRODUCTION SCREEN')).toBeInTheDocument()
  })

  it('mounts OrderEdit at /admin/orders/:id/editar', () => {
    renderAt('/admin/orders/abc/editar')
    expect(screen.getByText('EDIT SCREEN')).toBeInTheDocument()
  })
})

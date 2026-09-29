import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Component as AdminRoutes } from './admin.route'

// Stub the auth wrappers (they call Supabase) and every page component so the
// test exercises only the routing table.
vi.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
  const rr =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { default: () => <rr.Outlet /> }
})
vi.mock('@/features/orders/OrderProduction', () => ({
  default: () => <div>PRODUCTION SCREEN</div>,
}))
vi.mock('@/features/orders/OrdersList', () => ({
  default: () => <div>LIST</div>,
}))
vi.mock('@/features/orders/DeliveredOrdersList', () => ({
  default: () => <div />,
}))
vi.mock('@/features/sales/SalesForm', () => ({ default: () => <div /> }))
vi.mock('@/features/sales/SalesList', () => ({ default: () => <div /> }))
vi.mock('@/features/insumos/InsumosList', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductForm', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductsList', () => ({ default: () => <div /> }))
vi.mock('@/features/operators/OperatorProvider', () => ({
  OperatorProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('@/features/operators/OperatorGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ isAdmin: false }),
}))
vi.mock('@/features/operators/PeoplePage', () => ({
  default: () => <div>PEOPLE</div>,
}))
vi.mock('@/features/production/TodayPage', () => ({
  default: () => <div>TODAY</div>,
}))
vi.mock('@/features/production/PrintQueuePage', () => ({
  default: () => <div>QUEUE</div>,
}))

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

  it('mounts the orders list', () => {
    renderAt('/admin/orders')
    expect(screen.getByText('LIST')).toBeInTheDocument()
  })

  it('lands on Hoy by default', () => {
    renderAt('/admin')
    expect(screen.getByText('TODAY')).toBeInTheDocument()
  })

  it('mounts the print queue', () => {
    renderAt('/admin/imprimir')
    expect(screen.getByText('QUEUE')).toBeInTheDocument()
  })

  it('keeps admin-only pages away from regular operators', () => {
    renderAt('/admin/personas')
    expect(screen.queryByText('PEOPLE')).not.toBeInTheDocument()
    expect(screen.getByText('TODAY')).toBeInTheDocument()
  })
})

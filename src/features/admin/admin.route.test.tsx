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
vi.mock('@/features/auth/RecoveryRedirect', () => ({ default: () => null }))
vi.mock('@/features/auth/ResetPasswordPage', () => ({
  default: () => <div>RESET</div>,
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
vi.mock('@/features/calculator/CalculatorPage', () => ({
  default: () => <div>CALC</div>,
}))
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
vi.mock('@/features/production/WorkshopPage', () => ({
  default: () => <div>WORKSHOP</div>,
}))
vi.mock('@/features/production/WeekPage', () => ({
  default: () => <div>WEEK</div>,
}))
vi.mock('@/features/resources/ResourcesPage', () => ({
  default: () => <div>RECURSOS</div>,
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

  it('mounts the workshop, and sends the old print queue there', () => {
    renderAt('/admin/taller')
    expect(screen.getByText('WORKSHOP')).toBeInTheDocument()
  })

  it('redirects the old print queue to the workshop', () => {
    renderAt('/admin/imprimir')
    expect(screen.getByText('WORKSHOP')).toBeInTheDocument()
  })

  it('mounts the week', () => {
    renderAt('/admin/semana')
    expect(screen.getByText('WEEK')).toBeInTheDocument()
  })

  it('mounts the calculator', () => {
    renderAt('/admin/calculadora')
    expect(screen.getByText('CALC')).toBeInTheDocument()
  })

  it('mounts the recursos page', () => {
    renderAt('/admin/recursos')
    expect(screen.getByText('RECURSOS')).toBeInTheDocument()
  })

  it('sends removed pages back to Hoy', () => {
    renderAt('/admin/insumos')
    expect(screen.getByText('TODAY')).toBeInTheDocument()
  })

  it('keeps admin-only pages away from regular operators', () => {
    renderAt('/admin/personas')
    expect(screen.queryByText('PEOPLE')).not.toBeInTheDocument()
    expect(screen.getByText('TODAY')).toBeInTheDocument()
  })
})

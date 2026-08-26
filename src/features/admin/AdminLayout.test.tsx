import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminLayout from './AdminLayout'

// The auth hook is mocked so the shell can be rendered standalone: the test
// asserts the wordmark header renders, the outlet renders the child page, and
// activating the sign-out control triggers signOut() (session clearing itself
// is covered by AuthProvider.test.tsx / ProtectedRoute.test.tsx).

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: useAuthMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({
    session: null,
    user: null,
    loading: false,
    signOut: vi.fn().mockResolvedValue(undefined),
  })
})

function renderAdminLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="orders" element={<div>Orders page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it('renders the wordmark header and the outlet content', () => {
    renderAdminLayout()

    expect(screen.getByText('Global')).toBeInTheDocument()
    expect(screen.getByText('3D')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Orders page')).toBeInTheDocument()
  })

  it('triggers sign out when the control is activated', () => {
    renderAdminLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(useAuthMock().signOut).toHaveBeenCalledTimes(1)
  })

  it('hides the Productos nav link for non-admin operators', () => {
    renderAdminLayout()
    expect(screen.queryByText('Productos')).not.toBeInTheDocument()
  })

  it('shows the Productos nav link for admins', () => {
    useAuthMock.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      isAdmin: true,
      signOut: vi.fn().mockResolvedValue(undefined),
    })
    renderAdminLayout()
    expect(screen.getByText('Productos')).toBeInTheDocument()
  })
})

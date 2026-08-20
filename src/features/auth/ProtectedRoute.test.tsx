import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { ProtectedRoute } from './ProtectedRoute'

// The supabase client is mocked so the tests exercise the provider + guard
// without credentials or a network connection.

const { getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: vi.fn(),
    },
  },
}))

const EMAIL = 'owner@global3d.local'

const user: User = {
  id: 'user-1',
  aud: 'authenticated',
  role: 'authenticated',
  email: EMAIL,
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}

const session: Session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 4_102_444_800,
  token_type: 'bearer',
  user,
}

function renderAtOrders() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <Routes>
        <Route
          path="/admin/orders"
          element={
            <AuthProvider>
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            </AuthProvider>
          }
        />
        <Route path="/admin/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  onAuthStateChangeMock.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  getSessionMock.mockResolvedValue({ data: { session: null } })
})

describe('ProtectedRoute', () => {
  it('redirects to /admin/login when there is no session', async () => {
    renderAtOrders()
    await act(async () => {})

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when a session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session } })
    renderAtOrders()
    await act(async () => {})

    expect(await screen.findByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('shows loading while the session is unresolved and does not redirect early', async () => {
    let resolveSession!: (value: unknown) => void
    getSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    renderAtOrders()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()

    // Resolve to keep the suite clean; the redirect must only happen now.
    act(() => resolveSession({ data: { session: null } }))
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})

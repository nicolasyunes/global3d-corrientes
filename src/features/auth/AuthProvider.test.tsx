import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

// The supabase client is mocked so the provider can be exercised with full
// control over getSession resolution and emitted auth events.

const { getSessionMock, onAuthStateChangeMock, signOutMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    signOutMock: vi.fn(),
  }),
)

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signOut: signOutMock,
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

// Reads the context so tests can assert on the exposed value.
function AuthProbe() {
  const { session, user: currentUser, loading, signOut } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="session">{session ? session.user.email : 'none'}</span>
      <span data-testid="user">{currentUser ? currentUser.id : 'none'}</span>
      <button onClick={() => void signOut()}>Sign out</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  )
}

type AuthListener = (event: string, session: Session | null) => void

function captureListener(): AuthListener {
  let emit: AuthListener = () => {}
  onAuthStateChangeMock.mockImplementation((listener: AuthListener) => {
    emit = listener
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  return (event, value) => act(() => emit(event, value))
}

beforeEach(() => {
  vi.clearAllMocks()
  onAuthStateChangeMock.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  getSessionMock.mockResolvedValue({ data: { session: null } })
  signOutMock.mockResolvedValue({ error: null })
})

describe('AuthProvider', () => {
  it('starts loading and restores the persisted session on mount', async () => {
    getSessionMock.mockResolvedValue({ data: { session } })
    renderProvider()

    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await act(async () => {})
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent(user.id)
  })

  it('updates the session on SIGNED_IN and clears it on SIGNED_OUT', async () => {
    const emit = captureListener()
    renderProvider()
    await act(async () => {})

    expect(screen.getByTestId('session')).toHaveTextContent('none')

    emit('SIGNED_IN', session)
    expect(screen.getByTestId('session')).toHaveTextContent(EMAIL)
    expect(screen.getByTestId('loading')).toHaveTextContent('false')

    emit('SIGNED_OUT', null)
    expect(screen.getByTestId('session')).toHaveTextContent('none')
  })

  it('signs out through supabase.auth.signOut and clears the session', async () => {
    getSessionMock.mockResolvedValue({ data: { session } })
    const emit = captureListener()
    renderProvider()
    await act(async () => {})

    expect(screen.getByText(EMAIL)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOutMock).toHaveBeenCalledTimes(1)

    // supabase emits SIGNED_OUT after signOut completes; the provider follows.
    emit('SIGNED_OUT', null)
    expect(screen.getByTestId('session')).toHaveTextContent('none')
  })

  it('useAuth throws when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<AuthProbe />)).toThrow(
      'useAuth must be used within an AuthProvider.',
    )

    consoleError.mockRestore()
  })
})

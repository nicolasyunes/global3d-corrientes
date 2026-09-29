import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import LoginPage from './LoginPage'

const { signInWithPasswordMock } = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: signInWithPasswordMock } },
}))

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('./useAuth', () => ({ useAuth: useAuthMock }))

const EMAIL = 'taller@example.com'

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
  access_token: 'a',
  refresh_token: 'r',
  expires_in: 3600,
  expires_at: 4_102_444_800,
  token_type: 'bearer',
  user,
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/hoy" element={<div>Hoy</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ session: null, loading: false })
  signInWithPasswordMock.mockResolvedValue({ data: {}, error: null })
})

describe('LoginPage', () => {
  it('signs in with email and password', async () => {
    renderLogin()
    fill(EMAIL, 'secreto')
    await act(async () => {})
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: EMAIL,
      password: 'secreto',
    })
  })

  it('asks for both fields before calling Supabase', () => {
    renderLogin()
    fill(EMAIL, '')
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Completá el email y la contraseña',
    )
  })

  it('translates invalid credentials', async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    renderLogin()
    fill(EMAIL, 'mal')
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Email o contraseña incorrectos.',
    )
  })

  it('redirects to Hoy when a session already exists', async () => {
    useAuthMock.mockReturnValue({ session, loading: false })
    renderLogin()
    expect(await screen.findByText('Hoy')).toBeInTheDocument()
  })

  it('renders nothing while the session resolves', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true })
    renderLogin()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})

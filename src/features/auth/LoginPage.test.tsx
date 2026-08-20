import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import LoginPage from './LoginPage'

// The supabase client and the auth hook are mocked so the page can be
// exercised for the full flow (submit → check-email → resend → change email)
// and the already-signed-in redirect without credentials or a network.

const { signInWithOtpMock } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: signInWithOtpMock } },
}))

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('./useAuth', () => ({
  useAuth: useAuthMock,
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

interface FromState {
  from?: { pathname: string }
}

function renderLogin(initialEntry?: { pathname: string; state?: FromState }) {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry ?? { pathname: '/admin/login' }]}
    >
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/orders" element={<div>Orders landing</div>} />
        <Route path="/admin/orders/42" element={<div>Order 42 detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthMock.mockReturnValue({ session: null, loading: false })
  signInWithOtpMock.mockResolvedValue({ data: { user: null }, error: null })
})

describe('LoginPage', () => {
  it('sends a sign-in link and transitions to the check-your-email state', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: EMAIL },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: EMAIL,
      options: { emailRedirectTo: expect.stringContaining('/admin/orders') },
    })

    expect(
      screen.getByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resend link' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Use a different email' }),
    ).toBeInTheDocument()
  })

  it('targets the emailRedirectTo at the deep link carried in state.from', async () => {
    renderLogin({
      pathname: '/admin/login',
      state: { from: { pathname: '/admin/orders/42' } },
    })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: EMAIL },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: EMAIL,
      options: {
        emailRedirectTo: expect.stringContaining('/admin/orders/42'),
      },
    })
  })

  it('requests another link for the same email when resend is tapped', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: EMAIL },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Resend link' }))
    await act(async () => {})

    expect(signInWithOtpMock).toHaveBeenCalledTimes(2)
    expect(signInWithOtpMock).toHaveBeenLastCalledWith({
      email: EMAIL,
      options: { emailRedirectTo: expect.stringContaining('/admin/orders') },
    })
  })

  it('returns to the email input on change-email and replaces the address', async () => {
    renderLogin()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: EMAIL },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    fireEvent.click(
      screen.getByRole('button', { name: 'Use a different email' }),
    )

    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.value).toBe(EMAIL)

    const nextEmail = 'operator@global3d.local'
    fireEvent.change(input, { target: { value: nextEmail } })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    expect(signInWithOtpMock).toHaveBeenLastCalledWith({
      email: nextEmail,
      options: { emailRedirectTo: expect.stringContaining('/admin/orders') },
    })
  })

  it('surfaces a sign-in error instead of transitioning', async () => {
    signInWithOtpMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Unable to validate email address' },
    })
    renderLogin()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: EMAIL },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }))
    await act(async () => {})

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to validate email address',
    )
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })

  it('redirects to the admin area when a session already exists', async () => {
    useAuthMock.mockReturnValue({ session, loading: false })
    renderLogin()

    expect(await screen.findByText('Orders landing')).toBeInTheDocument()
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('waits for session resolution before redirecting', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true })
    renderLogin()

    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
    expect(screen.queryByText('Orders landing')).not.toBeInTheDocument()
  })
})

import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import './auth.css'

// Magic-link sign-in for the owner/operator. Mounted at /admin/login INSIDE
// the lazy admin boundary but OUTSIDE ProtectedRoute, so it stays public
// within the admin chunk. Reads location.state.from (set by ProtectedRoute on
// redirect) to honor deep links: the magic link bounces back to the page the
// user originally wanted. An existing session short-circuits straight there.

export default function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()

  // ProtectedRoute redirects here with state.from = the attempted location;
  // anything else lands on the orders queue.
  const from = (location.state as { from?: Location } | null)?.from
  const fromPath = from?.pathname ?? '/admin/orders'

  const [email, setEmail] = useState('')
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wait for the provider to resolve a persisted session before deciding
  // whether to redirect — no premature bounce and no flicker of the form.
  if (loading) return null

  if (session) {
    return <Navigate to={fromPath} replace />
  }

  async function requestLink(target: string): Promise<void> {
    setSending(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: target,
      options: { emailRedirectTo: `${window.location.origin}${fromPath}` },
    })
    setSending(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    setSentEmail(target)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const target = email.trim()
    if (!target) {
      setError('Enter your email address to receive a sign-in link.')
      return
    }
    void requestLink(target)
  }

  if (sentEmail) {
    return (
      <main className="login">
        <div className="login__inner">
          <h1 className="login__title">Check your email</h1>
          <p className="login__note">
            We sent a sign-in link to <strong>{sentEmail}</strong>. Open it on
            this device to sign in — no password needed.
          </p>

          {error && (
            <p className="login__status login__status--error" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="login__submit"
            disabled={sending}
            onClick={() => void requestLink(sentEmail)}
          >
            {sending ? 'Sending…' : 'Resend link'}
          </button>

          <button
            type="button"
            className="login__link"
            disabled={sending}
            onClick={() => {
              setSentEmail(null)
              setError(null)
            }}
          >
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="login">
      <div className="login__inner">
        <h1 className="login__title">Sign in</h1>
        <p className="login__subtitle">
          We&apos;ll email you a sign-in link. No password needed.
        </p>

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <label className="login__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="login__input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {error && (
            <p className="login__status login__status--error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login__submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      </div>
    </main>
  )
}

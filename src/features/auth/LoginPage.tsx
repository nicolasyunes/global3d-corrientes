import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router-dom'
import Icon from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import '@/features/operators/operators.css'

// Workshop account sign-in (email + password). Opened once per device; after
// this, OperatorGate asks who is working and for their PIN.
export default function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from
  const fromPath = from?.pathname ?? '/admin/hoy'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (session) return <Navigate to={fromPath} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Completá el email y la contraseña del taller.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : signInError.message,
      )
    }
  }

  return (
    <main className="gate">
      <div className="gate__orb gate__orb--a" aria-hidden="true" />
      <div className="gate__orb gate__orb--b" aria-hidden="true" />
      <form className="gate__box gate__card" onSubmit={handleSubmit} noValidate>
        <p className="brand">
          <span className="brand__cube">
            <Icon name="box" size={18} />
          </span>
          Global<span className="brand__accent">3D</span>
        </p>
        <h1 className="gate__title gate__title--sm">
          Taller <span>Global3D</span>
        </h1>
        <p className="gate__sub">
          Ingresá con la cuenta del taller. Se pide una sola vez por
          dispositivo.
        </p>

        <label className="field-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="field-label" htmlFor="login-password">
          Contraseña
        </label>
        <input
          id="login-password"
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={busy}
        >
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}

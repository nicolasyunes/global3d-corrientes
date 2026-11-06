import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '@/components/Icon'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import '@/features/operators/operators.css'

export const RESET_PATH = '/admin/nueva-clave'

// Lands here from the "recuperar contraseña" email (or from the app, while
// signed in) to set a new password for the workshop account.
export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => navigate('/admin/hoy', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [done, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Usá al menos 8 caracteres.')
      return
    }
    if (password !== repeat) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) setError(updateError.message)
    else setDone(true)
  }

  if (loading) return null

  return (
    <main className="gate">
      <div className="gate__orb gate__orb--a" aria-hidden="true" />
      <div className="gate__orb gate__orb--b" aria-hidden="true" />
      <div className="gate__box gate__card">
        <p className="brand">
          <span className="brand__cube">
            <Icon name="box" size={18} />
          </span>
          Global<span className="brand__accent">3D</span>
        </p>
        <h1 className="gate__title gate__title--sm">Nueva contraseña</h1>

        {!session ? (
          <>
            <p className="gate__sub">
              El link venció o ya se usó. Pedí uno nuevo desde el ingreso.
            </p>
            <Link to="/admin/login" className="btn btn--primary btn--block">
              Volver al ingreso
            </Link>
          </>
        ) : done ? (
          <p className="gate__sub" role="status">
            Listo, la contraseña quedó cambiada. Entrando al taller…
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className="gate__sub">
              Es la contraseña de la cuenta del taller ({session.user.email}).
              Se pide una vez por dispositivo; después cada uno entra con su
              PIN.
            </p>
            <label className="field-label" htmlFor="reset-password">
              Nueva contraseña
            </label>
            <input
              id="reset-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="field-label" htmlFor="reset-repeat">
              Repetila
            </label>
            <input
              id="reset-repeat"
              className="input"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
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
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

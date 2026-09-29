import { useState, type FormEvent, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import { useAuth } from '@/features/auth/useAuth'
import { useOperator } from './operator-context'
import { createOperator, initialsFrom } from './operators.api'
import PinPad from './PinPad'
import './operators.css'

export const OPERATOR_COLORS = [
  '#F37021',
  '#0E7C66',
  '#6B3E8E',
  '#1E4FA8',
  '#C63D3D',
  '#1D1D1B',
]

function Brand() {
  return (
    <p className="brand brand--center">
      <span className="brand__cube">
        <Icon name="box" size={18} />
      </span>
      Global<span className="brand__accent">3D</span>
    </p>
  )
}

function WhoIsHere() {
  const { operators, select } = useOperator()
  const { signOut } = useAuth()
  const [picked, setPicked] = useState<string>(operators[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)

  async function submit(value: string) {
    setBusy(true)
    setWrong(false)
    try {
      const ok = await select(picked, value)
      if (!ok) {
        setWrong(true)
        setPin('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <div className="gate__orb gate__orb--a" aria-hidden="true" />
      <div className="gate__orb gate__orb--b" aria-hidden="true" />
      <div className="gate__box">
        <Brand />
        <h1 className="gate__title">
          ¿Quién está
          <br />
          en el <span>taller</span>?
        </h1>
        <p className="gate__sub">Elegí tu perfil e ingresá tu PIN.</p>
        <div className="gate__people" role="radiogroup" aria-label="Persona">
          {operators.map((op) => (
            <button
              key={op.id}
              type="button"
              role="radio"
              aria-checked={picked === op.id}
              className={`gate__person${picked === op.id ? ' is-on' : ''}`}
              onClick={() => {
                setPicked(op.id)
                setPin('')
                setWrong(false)
              }}
            >
              <span
                className="avatar avatar--xl"
                style={{ background: op.color }}
              >
                {op.initials}
              </span>
              {op.name}
            </button>
          ))}
        </div>
        <PinPad
          value={pin}
          onChange={setPin}
          onComplete={submit}
          disabled={busy}
          error={wrong}
        />
        <p className="gate__msg" role="alert">
          {wrong ? 'PIN incorrecto. Probá de nuevo.' : ' '}
        </p>
        <button
          type="button"
          className="gate__link"
          onClick={() => void signOut()}
        >
          Cerrar la cuenta del taller en este dispositivo
        </button>
      </div>
    </main>
  )
}

function FirstOperatorSetup() {
  const { refresh, select } = useOperator()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Escribí tu nombre.')
    if (!/^\d{4}$/.test(pin))
      return setError('El PIN tiene que tener 4 números.')
    if (pin !== pin2) return setError('Los PIN no coinciden.')
    setBusy(true)
    setError(null)
    try {
      const id = await createOperator({
        name: name.trim(),
        initials: initialsFrom(name),
        color: OPERATOR_COLORS[0],
        role: 'admin',
        pin,
      })
      await refresh()
      await select(id, pin)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo crear el perfil.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <div className="gate__orb gate__orb--a" aria-hidden="true" />
      <form className="gate__box gate__card" onSubmit={handleSubmit} noValidate>
        <Brand />
        <h1 className="gate__title gate__title--sm">Primer uso</h1>
        <p className="gate__sub">
          Creá tu perfil de administrador. Después vas a poder sumar al resto
          del equipo desde “Personas”.
        </p>
        <label className="field-label" htmlFor="op-name">
          Tu nombre
        </label>
        <input
          id="op-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
        />
        <label className="field-label" htmlFor="op-pin">
          PIN (4 números)
        </label>
        <input
          id="op-pin"
          className="input"
          inputMode="numeric"
          type="password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <label className="field-label" htmlFor="op-pin2">
          Repetí el PIN
        </label>
        <input
          id="op-pin2"
          className="input"
          inputMode="numeric"
          type="password"
          maxLength={4}
          value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
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
          {busy ? 'Creando…' : 'Crear mi perfil'}
        </button>
      </form>
    </main>
  )
}

export default function OperatorGate({ children }: { children: ReactNode }) {
  const { loading, error, operators, current } = useOperator()
  if (loading) return null
  if (error)
    return (
      <main className="gate">
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      </main>
    )
  if (operators.length === 0) return <FirstOperatorSetup />
  if (!current) return <WhoIsHere />
  return <>{children}</>
}

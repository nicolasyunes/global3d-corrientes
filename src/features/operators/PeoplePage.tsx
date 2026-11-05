import { useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from './operator-context'
import {
  canManageProducts,
  createOperator,
  initialsFrom,
  setOperatorPin,
  setOperatorProducts,
} from './operators.api'
import { OPERATOR_COLORS } from './OperatorGate'
import './operators.css'

type Mode =
  | { kind: 'idle' }
  | { kind: 'new' }
  | { kind: 'pin'; operatorId: string }
  | { kind: 'products'; operatorId: string; value: boolean }

export default function PeoplePage() {
  const { operators, current, refresh } = useOperator()
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [name, setName] = useState('')
  const [color, setColor] = useState(OPERATOR_COLORS[1])
  const [role, setRole] = useState<'operator' | 'admin'>('operator')
  const [pin, setPin] = useState('')
  const [products, setProducts] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function reset(next: Mode) {
    setMode(next)
    setName('')
    setPin('')
    setProducts(false)
    setAdminPin('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!current) return
    if (mode.kind === 'new' && !name.trim())
      return setError('Escribí el nombre.')
    if (mode.kind !== 'products' && !/^\d{4}$/.test(pin))
      return setError('El PIN tiene que tener 4 números.')
    if (!/^\d{4}$/.test(adminPin))
      return setError('Confirmá con tu PIN de administrador.')
    setBusy(true)
    setError(null)
    try {
      const admin = { id: current.id, pin: adminPin }
      if (mode.kind === 'new') {
        const newId = await createOperator(
          { name: name.trim(), initials: initialsFrom(name), color, role, pin },
          admin,
        )
        if (role === 'operator' && products)
          await setOperatorProducts(newId, true, admin)
        setDone(`${name.trim()} ya puede ingresar con su PIN.`)
      } else if (mode.kind === 'pin') {
        await setOperatorPin(mode.operatorId, pin, admin)
        setDone('PIN actualizado.')
      } else if (mode.kind === 'products') {
        await setOperatorProducts(mode.operatorId, mode.value, admin)
        const who = operators.find((o) => o.id === mode.operatorId)?.name ?? ''
        setDone(
          mode.value
            ? `${who} ya puede cargar y editar productos.`
            : `${who} ya no puede cargar productos.`,
        )
      }
      await refresh()
      reset({ kind: 'idle' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  const editing =
    mode.kind === 'pin' || mode.kind === 'products'
      ? operators.find((o) => o.id === mode.operatorId)
      : null

  return (
    <main>
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Personas</h1>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => reset({ kind: 'new' })}
          >
            <Icon name="plus" />
            Sumar persona
          </button>
        </div>
      </header>

      {done && (
        <p className="banner people-done" role="status">
          {done}
        </p>
      )}

      <div className="people-grid">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Equipo</h2>
          </div>
          <ul className="people-list">
            {operators.map((op) => (
              <li key={op.id} className="people-list__row">
                <span className="avatar" style={{ background: op.color }}>
                  {op.initials}
                </span>
                <div className="people-list__who">
                  <strong>{op.name}</strong>
                  <span className="muted">
                    {op.role === 'admin'
                      ? 'Administrador'
                      : canManageProducts(op)
                        ? 'Taller · carga productos'
                        : 'Taller'}
                  </span>
                </div>
                {op.role !== 'admin' && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      reset({
                        kind: 'products',
                        operatorId: op.id,
                        value: !op.can_manage_products,
                      })
                    }
                  >
                    {op.can_manage_products
                      ? 'Quitar productos'
                      : 'Habilitar productos'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => reset({ kind: 'pin', operatorId: op.id })}
                >
                  Cambiar PIN
                </button>
              </li>
            ))}
          </ul>
        </section>

        {mode.kind !== 'idle' && (
          <form className="card" onSubmit={handleSubmit} noValidate>
            <div className="card__head">
              <h2 className="card__title">
                {mode.kind === 'new'
                  ? 'Nueva persona'
                  : mode.kind === 'products'
                    ? `${mode.value ? 'Habilitar' : 'Quitar'} productos a ${editing?.name ?? ''}`
                    : `Nuevo PIN para ${editing?.name ?? ''}`}
              </h2>
              <span className="spacer" />
              <button
                type="button"
                className="icon-btn"
                aria-label="Cerrar"
                onClick={() => reset({ kind: 'idle' })}
              >
                <Icon name="close" />
              </button>
            </div>

            {mode.kind === 'new' && (
              <>
                <label className="field-label" htmlFor="p-name">
                  Nombre
                </label>
                <input
                  id="p-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="field-label">Color</p>
                <div className="chips">
                  {OPERATOR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="chip people-color"
                      aria-pressed={color === c}
                      aria-label={`Color ${c}`}
                      onClick={() => setColor(c)}
                    >
                      <span className="swatch" style={{ background: c }} />
                    </button>
                  ))}
                </div>
                <p className="field-label">Permisos</p>
                <div className="segmented">
                  <button
                    type="button"
                    aria-pressed={role === 'operator'}
                    onClick={() => setRole('operator')}
                  >
                    Taller
                  </button>
                  <button
                    type="button"
                    aria-pressed={role === 'admin'}
                    onClick={() => setRole('admin')}
                  >
                    Administrador
                  </button>
                </div>
                {role === 'operator' && (
                  <label className="people-check">
                    <input
                      type="checkbox"
                      checked={products}
                      onChange={(e) => setProducts(e.target.checked)}
                    />
                    Puede cargar y editar productos
                  </label>
                )}
              </>
            )}

            {mode.kind === 'products' && (
              <p className="muted">
                {mode.value
                  ? 'Va a poder entrar a Productos y stock, crear productos y editarlos. Cada cambio queda registrado con su nombre.'
                  : 'Deja de ver Productos y stock. Lo que ya cargó queda en el historial.'}
              </p>
            )}

            {mode.kind !== 'products' && (
              <>
                <label className="field-label" htmlFor="p-pin">
                  PIN de 4 números
                </label>
                <input
                  id="p-pin"
                  className="input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </>
            )}
            <label className="field-label" htmlFor="p-admin">
              Tu PIN ({current?.name}) para confirmar
            </label>
            <input
              id="p-admin"
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
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
              style={{ marginTop: 16 }}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

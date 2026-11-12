import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import {
  getCorreoConfig,
  quotePackages,
  saveCorreoConfig,
} from './shipping.api'
import {
  boxesToPackages,
  boxKey,
  configError,
  deliveryTime,
  normalizePostalCode,
  packageError,
  quoteText,
  serviceName,
  shippingErrorMessage,
  type CorreoConfig,
  type ShipBox,
  type ShipPackage,
  type ShipRate,
} from './shipping'
import './shipping.css'

const money = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)

const int = (s: string) => {
  const n = Math.round(Number(s.replace(',', '.')))
  return Number.isFinite(n) ? n : 0
}

type Mode = 'cajas' | 'medidas'

interface Manual {
  quantity: string
  weight: string
  height: string
  width: string
  length: string
}

export default function ShippingPage() {
  const { isAdmin } = useOperator()
  const [config, setConfig] = useState<CorreoConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cp, setCp] = useState('')
  const [mode, setMode] = useState<Mode>('cajas')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [manual, setManual] = useState<Manual>({
    quantity: '1',
    weight: '',
    height: '',
    width: '',
    length: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    postalCode: string
    rates: ShipRate[]
  } | null>(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    getCorreoConfig()
      .then((c) => {
        setConfig(c)
        setCounts(c.cajas[0] ? { [c.cajas[0].key]: 1 } : {})
      })
      .catch((e) =>
        setLoadError(
          e instanceof Error ? e.message : 'No se pudieron cargar las cajas.',
        ),
      )
  }, [])

  const packages: ShipPackage[] =
    mode === 'cajas'
      ? boxesToPackages(counts, config?.cajas ?? [])
      : [
          {
            quantity: int(manual.quantity),
            weight: int(manual.weight),
            height: int(manual.height),
            width: int(manual.width),
            length: int(manual.length),
          },
        ]
  const pkgError =
    packages.length === 0
      ? 'Elegí al menos una caja.'
      : packages.map(packageError).find(Boolean) ?? null
  const postal = normalizePostalCode(cp)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!postal) return setError('Revisá el código postal de destino.')
    if (pkgError) return setError(pkgError)
    setBusy(true)
    const res = await quotePackages(postal, packages)
    setBusy(false)
    if (!res.ok) {
      setResult(null)
      setError(shippingErrorMessage(res.error))
      return
    }
    setResult({ postalCode: res.postalCode, rates: res.rates })
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(
        quoteText(result.postalCode, result.rates),
      )
      showToast('Cotización copiada')
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  const setCount = (key: string, n: number) =>
    setCounts((c) => ({ ...c, [key]: Math.max(0, Math.min(100, n)) }))

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Envíos</p>
          <h1 className="page-title">Cotizar envío</h1>
        </div>
      </div>

      {loadError && (
        <p className="banner banner--error" role="alert">
          {loadError}
        </p>
      )}

      <div className="ship">
        <form className="ship__main" onSubmit={submit} noValidate>
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Destino</h2>
            </div>
            <label className="field-label" htmlFor="ship-cp">
              Código postal
            </label>
            <input
              id="ship-cp"
              className="input num ship__cp"
              inputMode="text"
              autoComplete="off"
              placeholder="Ej: 1704 o B1704ABC"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
            />
            <p className="ship__hint">
              Sale desde el CP {config?.cpOrigen ?? '…'} (Correo Argentino
              Clásico y Expreso).
            </p>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Paquete</h2>
              <span className="spacer" />
              <div className="segmented" role="group" aria-label="Cómo cargar el paquete">
                <button
                  type="button"
                  aria-pressed={mode === 'cajas'}
                  onClick={() => setMode('cajas')}
                >
                  Cajas
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'medidas'}
                  onClick={() => setMode('medidas')}
                >
                  Medidas a mano
                </button>
              </div>
            </div>

            {mode === 'cajas' ? (
              <ul className="ship-boxes">
                {config?.cajas.map((b) => (
                  <li key={b.key} className="ship-box">
                    <span>
                      <strong>{b.label}</strong>
                      <small>
                        {b.length}×{b.width}×{b.height} cm ·{' '}
                        {(b.weight / 1000).toLocaleString('es-AR')} kg
                      </small>
                    </span>
                    <span className="ship-step">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Una ${b.label.toLowerCase()} menos`}
                        onClick={() => setCount(b.key, (counts[b.key] ?? 0) - 1)}
                        disabled={!counts[b.key]}
                      >
                        −
                      </button>
                      <input
                        className="input num"
                        aria-label={`Cantidad de ${b.label.toLowerCase()}`}
                        inputMode="numeric"
                        value={counts[b.key] ?? 0}
                        onChange={(e) => setCount(b.key, int(e.target.value))}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Una ${b.label.toLowerCase()} más`}
                        onClick={() => setCount(b.key, (counts[b.key] ?? 0) + 1)}
                      >
                        +
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ship-grid">
                {(
                  [
                    ['weight', 'Peso (g)'],
                    ['length', 'Largo (cm)'],
                    ['width', 'Ancho (cm)'],
                    ['height', 'Alto (cm)'],
                    ['quantity', 'Bultos iguales'],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="ship-field">
                    <label className="field-label" htmlFor={`ship-${k}`}>
                      {label}
                    </label>
                    <input
                      id={`ship-${k}`}
                      className="input num"
                      inputMode="numeric"
                      value={manual[k]}
                      onChange={(e) =>
                        setManual((m) => ({ ...m, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="ship__hint">
              Correo arma un solo bulto con todo. Máximo 50 kg y 300 cm sumando
              los tres lados.
            </p>
          </section>

          {error && (
            <p className="banner banner--error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy || !config}
          >
            <Icon name="box" size={18} />
            {busy ? 'Cotizando…' : 'Cotizar'}
          </button>
        </form>

        <aside className="ship__side" aria-live="polite">
          <section className="card ship-result">
            <div className="card__head">
              <h2 className="card__title">
                {result ? `A CP ${result.postalCode}` : 'Resultado'}
              </h2>
              <span className="spacer" />
              {result && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void copy()}
                >
                  <Icon name="copy" size={16} />
                  Copiar
                </button>
              )}
            </div>
            {!result ? (
              <p className="ship__hint">
                Poné el CP y el paquete para ver sucursal y domicilio.
              </p>
            ) : (
              (['S', 'D'] as const).map((t) => {
                const list = result.rates.filter((r) => r.deliveredType === t)
                return (
                  <div key={t} className="ship-kind">
                    <h3>{t === 'S' ? 'A sucursal' : 'A domicilio'}</h3>
                    {list.length === 0 ? (
                      <p className="ship__hint">Sin cotización.</p>
                    ) : (
                      list.map((r) => (
                        <div key={r.productType} className="ship-rate">
                          <span>
                            <strong>{serviceName(r)}</strong>
                            <small>{deliveryTime(r)}</small>
                          </span>
                          <span className="num ship-rate__price">
                            {money(r.price)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )
              })
            )}
          </section>

          {isAdmin && config && (
            <BoxesEditor
              config={config}
              onSaved={(c) => {
                setConfig(c)
                showToast('Cajas guardadas')
              }}
            />
          )}
        </aside>
      </div>
      {toast}
    </>
  )
}

interface BoxDraft {
  key: string
  label: string
  weight: string
  height: string
  width: string
  length: string
}

const toDraft = (b: ShipBox): BoxDraft => ({
  key: b.key,
  label: b.label,
  weight: String(b.weight),
  height: String(b.height),
  width: String(b.width),
  length: String(b.length),
})

/** Cajas y CP de origen (solo admin). Las usa también la tienda. */
function BoxesEditor({
  config,
  onSaved,
}: {
  config: CorreoConfig
  onSaved: (c: CorreoConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState(config.cpOrigen)
  const [boxes, setBoxes] = useState<BoxDraft[]>(config.cajas.map(toDraft))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next: CorreoConfig = {
    cpOrigen: normalizePostalCode(origin) ?? origin.trim(),
    cajas: boxes.map((b) => ({
      key: b.key,
      label: b.label.trim(),
      weight: int(b.weight),
      height: int(b.height),
      width: int(b.width),
      length: int(b.length),
    })),
  }

  const set = (i: number, k: keyof BoxDraft, v: string) =>
    setBoxes((list) => list.map((b, j) => (j === i ? { ...b, [k]: v } : b)))

  const save = async () => {
    const err = configError(next)
    if (err) return setError(err)
    setError(null)
    setBusy(true)
    try {
      await saveCorreoConfig(next)
      onSaved(next)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => setOpen(true)}
      >
        <Icon name="edit" size={16} />
        Editar cajas y CP de origen
      </button>
    )

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Cajas</h2>
      </div>
      <p className="ship__hint">
        La tienda cotiza con estas cajas: cada producto usa la suya (se elige en
        el producto) y si no tiene, la de su ficha. Peso con la pieza adentro.
      </p>
      <label className="field-label" htmlFor="ship-origin">
        CP de origen
      </label>
      <input
        id="ship-origin"
        className="input num"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <ul className="ship-edit">
        {boxes.map((b, i) => (
          <li key={b.key}>
            <div className="ship-edit__row">
              <input
                className="input"
                aria-label="Nombre de la caja"
                value={b.label}
                onChange={(e) => set(i, 'label', e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Quitar ${b.label}`}
                disabled={boxes.length <= 1}
                onClick={() => setBoxes((l) => l.filter((_, j) => j !== i))}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="ship-edit__dims">
              {(
                [
                  ['weight', 'g'],
                  ['length', 'largo'],
                  ['width', 'ancho'],
                  ['height', 'alto'],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  <input
                    className="input num"
                    inputMode="numeric"
                    value={b[k]}
                    onChange={(e) => set(i, k, e.target.value)}
                  />
                  <small>{label}</small>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() =>
          setBoxes((l) => [
            ...l,
            {
              key: boxKey(
                `Caja ${l.length + 1}`,
                l.map((x) => x.key),
              ),
              label: `Caja ${l.length + 1}`,
              weight: '1000',
              height: '10',
              width: '20',
              length: '30',
            },
          ])
        }
      >
        <Icon name="plus" size={16} />
        Agregar caja
      </button>
      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      <div className="ship-edit__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setOpen(false)
            setBoxes(config.cajas.map(toDraft))
            setOrigin(config.cpOrigen)
            setError(null)
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}

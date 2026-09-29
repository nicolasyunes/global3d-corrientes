import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import {
  listProducts,
  updateProduct,
  type ProductRow,
} from '@/features/products/products.api'
import {
  createCalcProfile,
  deleteCalcProfile,
  listCalcProfiles,
  updateCalcProfile,
  type CalcProfileFields,
  type CalcProfileRow,
} from './calculator.api'
import {
  CUSTOM_PRINTER,
  EXTRAS_MARKUP,
  formatAmount,
  MULTIPLIERS,
  multiplierLabel,
  num,
  PRINTER_MODELS,
  quote,
} from './calculator'
import './calculator.css'

const PROFILE_KEY = 'g3d.calcProfile'

interface SettingsForm {
  currency: string
  filament: string
  kwh: string
  model: string
  watts: string
  life: string
  spare: string
  errorPct: string
  ml: string
}

const EMPTY_SETTINGS: SettingsForm = {
  currency: 'ARS',
  filament: '',
  kwh: '',
  model: PRINTER_MODELS[0].name,
  watts: String(PRINTER_MODELS[0].watts),
  life: '3000',
  spare: '',
  errorPct: '5',
  ml: '0,8',
}

const decimal = (n: number) => String(n).replace('.', ',')

function formFrom(p: CalcProfileRow): SettingsForm {
  return {
    currency: p.currency,
    filament: decimal(p.filament_price),
    kwh: decimal(p.kwh_price),
    model: p.printer_model ?? CUSTOM_PRINTER,
    watts: decimal(p.printer_watts),
    life: decimal(p.machine_life_hours),
    spare: decimal(p.spare_parts_cost),
    errorPct: decimal(p.error_margin_pct),
    ml: decimal(p.ml_surcharge),
  }
}

function fieldsFrom(
  f: SettingsForm,
): Omit<CalcProfileFields, 'name' | 'updated_by'> {
  return {
    currency: f.currency,
    filament_price: num(f.filament),
    kwh_price: num(f.kwh),
    printer_model: f.model === CUSTOM_PRINTER ? null : f.model,
    printer_watts: num(f.watts),
    machine_life_hours: num(f.life) || 1,
    spare_parts_cost: num(f.spare),
    error_margin_pct: num(f.errorPct),
    ml_surcharge: num(f.ml),
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(PROFILE_KEY)
  } catch {
    return null
  }
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="calc-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="calc-field__hint">{hint}</p>}
      {children}
    </div>
  )
}

function NumInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <input
      id={id}
      className="input num"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default function CalculatorPage() {
  const { current, isAdmin } = useOperator()
  const [profiles, setProfiles] = useState<CalcProfileRow[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)
  const [settings, setSettings] = useState<SettingsForm>(EMPTY_SETTINGS)
  const [dirty, setDirty] = useState(false)
  const [piece, setPiece] = useState({
    hours: '',
    minutes: '',
    grams: '',
    extras: '',
  })
  const [multiplier, setMultiplier] = useState('3,5')
  const [showRefs, setShowRefs] = useState(true)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productId, setProductId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, showToast] = useToast()

  useEffect(() => {
    listCalcProfiles()
      .then((rows) => {
        setProfiles(rows)
        const stored = readStored()
        const pick = rows.find((r) => r.id === stored) ?? rows[0]
        if (pick) {
          setProfileId(pick.id)
          setSettings(formFrom(pick))
        }
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los perfiles.',
        ),
      )
    if (isAdmin) {
      listProducts()
        .then((rows) => setProducts(rows.filter((p) => p.active)))
        .catch(() => undefined)
    }
  }, [isAdmin])

  const profile = profiles.find((p) => p.id === profileId) ?? null
  const custom = settings.model === CUSTOM_PRINTER
  const mult = num(multiplier)

  const result = useMemo(
    () =>
      quote(
        {
          filamentPrice: num(settings.filament),
          kwhPrice: num(settings.kwh),
          watts: num(settings.watts),
          lifeHours: num(settings.life),
          spareParts: num(settings.spare),
          errorPct: num(settings.errorPct),
          mlSurcharge: num(settings.ml),
        },
        {
          hours: num(piece.hours),
          minutes: num(piece.minutes),
          grams: num(piece.grams),
          extras: num(piece.extras),
        },
        mult,
      ),
    [settings, piece, mult],
  )
  const money = (v: number) => formatAmount(v, settings.currency)

  function setSetting<K extends keyof SettingsForm>(key: K, value: string) {
    setDirty(true)
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function pickModel(model: string) {
    const known = PRINTER_MODELS.find((m) => m.name === model)
    setDirty(true)
    setSettings((s) => ({
      ...s,
      model,
      watts: known ? String(known.watts) : s.watts,
    }))
  }

  function pickProfile(id: string) {
    if (
      dirty &&
      !window.confirm('Hay cambios sin guardar en el perfil. ¿Descartarlos?')
    )
      return
    const next = profiles.find((p) => p.id === id)
    if (!next) return
    setProfileId(id)
    setSettings(formFrom(next))
    setDirty(false)
    try {
      localStorage.setItem(PROFILE_KEY, id)
    } catch {
      /* solo es una preferencia */
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  const saveProfile = () =>
    run(async () => {
      if (!profile) return
      const saved = await updateCalcProfile(profile.id, {
        ...fieldsFrom(settings),
        updated_by: current?.id ?? null,
      })
      setProfiles((rows) => rows.map((r) => (r.id === saved.id ? saved : r)))
      setDirty(false)
      showToast(`Perfil “${saved.name}” actualizado`)
    })

  const newProfile = () => {
    const name = window.prompt(
      'Nombre del perfil nuevo (ej: A1 mini, Taller casa):',
    )
    if (!name?.trim()) return
    void run(async () => {
      const created = await createCalcProfile({
        name: name.trim(),
        ...fieldsFrom(settings),
        updated_by: current?.id ?? null,
      })
      setProfiles((rows) =>
        [...rows, created].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setProfileId(created.id)
      setDirty(false)
      showToast(`Perfil “${created.name}” creado`)
    })
  }

  const removeProfile = () => {
    if (!profile || profiles.length <= 1) return
    if (!window.confirm(`¿Borrar el perfil “${profile.name}”?`)) return
    void run(async () => {
      await deleteCalcProfile(profile.id)
      const rest = profiles.filter((p) => p.id !== profile.id)
      setProfiles(rest)
      setProfileId(rest[0].id)
      setSettings(formFrom(rest[0]))
      setDirty(false)
    })
  }

  const saveToProduct = () =>
    run(async () => {
      const product = products.find((p) => p.id === productId)
      if (!product) return
      const price = Math.round(result.total)
      await updateProduct(product.id, { base_price: price })
      setProducts((rows) =>
        rows.map((r) =>
          r.id === product.id ? { ...r, base_price: price } : r,
        ),
      )
      showToast(`${product.name}: precio ${money(price)}`)
    })

  async function copyTotal() {
    try {
      await navigator.clipboard.writeText(String(Math.round(result.total)))
      showToast('Total copiado')
    } catch {
      /* sin permiso de portapapeles */
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Calculadora de precios</h1>
        </div>
      </div>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      <div className="calc">
        <div className="calc__main">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Perfil</h2>
              <span className="spacer" />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={newProfile}
                disabled={busy}
              >
                <Icon name="plus" size={16} />
                Nuevo
              </button>
              <button
                type="button"
                className="icon-btn calc__danger"
                aria-label="Borrar perfil"
                title={
                  profiles.length <= 1
                    ? 'Tiene que quedar al menos un perfil'
                    : 'Borrar perfil'
                }
                onClick={removeProfile}
                disabled={busy || profiles.length <= 1}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
            <div className="calc-grid">
              <select
                className="input"
                aria-label="Perfil"
                value={profileId ?? ''}
                onChange={(e) => pickProfile(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                aria-label="Moneda"
                value={settings.currency}
                onChange={(e) => setSetting('currency', e.target.value)}
              >
                <option value="ARS">Pesos argentinos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block calc__save"
              onClick={() => void saveProfile()}
              disabled={busy || !profile || !dirty}
            >
              <Icon name="check" size={18} />
              {dirty ? 'Actualizar perfil' : 'Perfil al día'}
            </button>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Gastos fijos</h2>
            </div>
            <div className="calc-grid">
              <Field id="c-fil" label="Precio del filamento ($/kg)">
                <NumInput
                  id="c-fil"
                  value={settings.filament}
                  onChange={(v) => setSetting('filament', v)}
                />
              </Field>
              <Field id="c-kwh" label="Precio del kWh ($)">
                <NumInput
                  id="c-kwh"
                  value={settings.kwh}
                  onChange={(v) => setSetting('kwh', v)}
                />
              </Field>
              <Field
                id="c-model"
                label="Modelo de impresora"
                hint={`Completa el consumo solo. Si no está, elegí “${CUSTOM_PRINTER}”.`}
              >
                <select
                  id="c-model"
                  className="input"
                  value={settings.model}
                  onChange={(e) => pickModel(e.target.value)}
                >
                  {PRINTER_MODELS.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.watts} W)
                    </option>
                  ))}
                  <option value={CUSTOM_PRINTER}>{CUSTOM_PRINTER}</option>
                </select>
              </Field>
              <Field
                id="c-watts"
                label="Consumo de la impresora (W)"
                hint={
                  custom
                    ? 'Promedio mientras imprime.'
                    : 'Según el modelo. Elegí “Otro” para editarlo.'
                }
              >
                <NumInput
                  id="c-watts"
                  value={settings.watts}
                  disabled={!custom}
                  onChange={(v) => setSetting('watts', v)}
                />
              </Field>
              <Field id="c-life" label="Vida útil de la máquina (horas)">
                <NumInput
                  id="c-life"
                  value={settings.life}
                  onChange={(v) => setSetting('life', v)}
                />
              </Field>
              <Field id="c-spare" label="Costo de repuestos ($)">
                <NumInput
                  id="c-spare"
                  value={settings.spare}
                  onChange={(v) => setSetting('spare', v)}
                />
              </Field>
              <Field id="c-err" label="Margen de error (%)">
                <NumInput
                  id="c-err"
                  value={settings.errorPct}
                  onChange={(v) => setSetting('errorPct', v)}
                />
              </Field>
              <Field
                id="c-ml"
                label="Recargo MercadoLibre (factor)"
                hint="Se suma al multiplicador. 0,8 ≈ comisión + IVA."
              >
                <NumInput
                  id="c-ml"
                  value={settings.ml}
                  onChange={(v) => setSetting('ml', v)}
                />
              </Field>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Pieza</h2>
              <span className="spacer" />
              {(piece.hours ||
                piece.minutes ||
                piece.grams ||
                piece.extras) && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() =>
                    setPiece({ hours: '', minutes: '', grams: '', extras: '' })
                  }
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="calc-grid">
              <Field id="c-h" label="Horas de impresión">
                <NumInput
                  id="c-h"
                  placeholder="0"
                  value={piece.hours}
                  onChange={(v) => setPiece((p) => ({ ...p, hours: v }))}
                />
              </Field>
              <Field id="c-m" label="Minutos adicionales">
                <NumInput
                  id="c-m"
                  placeholder="0"
                  value={piece.minutes}
                  onChange={(v) => setPiece((p) => ({ ...p, minutes: v }))}
                />
              </Field>
              <Field id="c-g" label="Gramos de filamento">
                <NumInput
                  id="c-g"
                  placeholder="0"
                  value={piece.grams}
                  onChange={(v) => setPiece((p) => ({ ...p, grams: v }))}
                />
              </Field>
              <Field
                id="c-x"
                label="Insumos extra ($)"
                hint="Argollas, imanes, pintura… se cobran +30 %."
              >
                <NumInput
                  id="c-x"
                  placeholder="0"
                  value={piece.extras}
                  onChange={(v) => setPiece((p) => ({ ...p, extras: v }))}
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="calc__side">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Margen de ganancia</h2>
            </div>
            <p className="field-label">Multiplicador</p>
            <div className="calc-mults" role="group" aria-label="Multiplicador">
              {MULTIPLIERS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className="calc-mult num"
                  aria-pressed={mult === m.value}
                  title={m.hint}
                  onClick={() => setMultiplier(decimal(m.value))}
                >
                  {multiplierLabel(m.value)}
                </button>
              ))}
            </div>
            <Field
              id="c-mult"
              label="Personalizado"
              hint="Si necesitás otro valor, ingresalo acá (ej: 2,8)."
            >
              <NumInput
                id="c-mult"
                value={multiplier}
                onChange={setMultiplier}
              />
            </Field>
            <button
              type="button"
              className="calc-refs__toggle"
              aria-expanded={showRefs}
              onClick={() => setShowRefs((v) => !v)}
            >
              <span aria-hidden="true">{showRefs ? '▾' : '▸'}</span>
              Referencias
            </button>
            {showRefs && (
              <ul className="calc-refs">
                {MULTIPLIERS.map((m) => (
                  <li key={m.value}>
                    <strong className="num">{multiplierLabel(m.value)}</strong>{' '}
                    → {m.hint}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card calc-result" aria-live="polite">
            <div className="card__head">
              <h2 className="card__title">
                <Icon name="receipt" size={18} /> Resultados
              </h2>
            </div>
            <dl className="calc-lines">
              <div>
                <dt>Precio material</dt>
                <dd className="num">{money(result.material)}</dd>
              </div>
              <div>
                <dt>Precio luz</dt>
                <dd className="num">{money(result.power)}</dd>
              </div>
              <div>
                <dt>Desgaste máquina</dt>
                <dd className="num">{money(result.wear)}</dd>
              </div>
              <div>
                <dt>Margen de error</dt>
                <dd className="num">{money(result.error)}</dd>
              </div>
              <div className="calc-lines__strong">
                <dt>Costo total (sin insumos)</dt>
                <dd className="num">{money(result.cost)}</dd>
              </div>
              <div className="calc-lines__strong">
                <dt>Insumos (+{Math.round((EXTRAS_MARKUP - 1) * 100)} %)</dt>
                <dd className="num">{money(result.extras)}</dd>
              </div>
            </dl>

            <div className="calc-total">
              <p className="calc-total__label">Total a cobrar</p>
              <p className="calc-total__value num">{money(result.total)}</p>
              <button
                type="button"
                className="calc-total__copy"
                onClick={() => void copyTotal()}
              >
                Copiar
              </button>
            </div>
            <div className="calc-ml">
              <p className="calc-total__label">Precio MercadoLibre</p>
              <p className="calc-ml__value num">{money(result.mercadoLibre)}</p>
              <p className="calc-ml__hint">
                Margen {multiplierLabel(mult)} + recargo{' '}
                {multiplierLabel(num(settings.ml))}
              </p>
            </div>

            {isAdmin && products.length > 0 && (
              <div className="calc-apply">
                <label className="field-label" htmlFor="c-product">
                  Usar como precio de lista de…
                </label>
                <div className="calc-apply__row">
                  <select
                    id="c-product"
                    className="input"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">Elegí un producto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--dark"
                    disabled={busy || !productId || result.total <= 0}
                    onClick={() => void saveToProduct()}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
      {toast}
    </>
  )
}

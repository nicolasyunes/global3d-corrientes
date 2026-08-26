import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/lib/domain-constants'
import { createSale, listInventory, type InventoryRow } from './sales.api'
import {
  emptySaleDraft,
  parsePositiveDecimal,
  remainingAfterSale,
  validateSale,
  type FieldErrors,
  type SaleDraft,
} from './validation'
import '@/features/orders/orders.css'

function spoolLabel(spool: InventoryRow): string {
  const parts = [spool.material, spool.color, spool.brand].filter(Boolean)
  const remaining =
    spool.remaining_grams === null
      ? ''
      : ` — ${spool.remaining_grams}g restantes`
  return `${parts.join(' / ')}${remaining}`
}

// Capture a supplies sale against a specific spool. Insufficient-stock is
// surfaced as an inline message (not a raw Postgres error) — the client-side
// pre-check in validateSale catches the common case, this catch handles the
// race where another sale landed first.
export default function SalesForm() {
  const navigate = useNavigate()
  const [spools, setSpools] = useState<InventoryRow[]>([])
  const [spoolsLoading, setSpoolsLoading] = useState(true)
  const [draft, setDraft] = useState<SaleDraft>(emptySaleDraft())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listInventory()
      .then((rows) => {
        if (!cancelled) setSpools(rows)
      })
      .catch(() => {
        // Non-fatal: the picker stays empty; the form itself still validates.
      })
      .finally(() => {
        if (!cancelled) setSpoolsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedSpool = spools.find((s) => s.id === draft.inventoryId)
  const remaining = remainingAfterSale(
    selectedSpool,
    parsePositiveDecimal(draft.quantityGrams),
  )

  function setField<K extends keyof SaleDraft>(field: K, value: SaleDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next: FieldErrors = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateSale(draft, spools)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    try {
      await createSale({
        inventoryId: draft.inventoryId || null,
        quantityGrams: parsePositiveDecimal(draft.quantityGrams),
        amount: parsePositiveDecimal(draft.amount) ?? 0,
        method: draft.method || null,
      })
      navigate('/admin/ventas')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setSubmitError(
        message.includes('inventory_remaining_grams_nonneg')
          ? 'No alcanza el stock de este color.'
          : message || 'No se pudo guardar la venta.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="order-form">
      <form onSubmit={handleSubmit} noValidate>
        <div className="order-form__content">
          <header className="order-form__header">
            <h1 className="order-form__title">Nueva venta</h1>
            <p className="order-form__subtitle">
              Registrá una venta de insumos contra un spool — el stock se
              actualiza automáticamente.
            </p>
          </header>

          <section className="form-section">
            <div className="field">
              <label className="field__label" htmlFor="sale-spool">
                Spool
              </label>
              <select
                id="sale-spool"
                className="field__input"
                value={draft.inventoryId}
                onChange={(e) => setField('inventoryId', e.target.value)}
                aria-invalid={Boolean(errors.inventoryId)}
                disabled={spoolsLoading}
              >
                <option value="">
                  {spoolsLoading ? 'Cargando spools…' : 'Elegí un spool'}
                </option>
                {spools.map((spool) => (
                  <option key={spool.id} value={spool.id}>
                    {spoolLabel(spool)}
                  </option>
                ))}
              </select>
              {errors.inventoryId && (
                <p className="field__error">{errors.inventoryId}</p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="sale-grams">
                Gramos vendidos
              </label>
              <input
                id="sale-grams"
                className="field__input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.quantityGrams}
                onChange={(e) => setField('quantityGrams', e.target.value)}
                aria-invalid={Boolean(errors.quantityGrams)}
              />
              {errors.quantityGrams && (
                <p className="field__error">{errors.quantityGrams}</p>
              )}
              {!errors.quantityGrams && remaining !== null && (
                <p className="field__hint">
                  Quedan {remaining}g después de esta venta.
                </p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="sale-amount">
                Monto
              </label>
              <input
                id="sale-amount"
                className="field__input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.amount}
                onChange={(e) => setField('amount', e.target.value)}
                aria-invalid={Boolean(errors.amount)}
              />
              {errors.amount && <p className="field__error">{errors.amount}</p>}
            </div>

            <fieldset className="field fieldset">
              <legend className="field__label">Método de pago</legend>
              <div className="chips">
                {PAYMENT_METHOD.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`chip${draft.method === option ? ' chip--selected' : ''}`}
                    aria-pressed={draft.method === option}
                    onClick={() => setField('method', option as PaymentMethod)}
                  >
                    {PAYMENT_METHOD_LABELS[option]}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          {submitError && (
            <p className="form-banner form-banner--error" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="sticky-cta">
          <div className="sticky-cta__inner">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar venta'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import {
  ORIGIN_CHANNEL,
  ORIGIN_CHANNEL_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  PRODUCT_TYPE,
  PRODUCT_TYPE_LABELS,
  type OriginChannel,
  type PaymentMethod,
  type ProductType,
} from '@/lib/domain-constants'
import { createOrder, upsertCustomer } from './orders.api'
import {
  emptyDraft,
  parseMoney,
  resolvedPendingBalance,
  validateOrder,
  type FieldErrors,
  type OrderDraft,
} from './validation'
import './orders.css'

type Mode = 'quick' | 'full'

interface ColorPart {
  key: string
  value: string
}

function buildColorSpec(parts: ColorPart[]): Record<string, string> {
  const spec: Record<string, string> = {}
  for (const part of parts) {
    const key = part.key.trim()
    if (key !== '') spec[key] = part.value.trim()
  }
  return spec
}

interface ChipGroupProps<T extends string> {
  label: string
  value: string
  options: readonly T[]
  labels: Record<T, string>
  onSelect: (value: T) => void
  error?: string
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  labels,
  onSelect,
  error,
}: ChipGroupProps<T>) {
  return (
    <fieldset className="field fieldset">
      <legend className="field__label">{label}</legend>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`chip${value === option ? ' chip--selected' : ''}`}
            aria-pressed={value === option}
            onClick={() => onSelect(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
      {error && <p className="field__error">{error}</p>}
    </fieldset>
  )
}

export default function OrderForm() {
  const [mode, setMode] = useState<Mode>('quick')
  const [draft, setDraft] = useState<OrderDraft>(() => emptyDraft())
  const [colorParts, setColorParts] = useState<ColorPart[]>([
    { key: '', value: '' },
  ])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)

  function setField<K extends keyof OrderDraft>(
    field: K,
    value: OrderDraft[K],
  ) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next: FieldErrors = { ...prev }
      delete next[field]
      return next
    })
  }

  function setColorPart(index: number, field: 'key' | 'value', value: string) {
    setColorParts((prev) =>
      prev.map((part, i) => (i === index ? { ...part, [field]: value } : part)),
    )
  }

  function addColorPart() {
    setColorParts((prev) => [...prev, { key: '', value: '' }])
  }

  function removeColorPart(index: number) {
    setColorParts((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateOrder(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)
    setSavedName(null)

    try {
      const customer = await upsertCustomer({
        name: draft.customerName.trim(),
        phone: draft.customerPhone.trim() || null,
      })

      const colorSpec = buildColorSpec(colorParts)

      await createOrder({
        customer_id: customer.id,
        product_type: draft.productType as ProductType,
        due_date: draft.dueDate,
        total_amount: parseMoney(draft.totalAmount),
        deposit: parseMoney(draft.deposit),
        pending_balance: resolvedPendingBalance(draft),
        payment_method: (draft.paymentMethod || null) as PaymentMethod | null,
        origin_channel: (draft.originChannel || null) as OriginChannel | null,
        color_spec: colorSpec,
        personalization: draft.personalization.trim() || null,
        measurements: draft.measurements.trim() || null,
        observations: draft.observations.trim() || null,
        status: 'new',
      })

      setSavedName(customer.name)
      // Reset for the next capture — quick order is a repeat flow.
      setDraft(emptyDraft())
      setColorParts([{ key: '', value: '' }])
      setMode('quick')
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the order.',
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
            <h1 className="order-form__title">New order</h1>
            <p className="order-form__subtitle">
              Capture a job from an inquiry — details can wait.
            </p>
          </header>

          <div className="mode-toggle" aria-label="Form mode">
            <button
              type="button"
              className="mode-toggle__button"
              aria-pressed={mode === 'quick'}
              onClick={() => setMode('quick')}
            >
              Quick order
            </button>
            <button
              type="button"
              className="mode-toggle__button"
              aria-pressed={mode === 'full'}
              onClick={() => setMode('full')}
            >
              Full form
            </button>
          </div>

          <section className="form-section">
            <h2 className="form-section__heading">Customer</h2>

            <div className="field">
              <label className="field__label" htmlFor="customer-name">
                Name
              </label>
              <input
                id="customer-name"
                className="field__input"
                type="text"
                autoComplete="off"
                value={draft.customerName}
                onChange={(e) => setField('customerName', e.target.value)}
                aria-invalid={Boolean(errors.customerName)}
              />
              {errors.customerName && (
                <p className="field__error">{errors.customerName}</p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="customer-phone">
                Phone / WhatsApp
              </label>
              <input
                id="customer-phone"
                className="field__input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={draft.customerPhone}
                onChange={(e) => setField('customerPhone', e.target.value)}
              />
            </div>
          </section>

          <section className="form-section">
            <h2 className="form-section__heading">Order</h2>

            <ChipGroup
              label="Product type"
              value={draft.productType}
              options={PRODUCT_TYPE}
              labels={PRODUCT_TYPE_LABELS}
              onSelect={(value) => setField('productType', value)}
              error={errors.productType}
            />

            <div className="field">
              <label className="field__label" htmlFor="due-date">
                Due date
              </label>
              <input
                id="due-date"
                className="field__input"
                type="date"
                value={draft.dueDate}
                onChange={(e) => setField('dueDate', e.target.value)}
                aria-invalid={Boolean(errors.dueDate)}
              />
              {errors.dueDate && (
                <p className="field__error">{errors.dueDate}</p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="total-amount">
                Total amount
              </label>
              <input
                id="total-amount"
                className="field__input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={draft.totalAmount}
                onChange={(e) => setField('totalAmount', e.target.value)}
                aria-invalid={Boolean(errors.totalAmount)}
              />
              {errors.totalAmount && (
                <p className="field__error">{errors.totalAmount}</p>
              )}
            </div>
          </section>

          {mode === 'full' && (
            <section className="form-section">
              <h2 className="form-section__heading">Details</h2>

              <div className="field">
                <label className="field__label" htmlFor="deposit">
                  Deposit (seña)
                </label>
                <input
                  id="deposit"
                  className="field__input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.deposit}
                  onChange={(e) => setField('deposit', e.target.value)}
                  aria-invalid={Boolean(errors.deposit)}
                />
                {errors.deposit && (
                  <p className="field__error">{errors.deposit}</p>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="pending-balance">
                  Pending balance
                </label>
                <input
                  id="pending-balance"
                  className="field__input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Auto (total − deposit)"
                  value={draft.pendingBalance}
                  onChange={(e) => setField('pendingBalance', e.target.value)}
                  aria-invalid={Boolean(errors.pendingBalance)}
                />
                {errors.pendingBalance && (
                  <p className="field__error">{errors.pendingBalance}</p>
                )}
              </div>

              <ChipGroup
                label="Payment method"
                value={draft.paymentMethod}
                options={PAYMENT_METHOD}
                labels={PAYMENT_METHOD_LABELS}
                onSelect={(value) => setField('paymentMethod', value)}
                error={errors.paymentMethod}
              />

              <ChipGroup
                label="Origin channel"
                value={draft.originChannel}
                options={ORIGIN_CHANNEL}
                labels={ORIGIN_CHANNEL_LABELS}
                onSelect={(value) => setField('originChannel', value)}
                error={errors.originChannel}
              />

              <fieldset className="field fieldset">
                <legend className="field__label">Color spec (per part)</legend>
                <div className="color-spec">
                  {colorParts.map((part, index) => (
                    <div className="color-spec__row" key={index}>
                      <input
                        className="field__input"
                        type="text"
                        placeholder="Part (e.g. lid)"
                        aria-label={`Part ${index + 1} name`}
                        value={part.key}
                        onChange={(e) =>
                          setColorPart(index, 'key', e.target.value)
                        }
                      />
                      <input
                        className="field__input"
                        type="text"
                        placeholder="Color (e.g. black)"
                        aria-label={`Part ${index + 1} color`}
                        value={part.value}
                        onChange={(e) =>
                          setColorPart(index, 'value', e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="color-spec__remove"
                        aria-label={`Remove part ${index + 1}`}
                        onClick={() => removeColorPart(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={addColorPart}
                >
                  + Add part
                </button>
              </fieldset>

              <div className="field">
                <label className="field__label" htmlFor="personalization">
                  Personalization
                </label>
                <input
                  id="personalization"
                  className="field__input"
                  type="text"
                  value={draft.personalization}
                  onChange={(e) => setField('personalization', e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="measurements">
                  Measurements
                </label>
                <input
                  id="measurements"
                  className="field__input"
                  type="text"
                  value={draft.measurements}
                  onChange={(e) => setField('measurements', e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="observations">
                  Observations
                </label>
                <textarea
                  id="observations"
                  className="field__input field__input--textarea"
                  value={draft.observations}
                  onChange={(e) => setField('observations', e.target.value)}
                />
              </div>
            </section>
          )}

          {submitError && (
            <p className="form-banner form-banner--error" role="alert">
              {submitError}
            </p>
          )}
          {savedName && (
            <p className="form-banner form-banner--success" role="status">
              Order saved for {savedName}. Capture the next one.
            </p>
          )}
        </div>

        <div className="sticky-cta">
          <div className="sticky-cta__inner">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}

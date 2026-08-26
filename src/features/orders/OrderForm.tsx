import { useEffect, useState, type FormEvent } from 'react'
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
import {
  createOrder,
  listOrderItems,
  replaceOrderItems,
  updateCustomer,
  updateOrder,
  upsertCustomer,
  type OrderRow,
  type OrderWithCustomer,
} from './orders.api'
import {
  buildColorSpec,
  buildOrderItems,
  colorPartsFromSpec,
  draftFromOrder,
  emptyDraft,
  emptyItemDraft,
  itemsSubtotal,
  parseMoney,
  resolvedPendingBalance,
  validateOrder,
  type ColorPart,
  type FieldErrors,
  type OrderDraft,
  type OrderItemDraft,
} from './validation'
import { formatMoney } from './format'
import './orders.css'

type Mode = 'quick' | 'full'

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

interface OrderFormProps {
  // When provided, the form edits this existing order (detail flow) instead of
  // creating a new one. Status is managed separately (the detail progression
  // buttons), never through this form.
  initialOrder?: OrderWithCustomer
  // Called after a successful save with the persisted order (create or edit).
  onSaved?: (order: OrderRow) => void
}

export default function OrderForm({ initialOrder, onSaved }: OrderFormProps) {
  const editing = initialOrder !== undefined

  const [mode, setMode] = useState<Mode>(editing ? 'full' : 'quick')
  const [draft, setDraft] = useState<OrderDraft>(() =>
    editing && initialOrder ? draftFromOrder(initialOrder) : emptyDraft(),
  )
  const [colorParts, setColorParts] = useState<ColorPart[]>(() =>
    editing && initialOrder
      ? colorPartsFromSpec(initialOrder.color_spec)
      : [{ key: '', value: '' }],
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [itemDrafts, setItemDrafts] = useState<OrderItemDraft[]>([])

  // Prefill items for the edit flow — a new order has none to load. Runs once
  // per order id; the form otherwise owns items state locally.
  useEffect(() => {
    if (!editing || !initialOrder) return
    let cancelled = false
    listOrderItems(initialOrder.id)
      .then((rows) => {
        if (cancelled) return
        setItemDrafts(
          rows.map((row) => ({
            productType: row.product_type,
            description: row.description,
            personalization: row.personalization ?? '',
            quantity: String(row.quantity),
            unitPrice: row.unit_price === null ? '' : String(row.unit_price),
          })),
        )
      })
      .catch(() => {
        // Non-fatal: the order's own fields still load and save correctly
        // without items; leave the section empty rather than blocking edit.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, initialOrder?.id])

  function setItemField<K extends keyof OrderItemDraft>(
    index: number,
    field: K,
    value: OrderItemDraft[K],
  ) {
    setItemDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  function addItem() {
    setItemDrafts((prev) => [...prev, emptyItemDraft()])
  }

  function removeItem(index: number) {
    setItemDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  // Suggested total from priced items — offered, never auto-applied, so it
  // never silently overwrites a total the operator typed by hand.
  const suggestedTotal = itemsSubtotal(buildOrderItems(itemDrafts))

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

    const colorSpec = buildColorSpec(colorParts)
    const items = buildOrderItems(itemDrafts)

    try {
      if (editing && initialOrder) {
        // Edit flow: update the linked customer contact, then the order fields.
        // Status is deliberately untouched — the detail view owns progression.
        await updateCustomer(initialOrder.customer_id, {
          name: draft.customerName.trim(),
          phone: draft.customerPhone.trim() || null,
        })

        const updated = await updateOrder(initialOrder.id, {
          product_type: draft.productType as ProductType,
          due_date: draft.dueDate,
          total_amount: parseMoney(draft.totalAmount),
          deposit: parseMoney(draft.deposit),
          pending_balance: resolvedPendingBalance(draft),
          payment_method: (draft.paymentMethod || null) as PaymentMethod | null,
          origin_channel: (draft.originChannel || null) as OriginChannel | null,
          reference_link: draft.referenceLink.trim() || null,
          color_spec: colorSpec,
          personalization: draft.personalization.trim() || null,
          measurements: draft.measurements.trim() || null,
          observations: draft.observations.trim() || null,
        })
        await replaceOrderItems(initialOrder.id, items)

        onSaved?.(updated)
      } else {
        const customer = await upsertCustomer({
          name: draft.customerName.trim(),
          phone: draft.customerPhone.trim() || null,
        })

        const created = await createOrder({
          customer_id: customer.id,
          product_type: draft.productType as ProductType,
          due_date: draft.dueDate,
          total_amount: parseMoney(draft.totalAmount),
          deposit: parseMoney(draft.deposit),
          pending_balance: resolvedPendingBalance(draft),
          payment_method: (draft.paymentMethod || null) as PaymentMethod | null,
          origin_channel: (draft.originChannel || null) as OriginChannel | null,
          reference_link: draft.referenceLink.trim() || null,
          color_spec: colorSpec,
          personalization: draft.personalization.trim() || null,
          measurements: draft.measurements.trim() || null,
          observations: draft.observations.trim() || null,
          status: 'new',
        })
        await replaceOrderItems(created.id, items)

        onSaved?.(created)
        setSavedName(customer.name)
        // Reset for the next capture — quick order is a repeat flow.
        setDraft(emptyDraft())
        setColorParts([{ key: '', value: '' }])
        setItemDrafts([])
        setMode('quick')
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar el pedido.',
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
            <h1 className="order-form__title">
              {editing ? 'Editar pedido' : 'Nuevo pedido'}
            </h1>
            <p className="order-form__subtitle">
              {editing
                ? 'Ajustá los detalles y avanzá el estado.'
                : 'Cargá un trabajo desde una consulta — los detalles pueden esperar.'}
            </p>
          </header>

          {!editing && (
            <div className="mode-toggle" aria-label="Modo del formulario">
              <button
                type="button"
                className="mode-toggle__button"
                aria-pressed={mode === 'quick'}
                onClick={() => setMode('quick')}
              >
                Rápido
              </button>
              <button
                type="button"
                className="mode-toggle__button"
                aria-pressed={mode === 'full'}
                onClick={() => setMode('full')}
              >
                Formulario completo
              </button>
            </div>
          )}

          <section className="form-section">
            <h2 className="form-section__heading">Cliente</h2>

            <div className="field">
              <label className="field__label" htmlFor="customer-name">
                Nombre
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
                Teléfono / WhatsApp
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
            <h2 className="form-section__heading">Pedido</h2>

            <ChipGroup
              label="Tipo de producto"
              value={draft.productType}
              options={PRODUCT_TYPE}
              labels={PRODUCT_TYPE_LABELS}
              onSelect={(value) => setField('productType', value)}
              error={errors.productType}
            />

            <div className="field">
              <label className="field__label" htmlFor="due-date">
                Fecha de entrega
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
                Monto total
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
              {suggestedTotal !== null && (
                <p className="field__hint">
                  Suma de los ítems: {formatMoney(suggestedTotal)}.{' '}
                  <button
                    type="button"
                    className="link-btn link-btn--inline"
                    onClick={() =>
                      setField('totalAmount', String(suggestedTotal))
                    }
                  >
                    Usar este monto
                  </button>
                </p>
              )}
            </div>
          </section>

          <section className="form-section">
            <h2 className="form-section__heading">Ítems</h2>
            <p className="field__hint">
              Opcional — para pedidos por lote o personalizados con varias
              piezas distintas. Dejalo vacío para un pedido de un solo producto.
            </p>

            {itemDrafts.map((item, index) => (
              <fieldset className="item-row" key={index}>
                <legend className="field__label">Ítem {index + 1}</legend>

                <ChipGroup
                  label="Tipo de producto"
                  value={item.productType}
                  options={PRODUCT_TYPE}
                  labels={PRODUCT_TYPE_LABELS}
                  onSelect={(value) =>
                    setItemField(index, 'productType', value)
                  }
                />

                <div className="field">
                  <label className="field__label">Descripción</label>
                  <textarea
                    className="field__input field__input--textarea"
                    placeholder="Descripción completa (ej: texto de la placa, categoría)"
                    value={item.description}
                    onChange={(e) =>
                      setItemField(index, 'description', e.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label className="field__label">Personalización</label>
                  <input
                    className="field__input"
                    type="text"
                    value={item.personalization}
                    onChange={(e) =>
                      setItemField(index, 'personalization', e.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label className="field__label">Cantidad</label>
                  <input
                    className="field__input"
                    type="text"
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) =>
                      setItemField(index, 'quantity', e.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label className="field__label">Precio unitario</label>
                  <input
                    className="field__input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setItemField(index, 'unitPrice', e.target.value)
                    }
                  />
                </div>

                <button
                  type="button"
                  className="color-spec__remove"
                  onClick={() => removeItem(index)}
                >
                  Quitar ítem
                </button>
              </fieldset>
            ))}

            <button type="button" className="link-btn" onClick={addItem}>
              + Agregar ítem
            </button>
          </section>

          {mode === 'full' && (
            <section className="form-section">
              <h2 className="form-section__heading">Detalles</h2>

              <div className="field">
                <label className="field__label" htmlFor="deposit">
                  Seña
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
                  Saldo pendiente
                </label>
                <input
                  id="pending-balance"
                  className="field__input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Automático (total − seña)"
                  value={draft.pendingBalance}
                  onChange={(e) => setField('pendingBalance', e.target.value)}
                  aria-invalid={Boolean(errors.pendingBalance)}
                />
                {errors.pendingBalance && (
                  <p className="field__error">{errors.pendingBalance}</p>
                )}
              </div>

              <ChipGroup
                label="Método de pago"
                value={draft.paymentMethod}
                options={PAYMENT_METHOD}
                labels={PAYMENT_METHOD_LABELS}
                onSelect={(value) => setField('paymentMethod', value)}
                error={errors.paymentMethod}
              />

              <ChipGroup
                label="Canal de origen"
                value={draft.originChannel}
                options={ORIGIN_CHANNEL}
                labels={ORIGIN_CHANNEL_LABELS}
                onSelect={(value) => setField('originChannel', value)}
                error={errors.originChannel}
              />

              <div className="field">
                <label className="field__label" htmlFor="reference-link">
                  Link de referencia
                </label>
                <input
                  id="reference-link"
                  className="field__input"
                  type="url"
                  placeholder="https://makerworld.com/..."
                  value={draft.referenceLink}
                  onChange={(e) => setField('referenceLink', e.target.value)}
                  aria-invalid={Boolean(errors.referenceLink)}
                />
                {errors.referenceLink && (
                  <p className="field__error">{errors.referenceLink}</p>
                )}
              </div>

              <fieldset className="field fieldset">
                <legend className="field__label">Colores (por parte)</legend>
                <div className="color-spec">
                  {colorParts.map((part, index) => (
                    <div className="color-spec__row" key={index}>
                      <input
                        className="field__input"
                        type="text"
                        placeholder="Parte (ej: tapa)"
                        aria-label={`Nombre de la parte ${index + 1}`}
                        value={part.key}
                        onChange={(e) =>
                          setColorPart(index, 'key', e.target.value)
                        }
                      />
                      <input
                        className="field__input"
                        type="text"
                        placeholder="Color (ej: negro)"
                        aria-label={`Color de la parte ${index + 1}`}
                        value={part.value}
                        onChange={(e) =>
                          setColorPart(index, 'value', e.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="color-spec__remove"
                        aria-label={`Quitar parte ${index + 1}`}
                        onClick={() => removeColorPart(index)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={addColorPart}
                >
                  + Agregar parte
                </button>
              </fieldset>

              <div className="field">
                <label className="field__label" htmlFor="personalization">
                  Personalización
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
                  Medidas
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
                  Observaciones
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
              Pedido guardado para {savedName}. Cargá el siguiente.
            </p>
          )}
        </div>

        <div className="sticky-cta">
          <div className="sticky-cta__inner">
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting
                ? 'Guardando…'
                : editing
                  ? 'Guardar cambios'
                  : 'Guardar pedido'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}

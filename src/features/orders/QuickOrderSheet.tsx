import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ORIGIN_CHANNEL, ORIGIN_CHANNEL_LABELS } from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'
import { useQuickOrderDraft } from './useQuickOrderDraft'

interface QuickOrderSheetProps {
  open: boolean
  onClose: () => void
  onCreated: (order: OrderWithCustomer) => void
}

// Mobile (<900px) quick capture: a bottom sheet standing in for
// QuickOrderRow, whose inline fields don't work with a thumb. Saving keeps
// the sheet open ("Guardar y seguir") so a run of quick entries doesn't
// require reopening it each time; the operator closes it explicitly when
// done. A footer link keeps the full form (chips, colors, payment method,
// etc.) reachable for the cases quick capture doesn't cover. Shares its save
// path with QuickOrderRow via useQuickOrderDraft.
export default function QuickOrderSheet({
  open,
  onClose,
  onCreated,
}: QuickOrderSheetProps) {
  const { draft, errors, submitting, submitError, setField, submit } =
    useQuickOrderDraft()

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await submit()
    if (created) onCreated(created)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <div
      className="quick-order-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Pedido rápido"
      onKeyDown={handleKeyDown}
    >
      <div
        className="quick-order-sheet__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        className="quick-order-sheet__panel"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <header className="quick-order-sheet__header">
          <h2 className="quick-order-sheet__title">Pedido rápido</h2>
          <button
            type="button"
            className="quick-order-sheet__close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-customer">
            Cliente
          </label>
          <input
            id="qo-sheet-customer"
            className="field__input"
            type="text"
            aria-invalid={Boolean(errors.customerName)}
            value={draft.customerName}
            onChange={(e) => setField('customerName', e.target.value)}
          />
          {errors.customerName && (
            <p className="field__error">{errors.customerName}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-detail">
            Detalle
          </label>
          <input
            id="qo-sheet-detail"
            className="field__input"
            type="text"
            value={draft.detail}
            onChange={(e) => setField('detail', e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-channel">
            Medio
          </label>
          <select
            id="qo-sheet-channel"
            className="field__input"
            value={draft.originChannel}
            onChange={(e) => setField('originChannel', e.target.value)}
          >
            <option value="">Sin especificar</option>
            {ORIGIN_CHANNEL.map((channel) => (
              <option key={channel} value={channel}>
                {ORIGIN_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-due">
            Entrega
          </label>
          <input
            id="qo-sheet-due"
            className="field__input"
            type="date"
            aria-invalid={Boolean(errors.dueDate)}
            value={draft.dueDate}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
          {errors.dueDate && <p className="field__error">{errors.dueDate}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-total">
            Total
          </label>
          <input
            id="qo-sheet-total"
            className="field__input"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={Boolean(errors.totalAmount)}
            value={draft.totalAmount}
            onChange={(e) => setField('totalAmount', e.target.value)}
          />
          {errors.totalAmount && (
            <p className="field__error">{errors.totalAmount}</p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="qo-sheet-deposit">
            Seña
          </label>
          <input
            id="qo-sheet-deposit"
            className="field__input"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={Boolean(errors.deposit)}
            value={draft.deposit}
            onChange={(e) => setField('deposit', e.target.value)}
          />
          {errors.deposit && <p className="field__error">{errors.deposit}</p>}
        </div>

        {submitError && (
          <p className="form-banner form-banner--error" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar y seguir'}
        </button>

        <Link to="/admin/orders/new" className="quick-order-sheet__full-form">
          ¿Necesitás el formulario completo?
        </Link>
      </form>
    </div>
  )
}

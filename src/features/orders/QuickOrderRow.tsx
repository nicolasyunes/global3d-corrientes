import { useRef, type FormEvent, type KeyboardEvent } from 'react'
import { PRODUCT_TYPE, PRODUCT_TYPE_LABELS } from '@/lib/domain-constants'
import type { OrderWithCustomer } from './orders.api'
import { useQuickOrderDraft } from './useQuickOrderDraft'

interface QuickOrderRowProps {
  onCreated: (order: OrderWithCustomer) => void
}

// Desktop (≥900px) spreadsheet-speed capture: five fields in one row, Enter
// (via the submit button, the browser's native implicit-submit) saves and
// hands focus back to Cliente, Escape clears without saving. Hidden below
// 900px in favor of QuickOrderSheet — a thumb can't drive five inline
// text/number fields the way a keyboard can. See useQuickOrderDraft for the
// actual save path, shared with the mobile sheet.
export default function QuickOrderRow({ onCreated }: QuickOrderRowProps) {
  const { draft, errors, submitting, submitError, setField, reset, submit } =
    useQuickOrderDraft()
  const customerInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await submit()
    if (created) {
      onCreated(created)
      customerInputRef.current?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      reset()
      customerInputRef.current?.focus()
    }
  }

  const fieldError =
    errors.customerName ?? errors.dueDate ?? errors.totalAmount ?? errors.deposit

  return (
    <form
      className="quick-order-row"
      aria-label="Alta rápida de pedido"
      onSubmit={(event) => void handleSubmit(event)}
      onKeyDown={handleKeyDown}
    >
      <div className="quick-order-row__fields">
        <input
          ref={customerInputRef}
          className="field__input quick-order-row__input"
          type="text"
          placeholder="Cliente"
          aria-label="Cliente"
          aria-invalid={Boolean(errors.customerName)}
          value={draft.customerName}
          onChange={(e) => setField('customerName', e.target.value)}
        />
        <select
          className="field__input quick-order-row__input"
          aria-label="Producto"
          value={draft.productType}
          onChange={(e) => setField('productType', e.target.value)}
        >
          <option value="">Producto</option>
          {PRODUCT_TYPE.map((type) => (
            <option key={type} value={type}>
              {PRODUCT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          className="field__input quick-order-row__input"
          type="text"
          placeholder="Detalle"
          aria-label="Detalle"
          value={draft.detail}
          onChange={(e) => setField('detail', e.target.value)}
        />
        <input
          className="field__input quick-order-row__input quick-order-row__input--date"
          type="date"
          aria-label="Entrega"
          aria-invalid={Boolean(errors.dueDate)}
          value={draft.dueDate}
          onChange={(e) => setField('dueDate', e.target.value)}
        />
        <input
          className="field__input quick-order-row__input quick-order-row__input--money"
          type="text"
          inputMode="decimal"
          placeholder="Total"
          aria-label="Total"
          aria-invalid={Boolean(errors.totalAmount)}
          value={draft.totalAmount}
          onChange={(e) => setField('totalAmount', e.target.value)}
        />
        <input
          className="field__input quick-order-row__input quick-order-row__input--money"
          type="text"
          inputMode="decimal"
          placeholder="Seña"
          aria-label="Seña"
          aria-invalid={Boolean(errors.deposit)}
          value={draft.deposit}
          onChange={(e) => setField('deposit', e.target.value)}
        />
        <button
          type="submit"
          className="quick-order-row__submit"
          disabled={submitting}
        >
          {submitting ? 'Guardando…' : 'Agregar'}
        </button>
      </div>

      {fieldError && (
        <p className="field__error quick-order-row__error" role="alert">
          {fieldError}
        </p>
      )}
      {submitError && (
        <p
          className="form-banner form-banner--error quick-order-row__error"
          role="alert"
        >
          {submitError}
        </p>
      )}
    </form>
  )
}

import { useCallback, useState } from 'react'
import type { ProductType } from '@/lib/domain-constants'
import {
  createOrder,
  replaceOrderItems,
  upsertCustomer,
  type OrderWithCustomer,
} from './orders.api'
import {
  emptyQuickOrderDraft,
  inferProductType,
  parseMoney,
  quickOrderItem,
  quickOrderPendingBalance,
  validateQuickOrder,
  type QuickOrderDraft,
  type QuickOrderFieldErrors,
} from './validation'

export interface UseQuickOrderDraftResult {
  draft: QuickOrderDraft
  errors: QuickOrderFieldErrors
  submitting: boolean
  submitError: string | null
  setField: <K extends keyof QuickOrderDraft>(
    field: K,
    value: QuickOrderDraft[K],
  ) => void
  reset: () => void
  // Resolves to the persisted order on success, or null when validation
  // blocked the save (errors are already set) or the API call failed
  // (submitError is already set) — either way, the draft is left as-is so
  // the operator can fix and retry without retyping.
  submit: () => Promise<OrderWithCustomer | null>
}

// Owns the quick-capture draft (customer name, free-text detail, due date,
// total, deposit) and turns it into a persisted order: upsert the customer,
// create the order with the inferred product_type, then attach the detail as
// a single order_item. Shared by the desktop inline row and the mobile sheet
// so both presentations save through the exact same path. Deliberately
// unaware of the orders list — the caller decides what happens to the
// returned order (insert it, show an undo toast, etc.).
export function useQuickOrderDraft(): UseQuickOrderDraftResult {
  const [draft, setDraft] = useState<QuickOrderDraft>(() =>
    emptyQuickOrderDraft(),
  )
  const [errors, setErrors] = useState<QuickOrderFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = useCallback(
    <K extends keyof QuickOrderDraft>(field: K, value: QuickOrderDraft[K]) => {
      setDraft((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        if (!(field in prev)) return prev
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [],
  )

  const reset = useCallback(() => {
    setDraft(emptyQuickOrderDraft())
    setErrors({})
    setSubmitError(null)
  }, [])

  const submit = useCallback(async (): Promise<OrderWithCustomer | null> => {
    const nextErrors = validateQuickOrder(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return null
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    try {
      const customer = await upsertCustomer({ name: draft.customerName.trim() })
      const created = await createOrder({
        customer_id: customer.id,
        product_type: inferProductType(draft.detail) as ProductType,
        due_date: draft.dueDate,
        total_amount: parseMoney(draft.totalAmount),
        deposit: parseMoney(draft.deposit),
        pending_balance: quickOrderPendingBalance(draft),
        status: 'new',
      })

      const item = quickOrderItem(draft.detail)
      if (item) await replaceOrderItems(created.id, [item])

      reset()
      return { ...created, customers: { name: customer.name, phone: customer.phone } }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar el pedido.',
      )
      return null
    } finally {
      setSubmitting(false)
    }
  }, [draft, reset])

  return { draft, errors, submitting, submitError, setField, reset, submit }
}

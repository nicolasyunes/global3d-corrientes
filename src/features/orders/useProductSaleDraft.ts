import { useCallback, useState } from 'react'
import type { ProductRow } from '@/features/products/products.api'
import { upsertCustomer } from './orders.api'
import { createProductSale, type ProductSaleRow } from './productSales.api'
import {
  emptyProductSaleDraft,
  FREE_TEXT_PRODUCT,
  parsePositiveDecimal,
  parsePositiveInt,
  validateProductSale,
  type ProductSaleDraft,
  type ProductSaleFieldErrors,
} from './productSaleValidation'

export interface UseProductSaleDraftResult {
  draft: ProductSaleDraft
  errors: ProductSaleFieldErrors
  submitting: boolean
  submitError: string | null
  setField: <K extends keyof ProductSaleDraft>(
    field: K,
    value: ProductSaleDraft[K],
  ) => void
  reset: () => void
  // Resolves to the persisted sale on success, or null when validation blocked
  // it (errors set) or the API call failed (submitError set) — the draft is
  // left as-is either way so the operator can fix and retry.
  submit: () => Promise<ProductSaleRow | null>
}

// Owns the direct-sale draft and turns it into a `product_sale` transaction:
// optionally upsert the customer, then insert the sale (catalog product +
// quantity, or a free-text name). Shape mirrors useQuickOrderDraft; the caller
// decides what happens to the returned row (prepend it, show an undo toast).
export function useProductSaleDraft(
  products: ProductRow[],
): UseProductSaleDraftResult {
  const [draft, setDraft] = useState<ProductSaleDraft>(() =>
    emptyProductSaleDraft(),
  )
  const [errors, setErrors] = useState<ProductSaleFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = useCallback(
    <K extends keyof ProductSaleDraft>(
      field: K,
      value: ProductSaleDraft[K],
    ) => {
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
    setDraft(emptyProductSaleDraft())
    setErrors({})
    setSubmitError(null)
  }, [])

  const submit = useCallback(async (): Promise<ProductSaleRow | null> => {
    const nextErrors = validateProductSale(draft, products)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return null
    }

    setErrors({})
    setSubmitting(true)
    setSubmitError(null)

    try {
      const isFreeText = draft.productId === FREE_TEXT_PRODUCT
      const catalog = isFreeText
        ? undefined
        : products.find((p) => p.id === draft.productId)
      const productName = isFreeText ? draft.productName.trim() : null

      const customerName = draft.customerName.trim()
      let customerId: string | null = null
      if (customerName) {
        const customer = await upsertCustomer({ name: customerName })
        customerId = customer.id
      }

      const created = await createProductSale({
        productId: catalog?.id ?? null,
        productName,
        quantity: parsePositiveInt(draft.quantity),
        amount: parsePositiveDecimal(draft.amount) ?? 0,
        method: draft.method || null,
        customerId,
      })

      reset()
      return {
        ...created,
        customers: customerName ? { name: customerName } : null,
        products: catalog ? { name: catalog.name } : null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setSubmitError(
        message.includes('stock_quantity')
          ? 'No alcanza el stock de este producto.'
          : message || 'No se pudo guardar la venta.',
      )
      return null
    } finally {
      setSubmitting(false)
    }
  }, [draft, products, reset])

  return { draft, errors, submitting, submitError, setField, reset, submit }
}

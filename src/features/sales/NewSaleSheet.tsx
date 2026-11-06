import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { filterProducts } from '@/features/products/list'
import { listProducts, type ProductRow } from '@/features/products/products.api'
import {
  ORIGIN_CHANNEL,
  ORIGIN_CHANNEL_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  type OriginChannel,
  type PaymentMethod,
} from '@/lib/domain-constants'
import { matchesQuery } from '@/lib/search'
import '@/features/orders/order-modal.css'
import './sales.css'
import { pesos } from './sales'
import {
  createSale,
  editSale,
  searchSaleCustomers,
  setCustomerWholesale,
  type SaleCustomerHit,
  type SaleWithRefs,
} from './sales.api'
import {
  emptyTicket,
  freeLine,
  lineFromProduct,
  ticketErrors,
  ticketTotals,
  toPayload,
  type TicketDraft,
  type TicketLine,
} from './ticket'

export interface NewSaleSheetProps {
  open: boolean
  onClose: () => void
  onSaved: (saleId: string) => void
  // With a sale: "Corregir" mode (admin only, checked in the database).
  editing?: SaleWithRefs | null
}

const MAX_SUGGESTIONS = 8

function draftFromSale(sale: SaleWithRefs): TicketDraft {
  const lines: TicketLine[] = [...sale.sale_items]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      key: i.id,
      productId: i.product_id,
      description: i.description,
      quantity: String(i.quantity),
      listUnitPrice: Number(i.list_unit_price),
      unitPrice: String(Number(i.unit_price)),
    }))
  return {
    lines,
    discountMode: 'amount',
    discount: Number(sale.discount) > 0 ? String(Number(sale.discount)) : '',
    method: (sale.method ?? null) as PaymentMethod | null,
    channel: (sale.channel ?? 'local') as OriginChannel,
    customerId: sale.customer_id,
    note: sale.note ?? '',
  }
}

// "Nueva venta": a ticket with one or more lines, an optional overall
// discount and the payment method. Built for speed: type, Enter, save.
export default function NewSaleSheet({
  open,
  onClose,
  onSaved,
  editing = null,
}: NewSaleSheetProps) {
  const { current } = useOperator()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<TicketDraft>(emptyTicket())
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [customer, setCustomer] = useState<SaleCustomerHit | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerHits, setCustomerHits] = useState<SaleCustomerHit[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setDraft(editing ? draftFromSale(editing) : emptyTicket())
    setCustomer(
      editing?.customer_id && editing.customers
        ? {
            id: editing.customer_id,
            name: editing.customers.name,
            phone: null,
            wholesale: editing.customers.wholesale,
          }
        : null,
    )
    setQuery('')
    setErrors([])
    setSubmitError(null)
    let alive = true
    setLoading(true)
    listProducts()
      .then((rows) => {
        if (alive)
          setProducts(filterProducts(rows, { query: '', activeOnly: true }))
      })
      .catch(() => undefined) // free-text lines still work
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, editing])

  useEffect(() => {
    const q = customerQuery.trim()
    if (q.length < 2) {
      setCustomerHits([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      searchSaleCustomers(q)
        .then((hits) => {
          if (alive) setCustomerHits(hits)
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [customerQuery])

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    return products
      .filter((p) => matchesQuery([p.name, p.description], query))
      .slice(0, MAX_SUGGESTIONS)
  }, [products, query])

  if (!open) return null

  const totals = ticketTotals(draft)

  function patch(p: Partial<TicketDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  function patchLine(key: string, p: Partial<TicketLine>) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.key === key ? { ...l, ...p } : l)),
    }))
  }

  function addLine(line: TicketLine) {
    setDraft((d) => ({ ...d, lines: [...d.lines, line] }))
    setQuery('')
    setHighlight(0)
    searchRef.current?.focus()
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(suggestions.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = suggestions[highlight]
      if (pick) addLine(lineFromProduct(pick))
      else if (query.trim()) addLine(freeLine(query))
    }
  }

  function close() {
    setDraft(emptyTicket())
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs = ticketErrors(draft)
    setErrors(errs)
    if (errs.length > 0) return
    setSaving(true)
    setSubmitError(null)
    try {
      const payload = toPayload({ ...draft, customerId: customer?.id ?? null })
      const id = editing
        ? await editSale(editing.id, payload, current?.id ?? null)
        : await createSale(payload, current?.id ?? null)
      setDraft(emptyTicket())
      setCustomer(null)
      onSaved(id)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo guardar la venta.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleWholesale(checked: boolean) {
    if (!customer) return
    try {
      await setCustomerWholesale(customer.id, checked)
      setCustomer({ ...customer, wholesale: checked })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'No se pudo marcar el cliente.',
      )
    }
  }

  const title = editing ? 'Corregir venta' : 'Nueva venta'

  return (
    <div
      className="omodal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close()
      }}
    >
      <button
        type="button"
        className="omodal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={close}
      />
      <form
        className="omodal__panel"
        onSubmit={(e) => void submit(e)}
        noValidate
      >
        <header className="omodal__head">
          <div>
            <p className="eyebrow">Ventas</p>
            <h2 className="omodal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="omodal__body">
          <section className="omodal__section">
            {!current && (
              <p className="banner banner--error" role="alert">
                Poné tu PIN para cargar ventas
              </p>
            )}
            <label className="field-label" htmlFor="sale-search">
              Buscar producto
            </label>
            <div className="sale-search">
              <input
                id="sale-search"
                ref={searchRef}
                className="input"
                type="search"
                autoComplete="off"
                autoFocus
                placeholder={
                  loading
                    ? 'Cargando productos…'
                    : 'Buscá o escribí un producto'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onSearchKey}
              />
              {query.trim() && (
                <ul className="sale-suggest" role="listbox">
                  {suggestions.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        className="sale-suggest__opt"
                        onClick={() => addLine(lineFromProduct(p))}
                      >
                        <span>{p.name}</span>
                        <span className="muted">
                          {pesos(p.base_price)} · {p.stock_quantity} en stock
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="sale-suggest__opt sale-suggest__free"
                      onClick={() => addLine(freeLine(query))}
                    >
                      Agregar «{query.trim()}» sin producto guardado
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {draft.lines.length > 0 && (
              <ul className="sale-lines">
                {draft.lines.map((l) => {
                  const changed =
                    l.productId !== null &&
                    String(l.listUnitPrice) !== l.unitPrice.trim()
                  return (
                    <li key={l.key} className="sale-line">
                      {l.productId ? (
                        <span className="sale-line__name">{l.description}</span>
                      ) : (
                        <input
                          className="input sale-line__name"
                          aria-label="Nombre del producto"
                          value={l.description}
                          onChange={(e) =>
                            patchLine(l.key, { description: e.target.value })
                          }
                        />
                      )}
                      <input
                        className="input sale-line__qty"
                        inputMode="numeric"
                        aria-label={`Cantidad de ${l.description}`}
                        value={l.quantity}
                        onChange={(e) =>
                          patchLine(l.key, { quantity: e.target.value })
                        }
                      />
                      <div className="sale-line__price">
                        <input
                          className="input"
                          inputMode="decimal"
                          aria-label={`Precio de ${l.description}`}
                          placeholder="Precio"
                          value={l.unitPrice}
                          onChange={(e) =>
                            patchLine(l.key, { unitPrice: e.target.value })
                          }
                        />
                        {changed && (
                          <s className="muted">{pesos(l.listUnitPrice)}</s>
                        )}
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Quitar ${l.description}`}
                        onClick={() =>
                          patch({
                            lines: draft.lines.filter((x) => x.key !== l.key),
                          })
                        }
                      >
                        <Icon name="close" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="omodal__row">
              <div className="omodal__field omodal__field--grow">
                <label className="field-label" htmlFor="sale-discount">
                  Descuento
                </label>
                <input
                  id="sale-discount"
                  className="input"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft.discount}
                  onChange={(e) => patch({ discount: e.target.value })}
                />
              </div>
              <div
                className="chips sale-discount-mode"
                role="group"
                aria-label="Tipo de descuento"
              >
                <button
                  type="button"
                  className="chip"
                  aria-pressed={draft.discountMode === 'amount'}
                  onClick={() => patch({ discountMode: 'amount' })}
                >
                  $
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={draft.discountMode === 'percent'}
                  onClick={() => patch({ discountMode: 'percent' })}
                >
                  %
                </button>
              </div>
            </div>

            <p className="field-label">Medio de pago</p>
            <div
              className="chips sale-methods"
              role="group"
              aria-label="Medio de pago"
            >
              {PAYMENT_METHOD.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="chip"
                  aria-pressed={draft.method === m}
                  onClick={() =>
                    patch({ method: draft.method === m ? null : m })
                  }
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="omodal__row omodal__row--wrap">
              <div className="omodal__field">
                <label className="field-label" htmlFor="sale-channel">
                  Canal
                </label>
                <select
                  id="sale-channel"
                  className="input"
                  value={draft.channel}
                  onChange={(e) =>
                    patch({ channel: e.target.value as OriginChannel })
                  }
                >
                  {ORIGIN_CHANNEL.map((c) => (
                    <option key={c} value={c}>
                      {ORIGIN_CHANNEL_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="omodal__field omodal__field--grow">
                <label className="field-label" htmlFor="sale-customer">
                  Cliente (opcional)
                </label>
                {customer ? (
                  <div className="sale-customer">
                    <strong>{customer.name}</strong>
                    <label className="sale-customer__ws">
                      <input
                        type="checkbox"
                        checked={customer.wholesale}
                        onChange={(e) => void toggleWholesale(e.target.checked)}
                      />{' '}
                      Mayorista
                    </label>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setCustomer(null)}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="sale-customer"
                      className="input"
                      autoComplete="off"
                      placeholder="Buscar por nombre"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                    />
                    {customerHits.length > 0 && (
                      <ul className="sale-suggest">
                        {customerHits.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="sale-suggest__opt"
                              onClick={() => {
                                setCustomer(c)
                                setCustomerQuery('')
                                setCustomerHits([])
                              }}
                            >
                              <span>{c.name}</span>
                              <span className="muted">
                                {c.wholesale ? 'Mayorista' : (c.phone ?? '')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>

            <label className="field-label" htmlFor="sale-note">
              Nota (opcional)
            </label>
            <input
              id="sale-note"
              className="input"
              value={draft.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </section>
        </div>

        <footer className="omodal__foot">
          <p className="sale-totals" aria-live="polite">
            <span>Lista {pesos(totals.listTotal)}</span>
            {totals.listTotal - totals.amount > 0 && (
              <span>Descuento {pesos(totals.listTotal - totals.amount)}</span>
            )}
            <strong>{`Cobrás ${pesos(totals.amount)}`}</strong>
          </p>
          {errors.length > 0 && (
            <ul className="omodal__err" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {submitError && (
            <p className="banner banner--error" role="alert">
              {submitError}
            </p>
          )}
          <div className="omodal__actions">
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !current}
            >
              {saving ? 'Guardando…' : 'Guardar venta'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}

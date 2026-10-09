import { useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { daysBetween } from '@/features/production/due'
import { colorSpecEntries, swatchFor } from './colorSpec'
import { formatDueDate, formatMoney } from './format'
import {
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/lib/domain-constants'
import { parseMoney } from './orderDraft'
import OrderPayments from './OrderPayments'
import type { OrderItemRow, OrderWithCustomer } from './orders.api'
import { validatePayment } from './payments'
import { stageOf } from './stage'
import { ClientAvatar } from './stage-ui'

export interface PieceStats {
  pieces: number
  piecesDone: number
  units: number
  unitsDone: number
}

// wa.me needs the full international number; local Corrientes numbers
// ("3794123456") get Argentina's mobile prefix.
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  const full = digits.startsWith('54') ? digits : `549${digits}`
  return `https://wa.me/${full}`
}

function shortDay(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return date
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

// Right-hand summary of the order: who it is for, when it is due, what is
// still owed. One block, then whatever free text the order carries.
export default function OrderSummary({
  order,
  items,
  today,
  channel,
  onPay,
  paymentsKey,
  onPaymentVoided,
}: {
  order: OrderWithCustomer
  items: OrderItemRow[]
  today: string
  channel: string | null
  onPay: (
    amount: number,
    method: PaymentMethod,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  paymentsKey: number
  onPaymentVoided: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const stage = stageOf(order)
  const closed = stage === 'delivered' || stage === 'cancelled'
  const diff = daysBetween(today, order.due_date)
  const dueHint = closed
    ? stage === 'delivered'
      ? 'Entregado'
      : 'Cancelado'
    : stage === 'on_hold'
      ? 'En espera, sin confirmar'
      : order.flexible
        ? 'Sin apuro'
        : diff < 0
          ? `Atrasado ${-diff} ${diff === -1 ? 'día' : 'días'}`
          : diff === 0
            ? 'Es hoy'
            : `${diff === 1 ? 'falta' : 'faltan'} ${diff} ${diff === 1 ? 'día' : 'días'}`
  const deliveredOwing =
    stage === 'delivered' && (order.pending_balance ?? 0) > 0
  const late = !closed && stage !== 'on_hold' && !order.flexible && diff < 0

  const created = order.created_at.slice(0, 10)
  const span = Math.max(1, daysBetween(created, order.due_date))
  const elapsed = Math.min(1, Math.max(0, daysBetween(created, today) / span))

  const total = order.total_amount ?? 0
  const balance = order.pending_balance ?? 0
  const paid = Math.max(0, total - balance)
  const paidPct =
    total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  const phone = order.customers?.phone ?? null
  const wa = whatsappLink(phone)
  const colors = colorSpecEntries(order.color_spec)
  const notes = order.observations?.trim()
  // Free-text orders keep the sheet's DESCRIPCION on the order; show it only
  // when it says more than the item details already shown.
  const extra = order.description?.trim()
  const itemDetails = items.map((i) => i.personalization?.trim()).join(' ')
  const showDescription =
    extra && !itemDetails.includes(extra) && extra !== notes
  const hasLegacy =
    colors.length > 0 || order.measurements || order.personalization

  async function submitPay(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const problem = validatePayment({ amount, method, balance })
    if (problem || !method) {
      setPayError(problem)
      return
    }
    const value = parseMoney(amount) as number
    setSaving(true)
    setPayError(null)
    const result = await onPay(value, method)
    setSaving(false)
    if (result.ok) {
      setAmount('')
      setMethod(null)
      setPaying(false)
    } else setPayError(result.message)
  }

  return (
    <section className="card osum2">
      <div className="osum2__client">
        <ClientAvatar name={order.customers?.name} />
        <div className="osum2__who">
          <strong>{order.customers?.name ?? 'Sin cliente'}</strong>
          <span>
            {[channel, phone].filter(Boolean).join(' · ') || 'Sin teléfono'}
          </span>
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="osum2__wa"
          >
            <Icon name="chat" size={16} />
            WhatsApp
          </a>
        )}
      </div>

      <div className="osum2__block">
        <div className="osum2__label">
          <span>Entrega</span>
          <span className={late ? 'is-late' : closed ? undefined : 'is-soon'}>
            {dueHint}
          </span>
        </div>
        <p className="osum2__big">{formatDueDate(order.due_date)}</p>
        {!closed && (
          <div className="osum2__timeline" aria-hidden="true">
            <div className="osum2__track">
              <i style={{ width: `${elapsed * 100}%` }} />
              <b style={{ left: `${elapsed * 100}%` }} />
            </div>
            <div className="osum2__ticks">
              <span>Cargado {shortDay(created)}</span>
              <span className="osum2__today">Hoy</span>
              <span>{shortDay(order.due_date)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="osum2__block">
        <div className="osum2__label">
          <span>Saldo</span>
          {deliveredOwing && <span>Entregado con saldo pendiente</span>}
          {stage !== 'cancelled' && balance > 0 && !paying && (
            <button
              type="button"
              className="osum2__link"
              onClick={() => setPaying(true)}
            >
              Registrar pago
            </button>
          )}
        </div>
        <p className={`osum2__big num${balance > 0 ? ' is-owed' : ' is-paid'}`}>
          {formatMoney(order.pending_balance)}
        </p>
        <p className="osum2__sub num">
          Total {formatMoney(order.total_amount)} · Seña{' '}
          {formatMoney(order.deposit)}
        </p>
        {total > 0 && (
          <>
            <div className="osum2__track osum2__track--paid" aria-hidden="true">
              <i style={{ width: `${paidPct}%` }} />
            </div>
            <div className="osum2__ticks num">
              <span>Pagado {formatMoney(paid)}</span>
              <span>Total {formatMoney(total)}</span>
            </div>
          </>
        )}
        {paying && (
          <form className="osum2__pay" onSubmit={submitPay} noValidate>
            <label className="field-label" htmlFor="pay-amount">
              ¿Cuánto pagó?
            </label>
            <div className="osum2__pay-row">
              <input
                id="pay-amount"
                className="input num"
                inputMode="decimal"
                autoFocus
                placeholder={String(balance)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setAmount(String(balance))}
              >
                Todo el saldo
              </button>
            </div>
            <div className="chips" role="group" aria-label="Medio de pago">
              {PAYMENT_METHOD.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="chip"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            {payError && (
              <p className="omodal__err" role="alert">
                {payError}
              </p>
            )}
            <div className="osum2__pay-row">
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar pago'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setPaying(false)
                  setPayError(null)
                  setMethod(null)
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
        <OrderPayments
          orderId={order.id}
          reloadKey={paymentsKey}
          onVoided={onPaymentVoided}
        />
      </div>

      {(showDescription || hasLegacy || notes) && (
        <div className="osum2__block osum2__details">
          {showDescription && (
            <>
              <h3 className="osum__heading">Descripción</h3>
              <p className="osum__text">{extra}</p>
            </>
          )}
          {hasLegacy && (
            <dl className="spec osum__legacy">
              {colors.length > 0 && (
                <div>
                  <dt>Colores</dt>
                  <dd>
                    <ul className="spec__colors">
                      {colors.map(({ part, color }) => {
                        const hex = swatchFor(color)
                        return (
                          <li key={part}>
                            <span
                              className="swatch"
                              style={hex ? { background: hex } : undefined}
                            />
                            {part}: {color}
                          </li>
                        )
                      })}
                    </ul>
                  </dd>
                </div>
              )}
              {order.measurements && (
                <div>
                  <dt>Medidas</dt>
                  <dd>{order.measurements}</dd>
                </div>
              )}
              {order.personalization && (
                <div>
                  <dt>Texto / personalización</dt>
                  <dd className="spec__engraving">{order.personalization}</dd>
                </div>
              )}
            </dl>
          )}
          {notes && (
            <>
              <h3 className="osum__heading">Notas</h3>
              <p className="osum__text osum__note">{notes}</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { formatMoney } from './format'
import {
  activePayments,
  methodLabel,
  PAYMENT_KIND_LABELS,
  type PaymentKind,
  type PaymentRow,
} from './payments'
import { listOrderPayments, voidOrderPayment } from './payments.api'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  })
}

// Cobros of an order: what came in, when, and how. Only an admin can void one.
export default function OrderPayments({
  orderId,
  reloadKey,
  onVoided,
}: {
  orderId: string
  reloadKey: number
  onVoided: () => void
}) {
  const { current, isAdmin } = useOperator()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    listOrderPayments(orderId)
      .then((list) => {
        if (alive) setRows(list)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [orderId, reloadKey])

  if (rows.length === 0) return null

  const activeIds = new Set(activePayments(rows).map((r) => r.id))

  function close() {
    setVoidingId(null)
    setReason('')
    setError(null)
  }

  async function submit(e: FormEvent, txId: string) {
    e.preventDefault()
    const text = reason.trim()
    if (!text) {
      setError('Escribí el motivo de la anulación.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await voidOrderPayment(txId, current?.id ?? null, text)
      close()
      onVoided()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo anular el cobro.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ul className="opay" aria-label="Cobros">
      {rows.map((tx) => {
        const voided = !activeIds.has(tx.id)
        const kind = tx.payment_kind
          ? (PAYMENT_KIND_LABELS[tx.payment_kind as PaymentKind] ?? 'Cobro')
          : 'Cobro'
        const line = (
          <>
            <span className="opay__date num">{shortDate(tx.transacted_at)}</span>
            <span className="opay__kind">{kind}</span>
            <span className="opay__method">{methodLabel(tx.method)}</span>
            <span className="opay__amount num">{formatMoney(tx.amount)}</span>
          </>
        )
        return (
          <li key={tx.id} className="opay__item">
            <div className="opay__row">
              {voided ? (
                <s className="opay__line">{line}</s>
              ) : (
                <span className="opay__line">{line}</span>
              )}
              {tx.note === 'migrado' && (
                <span className="opay__tag">migrado</span>
              )}
              {isAdmin && !voided && voidingId !== tx.id && (
                <button
                  type="button"
                  className="osum2__link"
                  onClick={() => {
                    close()
                    setVoidingId(tx.id)
                  }}
                >
                  Anular
                </button>
              )}
            </div>
            {voided && (
              <span className="opay__void">Anulado: {tx.void_reason}</span>
            )}
            {voidingId === tx.id && (
              <form
                className="osum2__pay"
                onSubmit={(e) => void submit(e, tx.id)}
                noValidate
              >
                <label className="field-label" htmlFor={`void-${tx.id}`}>
                  Motivo de la anulación
                </label>
                <input
                  id={`void-${tx.id}`}
                  className="input"
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {error && (
                  <p className="omodal__err" role="alert">
                    {error}
                  </p>
                )}
                <div className="osum2__pay-row">
                  <button
                    type="submit"
                    className="btn btn--primary btn--sm"
                    disabled={saving}
                  >
                    {saving ? 'Anulando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={close}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}

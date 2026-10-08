import { useEffect, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { logStamp, money, type FilamentSale } from './filaments'
import { listFilamentSales, voidFilamentSale } from './filaments.api'
import { PAYMENT_LABEL, type Payment } from './take'

// Latest filament sales for the admin: who sold what, for how much and how it
// was paid. A wrong sale is voided (with a reason), never erased.
export default function SalesPanel({
  reloadKey,
  onChanged,
}: {
  reloadKey: number
  onChanged: () => void
}) {
  const { current, byId } = useOperator()
  const [sales, setSales] = useState<FilamentSale[] | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listFilamentSales()
      .then((s) => alive && setSales(s))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.'))
    return () => {
      alive = false
    }
  }, [reloadKey])

  async function confirmVoid(id: string) {
    if (reason.trim() === '') return setError('Escribí el motivo de la anulación.')
    setBusy(true)
    setError(null)
    try {
      const updated = await voidFilamentSale(id, current?.id ?? null, reason.trim())
      setSales((prev) => prev?.map((s) => (s.id === id ? updated : s)) ?? null)
      setVoiding(null)
      setReason('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.')
    } finally {
      setBusy(false)
    }
  }

  if (sales == null) return error ? <p className="fl-error" role="alert">{error}</p> : null
  if (sales.length === 0) return null

  return (
    <section className="fl-sales" aria-label="Ventas de filamento">
      <h2 className="fl-sales__title">Ventas recientes</h2>
      {error && (
        <p className="fl-error" role="alert">
          {error}
        </p>
      )}
      <ul className="fl-sales__list">
        {sales.map((s) => (
          <li key={s.id} className={s.voided_at ? 'is-void' : undefined}>
            <span className="fl-sales__main">
              <strong>
                {s.quantity} × {s.color_label} · {s.line_label}
                {s.refill ? ' (recarga)' : ''}
              </strong>
              <span>
                {logStamp(s.created_at)} · {s.operator_id ? byId(s.operator_id)?.name : '—'}
                {s.customer ? ` · ${s.customer}` : ''}
              </span>
              {s.voided_at && <span>Anulada: {s.void_reason}</span>}
            </span>
            <span className="fl-sales__amount fl-mono">
              {money(s.total)} · {PAYMENT_LABEL[s.payment as Payment]}
            </span>
            {!s.voided_at &&
              (voiding === s.id ? (
                <span className="fl-sales__void">
                  <label className="fl-field">
                    Motivo de la anulación
                    <input
                      className="fl-input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button type="button" className="fl-btn" disabled={busy} onClick={() => confirmVoid(s.id)}>
                    Confirmar anulación
                  </button>
                  <button
                    type="button"
                    className="fl-btn"
                    disabled={busy}
                    onClick={() => {
                      setVoiding(null)
                      setReason('')
                      setError(null)
                    }}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="fl-btn"
                  aria-label={`Anular venta de ${s.color_label}`}
                  onClick={() => {
                    setVoiding(s.id)
                    setReason('')
                    setError(null)
                  }}
                >
                  Anular
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

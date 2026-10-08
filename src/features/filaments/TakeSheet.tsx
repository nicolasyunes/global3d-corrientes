import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import {
  colorPrice,
  money,
  type FilamentColor,
  type FilamentLine,
} from './filaments'
import { adjustFilament, sellFilament, takeFilament } from './filaments.api'
import {
  emptyTake,
  PAYMENT_LABEL,
  TAKE_REASONS,
  takeError,
  takeToast,
  type Payment,
  type TakeDraft,
} from './take'

// One color leaving the shelf (or, for an admin, an upward adjust): why, how
// many, and for a sale how it was paid. The price comes from the list.
export default function TakeSheet({
  line,
  color,
  refill,
  direction,
  onClose,
  onDone,
}: {
  line: FilamentLine
  color: FilamentColor
  refill: boolean
  direction: 'out' | 'in'
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { current, isAdmin } = useOperator()
  const adding = direction === 'in'
  const [draft, setDraft] = useState<TakeDraft>(
    emptyTake(adding ? 'adjust' : 'sale'),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const price = colorPrice(line, color, refill)
  const stock = refill ? (color.stock_refill ?? 0) : color.stock
  const available = adding ? Infinity : stock
  const label = `${color.name} · ${line.brand} ${line.name}${refill ? ' (recarga)' : ''}`
  const reasons = TAKE_REASONS.filter((r) => !r.adminOnly || isAdmin)
  const set = <K extends keyof TakeDraft>(k: K, v: TakeDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function confirm() {
    const problem = takeError(draft, available, price)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    const op = current?.id ?? null
    try {
      if (draft.reason === 'sale')
        await sellFilament(color.id, refill, draft.qty, draft.payment as Payment, op, draft.customer.trim())
      else if (draft.reason === 'adjust')
        await adjustFilament(color.id, refill, adding ? draft.qty : -draft.qty, op, draft.note.trim())
      else
        await takeFilament(color.id, refill, draft.qty, draft.reason, op, draft.note.trim())
      onDone(adding ? `Ajuste · +${draft.qty} × ${label}` : takeToast(draft, label, price))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  return (
    <div className="fl-modal" role="dialog" aria-modal="true" aria-label={adding ? 'Sumar' : 'Sacar'}>
      <button
        type="button"
        className="fl-drawer__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
      />
      <div className="fl-modal__panel">
        <header className="fl-drawer__head">
          <div>
            <p className="eyebrow">{adding ? 'Sumar al estante' : 'Sacar del estante'}</p>
            <h2>{label}</h2>
          </div>
          <button type="button" className="fl-icon fl-icon--lg" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="fl-drawer__body">
          {error && (
            <p className="fl-error" role="alert">
              {error}
            </p>
          )}
          {!adding && (
            <div className="fl-seg fl-take__reasons" role="group" aria-label="Motivo de salida">
              {reasons.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={draft.reason === r.value}
                  onClick={() => set('reason', r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <label className="fl-field">
            Cantidad
            <input
              className="fl-input fl-mono"
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.qty}
              onChange={(e) => set('qty', Number(e.target.value))}
            />
          </label>
          {!adding && <p className="fl-hint">Hay {stock} en el estante.</p>}

          {draft.reason === 'sale' && (
            <>
              <p className="fl-take__price">
                {price == null
                  ? 'Sin precio de lista'
                  : `${money(price)} c/u · Total ${money(price * (draft.qty || 0))}`}
              </p>
              <div className="fl-seg" role="group" aria-label="Forma de cobro">
                {(Object.keys(PAYMENT_LABEL) as Payment[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={draft.payment === p}
                    onClick={() => set('payment', p)}
                  >
                    {PAYMENT_LABEL[p]}
                  </button>
                ))}
              </div>
              <label className="fl-field">
                Cliente (opcional)
                <input
                  className="fl-input"
                  value={draft.customer}
                  onChange={(e) => set('customer', e.target.value)}
                />
              </label>
            </>
          )}

          {draft.reason !== 'sale' && (
            <label className="fl-field">
              {draft.reason === 'personal' || draft.reason === 'adjust' ? 'Motivo' : 'Nota (opcional)'}
              <input
                className="fl-input"
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </label>
          )}
        </div>
        <footer className="fl-drawer__foot">
          <button type="button" className="fl-btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={confirm} disabled={busy}>
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  )
}

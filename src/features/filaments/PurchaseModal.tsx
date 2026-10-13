import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import { colorPrice, isBoth, money, type FilamentLine } from './filaments'
import { moveFilament } from './filaments.api'
import { Dot, Stepper } from './parts'

type Qty = Record<string, number>
const key = (colorId: string, refill: boolean) =>
  `${colorId}:${refill ? 'r' : 's'}`

// What arrived from a supplier: pick the line, count spools per color and the
// stock goes up with a "compra" in the history.
export default function PurchaseModal({
  lines,
  initialLineId,
  onClose,
  onSaved,
}: {
  lines: readonly FilamentLine[]
  initialLineId: string | null
  onClose: () => void
  onSaved: (spools: number) => void
}) {
  const { current } = useOperator()
  const [lineId, setLineId] = useState(initialLineId ?? lines[0]?.id ?? '')
  const [qty, setQty] = useState<Qty>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const line = lines.find((l) => l.id === lineId) ?? null
  const both = line ? isBoth(line) : false

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const picked = line
    ? line.colors.flatMap((c) =>
        [false, true]
          .map((refill) => ({
            color: c,
            refill,
            n: qty[key(c.id, refill)] ?? 0,
          }))
          .filter((p) => p.n > 0),
      )
    : []
  const spools = picked.reduce((n, p) => n + p.n, 0)
  const total = line
    ? picked.reduce(
        (sum, p) => sum + p.n * (colorPrice(line, p.color, p.refill) ?? 0),
        0,
      )
    : 0

  function bump(colorId: string, refill: boolean, d: number) {
    setQty((prev) => ({
      ...prev,
      [key(colorId, refill)]: Math.max(
        0,
        (prev[key(colorId, refill)] ?? 0) + d,
      ),
    }))
  }

  async function save() {
    if (!line || spools === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const p of picked)
        await moveFilament(p.color.id, p.n, 'purchase', current?.id ?? null, {
          refill: p.refill,
          note: note.trim() || null,
        })
      onSaved(spools)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo registrar la compra.',
      )
      setBusy(false)
    }
  }

  return (
    <div
      className="fl-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar compra"
    >
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
            <p className="eyebrow">Filamentos</p>
            <h2>Registrar compra</h2>
          </div>
          <button
            type="button"
            className="fl-icon fl-icon--lg"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="fl-drawer__body">
          {error && (
            <p className="fl-error" role="alert">
              {error}
            </p>
          )}
          <label className="fl-field">
            Línea
            <select
              className="fl-input"
              value={lineId}
              onChange={(e) => {
                setLineId(e.target.value)
                setQty({})
              }}
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.brand} {l.name}
                </option>
              ))}
            </select>
          </label>
          {line && line.colors.length === 0 && (
            <p className="fl-quiet">Esta línea no tiene colores todavía.</p>
          )}
          {line && line.colors.length > 0 && (
            <ul className="fl-buy" aria-label="Bobinas que llegaron">
              {line.colors.map((c) => {
                const n =
                  (qty[key(c.id, false)] ?? 0) + (qty[key(c.id, true)] ?? 0)
                return (
                  <li key={c.id} className={n > 0 ? 'is-picked' : undefined}>
                    <Dot swatch={c.swatch} />
                    <span>
                      {c.name}
                      <small>
                        hay {c.stock + (c.stock_refill ?? 0)}
                        {c.finish !== 'Estándar' ? ` · ${c.finish}` : ''}
                      </small>
                    </span>
                    {both ? (
                      <span className="fl-buy__steps">
                        {c.spool_available && (
                          <span>
                            <small>SPOOL</small>
                            <Stepper
                              large
                              value={qty[key(c.id, false)] ?? 0}
                              label={`${c.name} con spool`}
                              onChange={(d) => bump(c.id, false, d)}
                            />
                          </span>
                        )}
                        <span>
                          <small>RECARGA</small>
                          <Stepper
                            large
                            value={qty[key(c.id, true)] ?? 0}
                            label={`${c.name} recarga`}
                            onChange={(d) => bump(c.id, true, d)}
                          />
                        </span>
                      </span>
                    ) : (
                      <Stepper
                        large
                        value={qty[key(c.id, false)] ?? 0}
                        label={c.name}
                        onChange={(d) => bump(c.id, false, d)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <label className="fl-field">
            Nota (opcional)
            <input
              className="fl-input"
              value={note}
              placeholder="Proveedor, factura…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        <footer className="fl-drawer__foot">
          <span className="fl-total" style={{ marginRight: 'auto' }}>
            {spools > 0
              ? `${spools} ${spools === 1 ? 'bobina' : 'bobinas'}${total ? ` · ${money(total)}` : ''}`
              : 'Sumá las bobinas que llegaron'}
          </span>
          <button
            type="button"
            className="fl-btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="fl-btn fl-btn--primary"
            disabled={busy || spools === 0}
            onClick={save}
          >
            <Icon name="cart" size={16} />
            {busy ? 'Guardando…' : 'Registrar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

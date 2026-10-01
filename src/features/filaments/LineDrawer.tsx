import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import {
  ACCENTS,
  FINISHES,
  KIND_TEXT,
  MATERIALS,
  money,
  moveWhen,
  parseMoney,
  PRESENTATION_LABEL,
  signed,
  type FilamentLine,
  type MovementKind,
  type Presentation,
} from './filaments'
import {
  deleteLine,
  listLineMovements,
  moveFilament,
  saveLine,
  type ColorDraft,
  type RemovedColor,
  type MovementWithColor,
} from './filaments.api'
import { Stepper } from './parts'

const SHOWN = 9
const PRESENTATIONS: Presentation[] = ['spool', 'refill', 'both']

interface Row extends ColorDraft {
  key: string
  priceText: string
  // Stock when the drawer opened; the difference is saved as an adjustment.
  was: number
  wasRefill: number | null
}

function toRows(line: FilamentLine | null): Row[] {
  return (line?.colors ?? []).map((c) => ({
    key: c.id,
    id: c.id,
    name: c.name,
    swatch: c.swatch,
    finish: c.finish,
    price: c.price,
    priceText: c.price == null ? '' : money(c.price),
    stock: c.stock,
    stock_refill: c.stock_refill,
    spool_available: c.spool_available,
    min_stock: c.min_stock,
    was: c.stock,
    wasRefill: c.stock_refill,
  }))
}

// A hex the native color input accepts; degradés keep their own value.
function asHex(swatch: string): string {
  return /^#[0-9a-f]{6}$/i.test(swatch) ? swatch : '#b8b0a6'
}

let seq = 0

// Side panel to create or edit a line: its data, colors with price, stock and
// minimum, and the latest movements.
export default function LineDrawer({
  line,
  position,
  onClose,
  onSaved,
  onBuy,
}: {
  line: FilamentLine | null
  position: number
  onClose: () => void
  onSaved: () => void
  onBuy: (line: FilamentLine) => void
}) {
  const { current, byId } = useOperator()
  const [brand, setBrand] = useState(line?.brand ?? '')
  const [name, setName] = useState(line?.name ?? '')
  const [material, setMaterial] = useState(line?.material ?? 'PLA')
  const [presentation, setPresentation] = useState<Presentation>(
    (line?.presentation as Presentation) ?? 'spool',
  )
  const [priceText, setPriceText] = useState(
    line?.price == null ? '' : money(line.price),
  )
  const [refillText, setRefillText] = useState(
    line?.refill_price == null ? '' : money(line.refill_price),
  )
  const [rows, setRows] = useState<Row[]>(() => toRows(line))
  const [removed, setRemoved] = useState<RemovedColor[]>([])
  const [adding, setAdding] = useState('')
  const [showAll, setShowAll] = useState(rows.length <= SHOWN + 2)
  const [moves, setMoves] = useState<MovementWithColor[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const brandRef = useRef<HTMLInputElement>(null)
  const both = presentation === 'both'

  useEffect(() => {
    if (!line) brandRef.current?.focus()
  }, [line])

  useEffect(() => {
    if (!line) return
    let alive = true
    listLineMovements(line.colors.map((c) => c.id))
      .then((m) => alive && setMoves(m))
      .catch(() => alive && setMoves([]))
    return () => {
      alive = false
    }
  }, [line])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const linePrice = parseMoney(priceText)
  const shown = showAll ? rows : rows.slice(0, SHOWN)
  const title = useMemo(() => {
    const t = [brand.trim(), name.trim()].filter(Boolean).join(' · ')
    return t || 'Nueva línea'
  }, [brand, name])

  function patch(key: string, fields: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...fields } : r)),
    )
  }

  function addColor() {
    const n = adding.trim()
    if (!n) return
    seq += 1
    setRows((prev) => [
      ...prev,
      {
        key: `new-${seq}`,
        id: null,
        name: n,
        swatch: '#b8b0a6',
        finish: 'Estándar',
        price: null,
        priceText: '',
        stock: 0,
        stock_refill: both ? 0 : null,
        spool_available: true,
        min_stock: 1,
        was: 0,
        wasRefill: both ? 0 : null,
      },
    ])
    setAdding('')
    setShowAll(true)
  }

  function remove(row: Row) {
    if (
      row.id &&
      (row.was > 0 || (row.wasRefill ?? 0) > 0) &&
      !window.confirm(
        `${row.name} tiene stock. ¿Borrarlo igual? Se pierde su historial.`,
      )
    )
      return
    setRows((prev) => prev.filter((r) => r.key !== row.key))
    if (row.id)
      setRemoved((prev) => [
        ...prev,
        { id: row.id!, name: row.name, spools: row.was + (row.wasRefill ?? 0) },
      ])
  }

  async function save() {
    if (!brand.trim() || !name.trim()) {
      setError('Poné la marca y el nombre de la línea.')
      return
    }
    if (rows.some((r) => !r.name.trim())) {
      setError('Hay un color sin nombre.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const drafts: ColorDraft[] = rows.map((r) => ({
        ...r,
        price: parseMoney(r.priceText),
        stock_refill: both ? (r.stock_refill ?? 0) : null,
      }))
      const { colorIds } = await saveLine(
        line?.id ?? null,
        {
          brand: brand.trim(),
          name: name.trim(),
          material,
          presentation,
          price: linePrice,
          refill_price:
            both || presentation === 'refill' ? parseMoney(refillText) : null,
          accent: line?.accent ?? ACCENTS[position % ACCENTS.length],
        },
        drafts,
        removed,
        position,
        current?.id ?? null,
      )
      const opId = current?.id ?? null
      const adjust = (id: string, d: number, refill: boolean) =>
        d === 0 ? null : moveFilament(id, d, 'adjust', opId, { refill })
      await Promise.all(
        rows.flatMap((r, i) => [
          adjust(colorIds[i], r.stock - r.was, false),
          both
            ? adjust(
                colorIds[i],
                (r.stock_refill ?? 0) - (r.wasRefill ?? 0),
                true,
              )
            : null,
        ]),
      )
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  async function removeLine() {
    if (!line) return
    if (
      !window.confirm(
        `¿Borrar ${line.brand} ${line.name} con sus ${line.colors.length} colores y su historial?`,
      )
    )
      return
    setBusy(true)
    try {
      await deleteLine(line, current?.id ?? null)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fl-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Editar línea de filamento"
    >
      <button
        type="button"
        className="fl-drawer__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
      />
      <div className="fl-drawer__panel">
        <header className="fl-drawer__head">
          <div>
            <p className="eyebrow">Línea de filamento</p>
            <h2>{title}</h2>
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
          <div className="fl-fields">
            <label className="fl-field">
              Marca
              <input
                ref={brandRef}
                className="fl-input"
                value={brand}
                placeholder="Grilon3"
                onChange={(e) => setBrand(e.target.value)}
              />
            </label>
            <label className="fl-field">
              Nombre de la línea
              <input
                className="fl-input"
                value={name}
                placeholder="PLA"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="fl-field">
              Material
              <select
                className="fl-input"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                {MATERIALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="fl-field">
              {both ? 'Precio con spool' : 'Precio por bobina'}
              <input
                className="fl-input fl-mono"
                inputMode="numeric"
                value={priceText}
                placeholder="$0"
                onChange={(e) => setPriceText(e.target.value)}
              />
            </label>
          </div>

          <div className="fl-presentation">
            <span>Presentación</span>
            <div className="fl-seg" role="group" aria-label="Presentación">
              {PRESENTATIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={presentation === p}
                  onClick={() => {
                    setPresentation(p)
                    if (p === 'both')
                      setRows((prev) =>
                        prev.map((r) => ({
                          ...r,
                          stock_refill: r.stock_refill ?? 0,
                        })),
                      )
                  }}
                >
                  {PRESENTATION_LABEL[p]}
                </button>
              ))}
            </div>
            {both ? (
              <label className="fl-field fl-field--inline">
                <input
                  className="fl-input fl-mono"
                  inputMode="numeric"
                  aria-label="Precio de la recarga"
                  value={refillText}
                  placeholder="Precio recarga"
                  style={{ width: 150 }}
                  onChange={(e) => setRefillText(e.target.value)}
                />
              </label>
            ) : (
              <span>
                “Ambas” muestra dos columnas de stock, como Bambu Lab Lite.
              </span>
            )}
          </div>

          <section>
            <div className="fl-sec__head">
              <h3>Colores</h3>
              <span className="fl-mono">{rows.length}</span>
              <span>Precio vacío = usa el de la línea</span>
            </div>
            <div
              className={`fl-edit fl-edit--cols${both ? ' fl-edit--both' : ''}`}
              aria-hidden="true"
            >
              <span />
              <span>COLOR</span>
              <span>ACABADO</span>
              <span>{both ? 'SPOOL' : 'PRECIO'}</span>
              <span>{both ? 'RECARGA' : 'STOCK'}</span>
              <span>MÍNIMO</span>
              <span />
            </div>
            {shown.map((r) => (
              <div
                key={r.key}
                className={`fl-edit${both ? ' fl-edit--both' : ''}`}
              >
                <label
                  className="fl-swatch"
                  style={{ background: r.swatch }}
                  title="Cambiar color de muestra"
                >
                  <input
                    type="color"
                    aria-label={`Color de muestra de ${r.name || 'color nuevo'}`}
                    value={asHex(r.swatch)}
                    onChange={(e) => patch(r.key, { swatch: e.target.value })}
                  />
                </label>
                <input
                  className="fl-edit__name"
                  aria-label="Nombre del color"
                  value={r.name}
                  onChange={(e) => patch(r.key, { name: e.target.value })}
                />
                <select
                  aria-label={`Acabado de ${r.name}`}
                  value={r.finish}
                  onChange={(e) => patch(r.key, { finish: e.target.value })}
                >
                  {[...new Set([...FINISHES, r.finish])].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                {both ? (
                  <>
                    <span>
                      {r.spool_available ? (
                        <Stepper
                          value={r.stock}
                          label={`${r.name} con spool`}
                          onChange={(d) =>
                            patch(r.key, { stock: Math.max(0, r.stock + d) })
                          }
                        />
                      ) : (
                        <button
                          type="button"
                          className="fl-more"
                          onClick={() =>
                            patch(r.key, { spool_available: true })
                          }
                        >
                          + spool
                        </button>
                      )}
                    </span>
                    <span>
                      <Stepper
                        value={r.stock_refill ?? 0}
                        label={`${r.name} recarga`}
                        onChange={(d) =>
                          patch(r.key, {
                            stock_refill: Math.max(
                              0,
                              (r.stock_refill ?? 0) + d,
                            ),
                          })
                        }
                      />
                    </span>
                  </>
                ) : (
                  <>
                    <input
                      className="fl-edit__num"
                      inputMode="numeric"
                      aria-label={`Precio de ${r.name}`}
                      value={r.priceText}
                      placeholder={linePrice == null ? '$' : money(linePrice)}
                      onChange={(e) =>
                        patch(r.key, { priceText: e.target.value })
                      }
                    />
                    <span>
                      <Stepper
                        value={r.stock}
                        label={r.name}
                        onChange={(d) =>
                          patch(r.key, { stock: Math.max(0, r.stock + d) })
                        }
                      />
                    </span>
                  </>
                )}
                <input
                  className="fl-edit__num fl-edit__min"
                  inputMode="numeric"
                  aria-label={`Stock mínimo de ${r.name}`}
                  value={r.min_stock}
                  onChange={(e) =>
                    patch(r.key, {
                      min_stock: Math.max(
                        0,
                        Number(e.target.value.replace(/\D/g, '')) || 0,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="fl-icon"
                  aria-label={`Borrar ${r.name}`}
                  onClick={() => remove(r)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            {!showAll && rows.length > SHOWN && (
              <button
                type="button"
                className="fl-more"
                onClick={() => setShowAll(true)}
              >
                + {rows.length - SHOWN} colores más
              </button>
            )}
            <div className={`fl-edit${both ? ' fl-edit--both' : ''}`}>
              <span className="fl-swatch fl-swatch--new" aria-hidden="true">
                <Icon name="plus" size={14} />
              </span>
              <input
                className="fl-edit__name fl-edit__name--new"
                aria-label="Nuevo color"
                placeholder="Agregar color… (Enter)"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addColor()
                  }
                }}
                onBlur={addColor}
              />
            </div>
          </section>

          {line && (
            <section>
              <div className="fl-sec__head">
                <h3>Movimientos</h3>
                <span />
                <button
                  type="button"
                  className="fl-btn fl-btn--sm"
                  onClick={() => onBuy(line)}
                >
                  <Icon name="cart" size={15} />
                  Registrar compra
                </button>
              </div>
              {moves == null ? (
                <p className="fl-quiet">Cargando…</p>
              ) : moves.length === 0 ? (
                <p className="fl-quiet">
                  Todavía no hay movimientos en esta línea.
                </p>
              ) : (
                <ul className="fl-moves">
                  {moves.map((m) => (
                    <li key={m.id} className="fl-move">
                      <span
                        className={`fl-move__n fl-mono ${m.delta > 0 ? 'is-in' : 'is-out'}`}
                      >
                        {signed(m.delta)}
                      </span>
                      <span
                        className="fl-dot"
                        style={{ background: m.color?.swatch }}
                        aria-hidden="true"
                      />
                      <span className="fl-move__what">
                        {m.color?.name ?? 'Color borrado'}
                        {line.presentation === 'both' &&
                          (m.refill ? ' (recarga)' : ' (spool)')}{' '}
                        <span>
                          · {KIND_TEXT[m.kind as MovementKind] ?? m.kind}
                        </span>
                      </span>
                      <span className="fl-move__who">
                        {byId(m.operator_id)?.name ?? 'alguien'} ·{' '}
                        {moveWhen(m.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <footer className="fl-drawer__foot">
          {line && (
            <button
              type="button"
              className="fl-danger"
              disabled={busy}
              onClick={removeLine}
            >
              Borrar línea
            </button>
          )}
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
            disabled={busy}
            onClick={save}
          >
            <Icon name="check" size={16} />
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  )
}

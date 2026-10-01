import Icon from '@/components/Icon'
import {
  colorPrice,
  colorTotal,
  isBoth,
  lineSpools,
  lineSubtitle,
  money,
  stockState,
  type FilamentColor,
  type FilamentLine,
} from './filaments'
import { Dot, Stepper } from './parts'

export type MoveHandler = (
  line: FilamentLine,
  color: FilamentColor,
  delta: number,
  refill: boolean,
) => void

// One brand line with a row per color: stock with − / + and the price.
export default function LineCard({
  line,
  onMove,
  onEdit,
}: {
  line: FilamentLine
  onMove: MoveHandler
  onEdit: (line: FilamentLine) => void
}) {
  const both = isBoth(line)
  const title = `${line.brand} ${line.name}`
  return (
    <section
      className="fl-card"
      aria-label={title}
      style={{ '--fl-accent': line.accent ?? undefined } as React.CSSProperties}
    >
      <header className="fl-card__head">
        <span className="fl-card__title">
          <strong>
            {line.brand} <span>{line.name}</span>
          </strong>
          <span>{lineSubtitle(line)}</span>
        </span>
        <span className="fl-card__total">
          <span className="fl-mono">{lineSpools(line)} bob.</span>
          {!both && line.price != null && <span>{money(line.price)} c/u</span>}
        </span>
        <button
          type="button"
          className="fl-icon"
          aria-label={`Editar ${title}`}
          title="Editar línea"
          onClick={() => onEdit(line)}
        >
          <Icon name="edit" size={15} />
        </button>
      </header>

      {both ? (
        <>
          <div className="fl-row fl-row--both fl-row--cols" aria-hidden="true">
            <span />
            <span />
            <span>
              CON SPOOL<b>{money(line.price)}</b>
            </span>
            <span>
              RECARGA<b>{money(line.refill_price)}</b>
            </span>
          </div>
          {line.colors.map((c) => (
            <div
              key={c.id}
              className={`fl-row fl-row--both${colorTotal(c) === 0 ? ' is-out' : ''}`}
            >
              <Dot swatch={c.swatch} />
              <span className="fl-row__name">
                <span>{c.name}</span>
              </span>
              {c.spool_available ? (
                <Stepper
                  value={c.stock}
                  label={`${c.name} con spool`}
                  onChange={(d) => onMove(line, c, d, false)}
                />
              ) : (
                <span className="fl-none" aria-label="No viene con spool">
                  —
                </span>
              )}
              {c.stock_refill != null ? (
                <Stepper
                  value={c.stock_refill}
                  label={`${c.name} recarga`}
                  onChange={(d) => onMove(line, c, d, true)}
                />
              ) : (
                <span className="fl-none" aria-label="No viene como recarga">
                  —
                </span>
              )}
            </div>
          ))}
        </>
      ) : (
        line.colors.map((c) => {
          const state = stockState(c)
          return (
            <div
              key={c.id}
              className={`fl-row${state === 'out' ? ' is-out' : ''}`}
            >
              <Dot swatch={c.swatch} />
              <span className="fl-row__name">
                <span>{c.name}</span>
                {c.finish !== 'Estándar' && (
                  <span className="fl-tag">{c.finish}</span>
                )}
              </span>
              <span className={`fl-state fl-state--${state}`}>
                {state === 'out'
                  ? 'SIN STOCK'
                  : state === 'low'
                    ? `QUEDA${c.stock === 1 ? '' : 'N'} ${c.stock}`
                    : ''}
              </span>
              <Stepper
                value={c.stock}
                label={c.name}
                onChange={(d) => onMove(line, c, d, false)}
              />
              <span
                className={`fl-price fl-mono${c.price == null ? ' is-inherited' : ''}`}
              >
                {money(colorPrice(line, c))}
              </span>
            </div>
          )
        })
      )}
      {line.colors.length === 0 && (
        <p className="fl-quiet">Sin colores. Tocá el lápiz para agregarlos.</p>
      )}
    </section>
  )
}

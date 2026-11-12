import {
  baseMaterial,
  FAMILY_LABEL,
  groupByFamily,
  optionLabel,
  type FilamentLine,
} from './filaments'
import { Dot } from './parts'

// Colors with stock grouped by family, to answer "¿qué rojo tengo?" without
// going through every brand.
export default function ColorView({
  lines,
}: {
  lines: readonly FilamentLine[]
}) {
  const groups = groupByFamily(lines)
  if (groups.length === 0)
    return <p className="fl-empty">No hay colores con stock para mostrar.</p>
  return (
    <>
      <p className="fl-hint">
        Solo colores con stock, agrupados por familia. Sirve para responder
        “¿qué rojo tengo?” sin recorrer todas las marcas.
      </p>
      {groups.map((g) => (
        <section
          key={g.family}
          className="fl-fam"
          aria-label={FAMILY_LABEL[g.family]}
        >
          <div className="fl-fam__head">
            <span className="fl-fam__dots">
              {g.options.slice(0, 10).map((o) => (
                <Dot
                  key={`${o.color.id}-${o.refill}`}
                  swatch={o.color.swatch}
                />
              ))}
            </span>
            <h2>{FAMILY_LABEL[g.family]}</h2>
            <span>
              {g.spools} {g.spools === 1 ? 'bobina' : 'bobinas'} ·{' '}
              {g.options.length}{' '}
              {g.options.length === 1 ? 'opción' : 'opciones'}
            </span>
          </div>
          <div className="fl-tiles">
            {g.options.map((o) => (
              <div key={`${o.color.id}-${o.refill}`} className="fl-tile">
                <Dot swatch={o.color.swatch} />
                <span className="fl-tile__text">
                  <strong>{o.color.name}</strong>
                  <span>
                    {optionLabel(o)} · {baseMaterial(o.line.material)}
                  </span>
                </span>
                <span className="fl-tile__n">
                  <span
                    className={`fl-mono${o.spools <= o.color.min_stock ? ' is-low' : ''}`}
                  >
                    {o.spools}
                  </span>
                  <span>bob.</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

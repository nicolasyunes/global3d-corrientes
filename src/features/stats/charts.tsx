import type { ShareRow, WeekBar } from './summary'

const W = 56 // width of a week slot
const H = 170 // plot height
const TOP = 22 // room for the number above the tallest bar
const BASE = H - 24 // y of the baseline (labels go below)

// Orders per week as SVG bars. A visually hidden table repeats the data.
export function WeeklyBars({ bars }: { bars: WeekBar[] }) {
  const max = Math.max(...bars.map((b) => b.count), 0)
  if (max === 0) return <p className="st-quiet">Sin pedidos en estas semanas.</p>
  const plot = BASE - TOP
  return (
    <>
      <svg
        className="st-chart"
        viewBox={`0 0 ${bars.length * W} ${H}`}
        role="img"
        aria-label="Pedidos por semana"
      >
        <line className="st-axis" x1="0" x2={bars.length * W} y1={BASE} y2={BASE} />
        {bars.map((b, i) => {
          const h = Math.max(b.count > 0 ? 2 : 0, Math.round((b.count / max) * plot))
          const x = i * W + 10
          return (
            <g key={b.label + i}>
              <rect
                className={`st-bar${b.partial ? ' is-partial' : ''}`}
                x={x}
                y={BASE - h}
                width={W - 20}
                height={h}
                rx="3"
              />
              <text className="st-bar__value" x={x + (W - 20) / 2} y={BASE - h - 6} textAnchor="middle">
                {b.count}
              </text>
              <text className="st-bar__label" x={x + (W - 20) / 2} y={H - 6} textAnchor="middle">
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
      <table className="visually-hidden" aria-label="Pedidos por semana (tabla)">
        <thead>
          <tr>
            <th>Semana desde</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// Share list: label, a CSS bar, the value and its percentage (always written).
export function ShareBars({
  rows,
  format,
  empty,
  label,
}: {
  rows: ShareRow[]
  format: (value: number) => string
  empty: string
  label: string
}) {
  if (rows.length === 0) return <p className="st-quiet">{empty}</p>
  return (
    <ol className="st-shares" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="st-share">
          <span className="st-share__label">{r.label}</span>
          <span className="st-share__track" aria-hidden="true">
            <span className="st-share__fill" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="st-share__value num">
            {format(r.value)} · {r.pct}%
          </span>
        </li>
      ))}
    </ol>
  )
}

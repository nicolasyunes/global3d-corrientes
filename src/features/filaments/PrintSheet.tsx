import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  colorPrice,
  isBoth,
  money,
  selectForExport,
  type ExportOptions,
  type FilamentLine,
} from './filaments'

const TODAY = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function exportSummary({ brands, stock }: ExportOptions): string {
  const who = brands ? `Marcas: ${brands.join(', ')}` : 'Todas las marcas'
  const what =
    stock === 'with'
      ? 'Solo con stock'
      : stock === 'without'
        ? 'Solo sin stock'
        : 'Con y sin stock'
  return `${who} · ${what}`
}

// The page that gets printed: the palette of every chosen line, each color a
// real swatch. It stays hidden on screen; printing hides the rest of the app
// and shows only this, so "Guardar como PDF" gets exactly the palette.
export default function PrintSheet({
  lines,
  options,
  onDone,
}: {
  lines: readonly FilamentLine[]
  options: ExportOptions
  onDone: () => void
}) {
  const chosen = selectForExport(lines, options)
  // The page passes a fresh callback each render; printing must run once.
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    document.body.classList.add('fl-printing')
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      document.body.classList.remove('fl-printing')
      window.removeEventListener('afterprint', finish)
      done.current()
    }
    window.addEventListener('afterprint', finish)
    // Two frames so the sheet is laid out before the print dialog opens.
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (typeof window.print === 'function') window.print()
        else finish()
      }),
    )
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', finish)
      document.body.classList.remove('fl-printing')
    }
  }, [])

  const total = chosen.reduce((n, l) => n + l.colors.length, 0)

  return createPortal(
    <div className="fl-print" aria-hidden="true">
      <header className="fl-print__head">
        <h1>Paleta de filamentos</h1>
        <p>
          Global 3D Corrientes · {TODAY.format(new Date())} · {total} colores
        </p>
        <p>{exportSummary(options)}</p>
      </header>
      {chosen.map((line) => (
        <section key={line.id} className="fl-print__line">
          <h2>
            {line.brand} <span>{line.name}</span>
            <small>
              {line.material}
              {isBoth(line) ? ' · spool y recarga' : ''}
            </small>
          </h2>
          <ul>
            {line.colors.map((c) => {
              const spools = isBoth(line)
                ? `spool ${c.stock} · recarga ${c.stock_refill ?? 0}`
                : `${c.stock} bob.`
              const out = c.stock + (c.stock_refill ?? 0) === 0
              const price = colorPrice(line, c)
              return (
                <li key={c.id}>
                  <span
                    className="fl-print__dot"
                    style={{ background: c.swatch }}
                  />
                  <span className="fl-print__name">
                    {c.name}
                    {c.finish !== 'Estándar' && <em>{c.finish}</em>}
                  </span>
                  {options.showStock && (
                    <span className="fl-print__meta">
                      {out ? 'sin stock' : spools}
                    </span>
                  )}
                  {options.showPrice && price != null && (
                    <span className="fl-print__meta">{money(price)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>,
    document.body,
  )
}

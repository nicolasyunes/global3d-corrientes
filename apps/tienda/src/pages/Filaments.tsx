import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useShop } from '../lib/data'
import { ars } from '../lib/format'
import type { FilamentLine } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { waLink } from '../lib/whatsapp'
import { LoadError } from './states'

export function Filaments() {
  usePageTitle('Filamentos')
  const { settings } = useShop()
  const [lines, setLines] = useState<FilamentLine[] | null>(null)
  const [error, setError] = useState(false)
  const [onlyStock, setOnlyStock] = useState(true)
  const [material, setMaterial] = useState<string>('todos')

  const load = () => {
    setError(false)
    api
      .filaments()
      .then(setLines)
      .catch(() => setError(true))
  }
  useEffect(load, [])

  const materials = lines
    ? Array.from(new Set(lines.map((l) => l.material)))
    : []
  const shown = (lines ?? [])
    .filter((l) => material === 'todos' || l.material === material)
    .map((l) => ({
      ...l,
      colors: onlyStock
        ? l.colors.filter((c) => c.stock > 0 || c.refillStock > 0)
        : l.colors,
    }))
    .filter((l) => l.colors.length > 0)

  return (
    <div className="container">
      <div className="page-title">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>Filamentos</h1>
        <p className="muted">
          Stock del local, actualizado. Tocá un color para reservarlo por
          WhatsApp. Mayorista: consultanos por cantidad.
        </p>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="chip"
          aria-pressed={material === 'todos'}
          onClick={() => setMaterial('todos')}
        >
          Todos
        </button>
        {materials.map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            aria-pressed={material === m}
            onClick={() => setMaterial(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="chip"
        aria-pressed={onlyStock}
        onClick={() => setOnlyStock(!onlyStock)}
        style={{ marginBottom: 20 }}
      >
        Solo con stock
      </button>

      {error && <LoadError onRetry={load} />}
      {!lines && !error && <div className="skeleton" style={{ height: 300 }} />}
      {lines && shown.length === 0 && (
        <div className="empty">
          <h3>No hay colores con stock en este material</h3>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOnlyStock(false)}
          >
            Ver todos los colores
          </button>
        </div>
      )}
      <div className="stack">
        {shown.map((l) => (
          <section
            key={l.id}
            className="panel fil-line"
            aria-labelledby={`l-${l.id}`}
          >
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 id={`l-${l.id}`} style={{ fontSize: '1.2rem' }}>
                {l.brand} {l.name}
                <span
                  className="muted"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  {' '}
                  · {l.material} · 1 kg
                </span>
              </h2>
              <span className="price num">
                {ars(l.price)}
                {l.refillPrice ? (
                  <span
                    className="muted"
                    style={{ fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    {' '}
                    · recarga {ars(l.refillPrice)}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="fil-colors">
              {l.colors.map((c) => {
                const units = c.stock + c.refillStock
                const text = `¡Hola Global3D! Quiero reservar 1 rollo de ${l.brand} ${l.name} color ${c.name} (${ars(c.price)}).`
                return (
                  <a
                    key={c.id}
                    className="fil-color"
                    href={waLink(settings.whatsapp, text)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span
                      className={units > 0 ? 'swatch' : 'swatch off'}
                      style={{ background: c.swatch ?? 'var(--surface-2)' }}
                      aria-hidden="true"
                    />
                    <span>
                      {c.name}
                      <small>
                        {units > 0
                          ? units <= 2
                            ? `Quedan ${units}`
                            : `${units} en el local`
                          : 'Sin stock · encargalo'}
                      </small>
                    </span>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

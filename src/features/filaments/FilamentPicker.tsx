import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import {
  colorFamily,
  FAMILIES,
  FAMILY_LABEL,
  familyOptions,
  MATERIAL_TABS,
  optionLabel,
  type ColorOption,
  type FilamentLine,
} from './filaments'
import { listLines } from './filaments.api'
import { Dot } from './parts'
import './filaments.css'

let cache: Promise<FilamentLine[]> | null = null

// Lines for the piece selector, read once per visit to the app.
export function useFilamentLines(): FilamentLine[] | null {
  const [lines, setLines] = useState<FilamentLine[] | null>(null)
  useEffect(() => {
    let alive = true
    cache ??= listLines().catch((err) => {
      cache = null
      throw err
    })
    cache.then((l) => alive && setLines(l)).catch(() => alive && setLines([]))
    return () => {
      alive = false
    }
  }, [])
  return lines
}

export function filamentLabel(
  lines: readonly FilamentLine[] | null,
  id: string | null | undefined,
): string | null {
  if (!id || !lines) return null
  for (const line of lines) {
    if (line.colors.some((c) => c.id === id))
      return `${line.brand} ${line.name}`
  }
  return null
}

function fold(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface FilamentChoice {
  color: string
  filamentId: string | null
}

// Listbox to pick the filament of a piece: colors grouped by family, each
// brand with its stock. Out of stock shows dimmed but can still be chosen.
export default function FilamentPicker({
  pieceLabel,
  value,
  toPaintLabel,
  onPick,
}: {
  pieceLabel: string
  value: string | null
  toPaintLabel: string
  onPick: (choice: FilamentChoice) => void
}) {
  const lines = useFilamentLines()
  const [query, setQuery] = useState('')
  const [material, setMaterial] = useState('all')

  const q = fold(query.trim())
  const options = familyOptions(
    (lines ?? []).filter(
      (l) =>
        material === 'all' ||
        l.material === material ||
        (material === 'PLA' && l.material === 'PLA especial'),
    ),
  ).filter(
    (o: ColorOption) =>
      q === '' ||
      fold(`${o.color.name} ${o.line.brand} ${o.line.name}`).includes(q),
  )
  // A color sold both ways is one choice here, with both stocks added up.
  const seen = new Set<string>()
  const merged = options
    .map((o) =>
      o.line.presentation === 'both'
        ? { ...o, spools: o.color.stock + (o.color.stock_refill ?? 0) }
        : o,
    )
    .filter((o) => !seen.has(o.color.id) && (seen.add(o.color.id), true))
  const groups = FAMILIES.map((family) => ({
    family,
    options: merged
      .filter((o) => colorFamily(o.color) === family)
      .sort((a, b) => b.spools - a.spools),
  })).filter((g) => g.options.length > 0)

  return (
    <div className="fl-picker">
      <p className="fl-picker__title">
        Pieza <b>{pieceLabel}</b> · elegir filamento
      </p>
      <label className="fl-search">
        <Icon name="search" size={16} />
        <input
          placeholder="Buscar color o marca…"
          aria-label="Buscar color o marca"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="fl-seg" role="group" aria-label="Material">
        {[
          'all',
          'PLA',
          ...MATERIAL_TABS.filter((m) => m !== 'PLA' && m !== 'PLA especial'),
        ].map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={material === m}
            onClick={() => setMaterial(m)}
          >
            {m === 'all' ? 'Todos' : m}
          </button>
        ))}
      </div>
      <div
        className="fl-pop__list"
        role="listbox"
        aria-label="Elegir filamento"
      >
        <button
          type="button"
          role="option"
          aria-selected={false}
          className="fl-opt fl-opt--paint"
          onClick={() => onPick({ color: toPaintLabel, filamentId: null })}
        >
          <span className="fl-dot" aria-hidden="true" />
          <span className="fl-opt__label">Para pintar</span>
          <span>cualquier filamento claro</span>
        </button>
        {lines == null && <p className="fl-quiet">Cargando filamentos…</p>}
        {lines != null && groups.length === 0 && (
          <p className="fl-quiet">
            {lines.length === 0
              ? 'Todavía no hay filamentos cargados.'
              : 'Nada coincide con la búsqueda.'}
          </p>
        )}
        {groups.map((g) => (
          <div
            key={g.family}
            className="fl-pop__group"
            role="group"
            aria-label={FAMILY_LABEL[g.family]}
          >
            <span className="fl-pop__fam">
              <Dot swatch={g.options[0].color.swatch} />
              {FAMILY_LABEL[g.family]}
            </span>
            {g.options.map((o) => {
              const out = o.spools === 0
              const selected = o.color.id === value
              return (
                <button
                  key={o.color.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`fl-opt${out ? ' is-out' : ''}`}
                  onClick={() =>
                    onPick({ color: o.color.name, filamentId: o.color.id })
                  }
                >
                  <Dot swatch={o.color.swatch} />
                  <span className="fl-opt__label">
                    {o.color.name}{' '}
                    <span className="fl-opt__line">
                      ·{' '}
                      {o.line.presentation === 'both'
                        ? `${o.line.brand} ${o.line.name}`
                        : optionLabel(o)}
                    </span>
                  </span>
                  <span className="fl-opt__n fl-mono">
                    {out ? 'sin stock' : `${o.spools} bob.`}
                  </span>
                  {selected && <Icon name="check" size={15} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="fl-pop__note">
        Los que no tienen stock aparecen apagados; se pueden elegir igual para
        anotar la compra.
      </p>
    </div>
  )
}

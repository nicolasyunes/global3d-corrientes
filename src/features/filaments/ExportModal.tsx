import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import {
  brandsOf,
  selectForExport,
  type ExportOptions,
  type FilamentLine,
  type StockFilter,
} from './filaments'

const STOCK: [StockFilter, string][] = [
  ['all', 'Con y sin stock'],
  ['with', 'Solo con stock'],
  ['without', 'Solo sin stock'],
]

// Options for the PDF: which brands, with or without stock, and whether the
// quantities and prices go on the page (leave them off to show the palette).
export default function ExportModal({
  lines,
  onClose,
  onExport,
}: {
  lines: readonly FilamentLine[]
  onClose: () => void
  onExport: (options: ExportOptions) => void
}) {
  const brands = brandsOf(lines)
  const [all, setAll] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [stock, setStock] = useState<StockFilter>('all')
  const [showStock, setShowStock] = useState(false)
  const [showPrice, setShowPrice] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const options: ExportOptions = {
    brands: all ? null : picked,
    stock,
    showStock,
    showPrice,
  }
  const chosen = selectForExport(lines, options)
  const colors = chosen.reduce((n, l) => n + l.colors.length, 0)
  const brandCount = new Set(chosen.map((l) => l.brand)).size

  function toggle(brand: string) {
    setPicked((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    )
  }

  return (
    <div
      className="fl-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Exportar a PDF"
    >
      <button
        type="button"
        className="fl-drawer__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="fl-modal__panel">
        <header className="fl-drawer__head">
          <div>
            <p className="eyebrow">Filamentos</p>
            <h2>Exportar a PDF</h2>
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
          <fieldset className="fl-opt-group">
            <legend>Marcas</legend>
            <div className="fl-seg" role="group" aria-label="Marcas">
              <button
                type="button"
                aria-pressed={all}
                onClick={() => setAll(true)}
              >
                Todas
              </button>
              <button
                type="button"
                aria-pressed={!all}
                onClick={() => setAll(false)}
              >
                Elegir marcas
              </button>
            </div>
            {!all && (
              <ul className="fl-brands">
                {brands.map((b) => (
                  <li key={b}>
                    <label className="fl-check">
                      <input
                        type="checkbox"
                        checked={picked.includes(b)}
                        onChange={() => toggle(b)}
                      />
                      {b}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className="fl-opt-group">
            <legend>Stock</legend>
            <div className="fl-seg" role="group" aria-label="Stock">
              {STOCK.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={stock === value}
                  onClick={() => setStock(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="fl-opt-group">
            <legend>Qué mostrar con cada color</legend>
            <label className="fl-check">
              <input
                type="checkbox"
                checked={showStock}
                onChange={(e) => setShowStock(e.target.checked)}
              />
              Cantidad de bobinas
            </label>
            <label className="fl-check">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
              />
              Precio
            </label>
            <p className="fl-quiet">
              Sin marcar, el PDF queda como paleta de colores para mostrar.
            </p>
          </fieldset>
        </div>

        <footer className="fl-drawer__foot">
          <span className="fl-total" style={{ marginRight: 'auto' }}>
            {colors === 0
              ? 'No hay colores con esa selección'
              : `${colors} ${colors === 1 ? 'color' : 'colores'} en ${brandCount} ${
                  brandCount === 1 ? 'marca' : 'marcas'
                }`}
          </span>
          <button type="button" className="fl-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="fl-btn fl-btn--primary"
            disabled={colors === 0}
            onClick={() => onExport(options)}
          >
            <Icon name="download" size={16} />
            Generar PDF
          </button>
        </footer>
      </div>
    </div>
  )
}

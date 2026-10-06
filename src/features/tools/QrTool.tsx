import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { downloadBlob, svgDataUrl, svgToPng } from './download'
import {
  contrastRatio,
  ERROR_LEVELS,
  isInverted,
  normalizeLink,
  qrMatrix,
  qrSvg,
  type ErrorLevel,
  type QrMatrix,
} from './qr'

// Below this a 0.4 mm nozzle can't draw the modules cleanly enough to scan.
const MIN_MODULE_MM = 0.8

type QrResult = { matrix: QrMatrix; svg: string } | { error: string } | null

export default function QrTool() {
  const [toast, showToast] = useToast()
  const [link, setLink] = useState('')
  const [level, setLevel] = useState<ErrorLevel>('M')
  const [margin, setMargin] = useState(4)
  const [fg, setFg] = useState('#000000')
  const [bg, setBg] = useState('#ffffff')
  const [transparent, setTransparent] = useState(false)
  const [sizeMm, setSizeMm] = useState('')

  const text = normalizeLink(link)
  const mm = Number(sizeMm.replace(',', '.')) || null

  const result = useMemo((): QrResult => {
    if (!text) return null
    try {
      const matrix = qrMatrix(text, level)
      const svg = qrSvg(matrix, {
        margin,
        fg,
        bg: transparent ? null : bg,
        sizeMm: mm,
      })
      return { matrix, svg }
    } catch {
      return { error: 'El texto es demasiado largo para un QR.' }
    }
  }, [text, level, margin, fg, bg, transparent, mm])

  const warnings: string[] = []
  if (!transparent && contrastRatio(fg, bg) < 3)
    warnings.push('Poco contraste entre colores: puede no escanear.')
  if (!transparent && isInverted(fg, bg))
    warnings.push('QR claro sobre fondo oscuro: algunos celulares no lo leen.')
  const moduleMm =
    result && 'matrix' in result && mm
      ? mm / (result.matrix.size + margin * 2)
      : null
  if (moduleMm != null && moduleMm < MIN_MODULE_MM)
    warnings.push(
      `Cada cuadradito mide ${moduleMm.toFixed(2)} mm: para imprimir en 3D agrandá el QR o bajá la corrección.`,
    )

  async function downloadPng() {
    if (!result || !('svg' in result)) return
    downloadBlob('qr.png', await svgToPng(result.svg, 1024))
  }

  return (
    <div className="tools">
      <section className="card tools__panel">
        <label className="field-label" htmlFor="qr-link">
          Link o texto
        </label>
        <input
          id="qr-link"
          className="input"
          placeholder="global3d.com.ar/tienda"
          value={link}
          autoFocus
          onChange={(e) => setLink(e.target.value)}
        />
        {text && text !== link.trim() && (
          <p className="tools__hint">
            Se codifica como <strong>{text}</strong>
          </p>
        )}

        <p className="field-label">Corrección de errores</p>
        <div
          className="segmented"
          role="group"
          aria-label="Corrección de errores"
        >
          {ERROR_LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setLevel(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="tools__hint">
          Más corrección aguanta rayones o un logo encima, pero agrega
          cuadraditos.
        </p>

        <div className="tools__row">
          <div>
            <label className="field-label" htmlFor="qr-fg">
              Color
            </label>
            <input
              id="qr-fg"
              type="color"
              className="tools__color"
              value={fg}
              onChange={(e) => setFg(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="qr-bg">
              Fondo
            </label>
            <input
              id="qr-bg"
              type="color"
              className="tools__color"
              value={bg}
              disabled={transparent}
              onChange={(e) => setBg(e.target.value)}
            />
          </div>
          <label className="tools__check">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Sin fondo
          </label>
        </div>

        <div className="tools__row">
          <div>
            <label className="field-label" htmlFor="qr-margin">
              Margen: {margin}
            </label>
            <input
              id="qr-margin"
              type="range"
              min={0}
              max={8}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="qr-mm">
              Tamaño (mm)
            </label>
            <input
              id="qr-mm"
              className="input num"
              inputMode="decimal"
              placeholder="sin medida"
              value={sizeMm}
              onChange={(e) => setSizeMm(e.target.value)}
            />
          </div>
        </div>
        <p className="tools__hint">
          Con tamaño en mm el SVG entra a Bambu Studio u OpenSCAD con la medida
          real.
        </p>
      </section>

      <section className="card tools__preview">
        {!result && (
          <div className="empty">
            <strong>Escribí un link</strong>
            El QR aparece acá al instante.
          </div>
        )}
        {result && 'error' in result && (
          <p className="banner banner--error">{result.error}</p>
        )}
        {result && 'svg' in result && (
          <>
            <div className="tools__canvas tools__canvas--checker">
              <img src={svgDataUrl(result.svg)} alt={`QR de ${text}`} />
            </div>
            <p className="tools__hint">
              {result.matrix.size}×{result.matrix.size} cuadraditos
              {moduleMm != null && ` · ${moduleMm.toFixed(2)} mm cada uno`}
            </p>
            {warnings.map((w) => (
              <p key={w} className="tools__warn">
                <Icon name="alert" size={16} /> {w}
              </p>
            ))}
            <div className="tools__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  downloadBlob(
                    'qr.svg',
                    new Blob([result.svg], { type: 'image/svg+xml' }),
                  )
                }
              >
                <Icon name="download" /> SVG
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={downloadPng}
              >
                <Icon name="download" /> PNG
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(result.svg)
                    .then(() => showToast('SVG copiado'))
                }
              >
                <Icon name="copy" /> Copiar SVG
              </button>
            </div>
          </>
        )}
      </section>
      {toast}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { downloadBlob, fileBase, svgDataUrl } from './download'
import {
  DEFAULT_OPTIONS,
  DETAILS,
  fitSize,
  vectorize,
  type Pixels,
  type VectorOptions,
  type VectorResult,
} from './vectorize'

interface Source {
  name: string
  url: string
  pixels: Pixels
}

async function readImage(file: File): Promise<Source> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Sin canvas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const { data } = ctx.getImageData(0, 0, width, height)
  return {
    name: file.name,
    url: URL.createObjectURL(file),
    pixels: { width, height, data },
  }
}

export default function VectorizeTool() {
  const [source, setSource] = useState<Source | null>(null)
  const [options, setOptions] = useState<VectorOptions>(DEFAULT_OPTIONS)
  const [widthMm, setWidthMm] = useState('')
  const [result, setResult] = useState<VectorResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof VectorOptions>(
    key: K,
    value: VectorOptions[K],
  ) => setOptions((o) => ({ ...o, [key]: value }))

  async function load(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError('Subí una imagen PNG, JPG o WEBP.')
      return
    }
    try {
      setError('')
      const next = await readImage(file)
      setSource((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return next
      })
    } catch {
      setError('No se pudo leer la imagen.')
    }
  }

  // Tracing blocks the main thread for a moment: debounce, and let the
  // "Procesando" state paint before starting.
  useEffect(() => {
    if (!source) return
    setBusy(true)
    const timer = setTimeout(() => {
      try {
        const mm = Number(widthMm.replace(',', '.')) || null
        setResult(vectorize(source.pixels, { ...options, widthMm: mm }))
        setError('')
      } catch {
        setError('No se pudo vectorizar esta imagen.')
      } finally {
        setBusy(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [source, options, widthMm])

  const kb = result ? Math.round(new Blob([result.svg]).size / 1024) : 0

  return (
    <div className="tools">
      <section className="card tools__panel">
        <button
          type="button"
          className={`tools__drop${over ? ' is-over' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void load(e.dataTransfer.files[0])
          }}
        >
          <Icon name="upload" size={22} />
          <strong>{source ? source.name : 'Subir imagen'}</strong>
          <span>PNG, JPG o WEBP · clic o arrastrar</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => void load(e.target.files?.[0])}
        />
        {error && <p className="banner banner--error">{error}</p>}

        <p className="field-label">Tipo</p>
        <div className="segmented" role="group" aria-label="Tipo de imagen">
          <button
            type="button"
            aria-pressed={options.mode === 'mono'}
            onClick={() => set('mode', 'mono')}
          >
            Logo de un color
          </button>
          <button
            type="button"
            aria-pressed={options.mode === 'color'}
            onClick={() => set('mode', 'color')}
          >
            Varios colores
          </button>
        </div>

        {options.mode === 'mono' ? (
          <>
            <label className="field-label" htmlFor="vec-threshold">
              Umbral: {options.threshold}
            </label>
            <input
              id="vec-threshold"
              type="range"
              min={10}
              max={245}
              value={options.threshold}
              onChange={(e) => set('threshold', Number(e.target.value))}
            />
            <p className="tools__hint">
              Más alto toma también los grises claros como parte del logo.
            </p>
            <label className="tools__check">
              <input
                type="checkbox"
                checked={options.invert}
                onChange={(e) => set('invert', e.target.checked)}
              />
              Invertir (logo claro sobre fondo oscuro)
            </label>
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="vec-colors">
              Colores: {options.colors}
            </label>
            <input
              id="vec-colors"
              type="range"
              min={2}
              max={12}
              value={options.colors}
              onChange={(e) => set('colors', Number(e.target.value))}
            />
            <p className="tools__hint">
              Uno por filamento, contando el fondo si no lo quitás.
            </p>
          </>
        )}

        <p className="field-label">Detalle</p>
        <div className="segmented" role="group" aria-label="Detalle">
          {DETAILS.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={options.detail === d.value}
              onClick={() => set('detail', d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <label className="tools__check">
          <input
            type="checkbox"
            checked={options.removeBackground}
            onChange={(e) => set('removeBackground', e.target.checked)}
          />
          Quitar el fondo
        </label>

        <label className="field-label" htmlFor="vec-mm">
          Ancho final (mm)
        </label>
        <input
          id="vec-mm"
          className="input num"
          inputMode="decimal"
          placeholder="sin medida"
          value={widthMm}
          onChange={(e) => setWidthMm(e.target.value)}
        />
        <p className="tools__hint">
          Con medida el SVG entra a Bambu Studio u OpenSCAD ya en tamaño real.
        </p>
      </section>

      <section className="card tools__preview">
        {!source ? (
          <div className="empty">
            <strong>Subí un logo o dibujo</strong>
            Se convierte en el navegador: la imagen no sale de esta computadora.
          </div>
        ) : (
          <>
            <div className="tools__compare">
              <figure>
                <div className="tools__canvas">
                  <img src={source.url} alt="Original" />
                </div>
                <figcaption>Original</figcaption>
              </figure>
              <figure>
                <div className="tools__canvas tools__canvas--checker">
                  {result && (
                    <img src={svgDataUrl(result.svg)} alt="Vectorizado" />
                  )}
                  {busy && <span className="tools__busy">Procesando…</span>}
                </div>
                <figcaption>SVG</figcaption>
              </figure>
            </div>
            {result && (
              <>
                <p className="tools__hint">
                  {result.paths} formas · {kb} KB
                </p>
                <div className="tools__swatches" aria-label="Colores del SVG">
                  {result.colors.map((c) => (
                    <span key={c} title={c} style={{ background: c }} />
                  ))}
                </div>
                <div className="tools__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() =>
                      downloadBlob(
                        `${fileBase(source.name)}.svg`,
                        new Blob([result.svg], { type: 'image/svg+xml' }),
                      )
                    }
                  >
                    <Icon name="download" /> Descargar SVG
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import Icon from '@/components/Icon'
import { downloadBlob, fileBase } from './download'
import { hexToRgb, rgbToHex } from './laminas/color'
import { cropToGrid, gridFor, loadImage } from './laminas/grid'
import { esEstanca, pixelMesh } from './laminas/mesh'
import { masClaro, procesar } from './laminas/pipeline'
import { IMPRESORAS } from './laminas/printers'
import { medidaUtil, PRODUCTOS, type Producto } from './laminas/productos'
import { armarPrompt } from './laminas/prompt'
import type { Cuantizada } from './laminas/quantize'
import { build3mf } from './laminas/threemf'

const MAX_BYTES = 20 * 1024 * 1024

const STEPS = [
  { id: 'producto', label: '1. Producto' },
  { id: 'imagen', label: '2. Imagen' },
  { id: 'colores', label: '3. Colores' },
] as const
type StepId = (typeof STEPS)[number]['id']

interface Source {
  name: string
  url: string
}

function ZonePreview({ q, colors }: { q: Cuantizada; colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rgb = colors.map(hexToRgb)
    const out = ctx.createImageData(q.ancho, q.alto)
    for (let p = 0; p < q.indices.length; p++) {
      const c = rgb[q.indices[p]] ?? { r: 255, g: 255, b: 255 }
      out.data.set([c.r, c.g, c.b, 255], p * 4)
    }
    ctx.putImageData(out, 0, 0)
  }, [q, colors])
  return (
    <canvas
      ref={ref}
      className="laminas__canvas"
      width={q.ancho}
      height={q.alto}
      aria-label="Vista previa de las zonas de color"
    />
  )
}

export default function LaminasTool() {
  const [step, setStep] = useState<StepId>('producto')
  const [producto, setProducto] = useState<Producto>(PRODUCTOS[0])
  const [source, setSource] = useState<Source | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [descripcion, setDescripcion] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [n, setN] = useState(3)
  const [printer, setPrinter] = useState(IMPRESORAS[0].clave)
  const [result, setResult] = useState<Cuantizada | null>(null)
  const [filaments, setFilaments] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const util = medidaUtil(producto)
  const colores = Math.min(n, producto.max_colores)

  async function load(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Subí una imagen PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen pesa más de 20 MB.')
      return
    }
    setError('')
    imgRef.current = null
    setResult(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { name: file.name, url: URL.createObjectURL(file) }
    })
  }

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  // Quantizing + cleanup block the main thread for a moment: debounce and let
  // "Procesando" paint first.
  useEffect(() => {
    if (step !== 'colores' || !source || !area) return
    setBusy(true)
    const timer = setTimeout(async () => {
      try {
        imgRef.current ??= await loadImage(source.url)
        const g = gridFor(util.ancho, util.alto, area.width)
        const data = cropToGrid(imgRef.current, area, g.ancho, g.alto)
        const q = procesar(data, colores, g.pixelMm)
        setResult(q)
        setFilaments(q.paleta.map(rgbToHex))
        setError('')
      } catch {
        setError('No se pudo procesar la imagen.')
      } finally {
        setBusy(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [step, source, area, colores, util.ancho, util.alto])

  const impresora = IMPRESORAS.find((p) => p.clave === printer) ?? IMPRESORAS[0]
  const cabe = util.ancho <= impresora.cama[0] && util.alto <= impresora.cama[1]

  function descargar() {
    if (!result || !source) return
    setBusy(true)
    // let the button state paint before the heavy mesh work
    setTimeout(() => {
      try {
        const claro = masClaro(result)
        const partes = pixelMesh(
          result,
          util.ancho,
          util.alto,
          producto.espesor_base_mm,
          producto.espesor_mm,
        )
        if (!partes.every(esEstanca)) {
          setError('La malla no quedó cerrada; probá con menos colores.')
          return
        }
        const bytes = build3mf({
          partes,
          colores: filaments,
          extrusorDe: partes.map((p) => (p.zona ?? claro) + 1),
          titulo: `${producto.nombre} ${fileBase(source.name)}`,
          ancho: util.ancho,
          alto: util.alto,
          impresora,
        })
        downloadBlob(
          `${producto.id}-${fileBase(source.name)}.3mf`,
          new Blob([bytes as BlobPart], { type: 'model/3mf' }),
        )
        setError('')
      } catch {
        setError('No se pudo armar el 3MF.')
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        armarPrompt(producto, descripcion, producto.max_colores),
      )
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar; seleccioná el texto a mano.')
    }
  }

  const reached = (id: StepId) =>
    id === 'producto' || (id === 'imagen' ? true : !!source && !!area)

  return (
    <div className="laminas">
      <div className="segmented" role="group" aria-label="Paso">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={step === s.id}
            disabled={!reached(s.id)}
            onClick={() => setStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="banner banner--error">{error}</p>}

      {step === 'producto' && (
        <section className="card">
          <h2 className="card__title">¿Para qué producto es la lámina?</h2>
          <div className="laminas__products">
            {PRODUCTOS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="laminas__product"
                aria-pressed={producto.id === p.id}
                onClick={() => {
                  setProducto(p)
                  setN((v) => Math.min(v, p.max_colores))
                  setResult(null)
                }}
              >
                <strong>{p.nombre}</strong>
                <span>
                  {medidaUtil(p).ancho} × {medidaUtil(p).alto} mm · hasta{' '}
                  {p.max_colores} colores
                </span>
                <span>
                  Espesor {p.espesor_mm} mm (base {p.espesor_base_mm} mm)
                </span>
              </button>
            ))}
          </div>
          <div className="tools__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setStep('imagen')}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {step === 'imagen' && (
        <section className="card">
          <h2 className="card__title">
            Imagen para {producto.nombre} ({util.ancho} × {util.alto} mm)
          </h2>
          {!source ? (
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
              <strong>Subir imagen</strong>
              <span>PNG, JPG o WEBP hasta 20 MB · clic o arrastrar</span>
            </button>
          ) : (
            <>
              <div className="laminas__crop">
                <Cropper
                  image={source.url}
                  crop={crop}
                  zoom={zoom}
                  aspect={util.ancho / util.alto}
                  minZoom={0.5}
                  maxZoom={5}
                  restrictPosition={false}
                  objectFit="contain"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <label className="field-label" htmlFor="lam-zoom">
                Zoom
              </label>
              <input
                id="lam-zoom"
                type="range"
                min={0.5}
                max={5}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <p className="tools__hint">
                Arrastrá para encuadrar. Lo que quede fuera de la imagen sale
                blanco. {source.name}
              </p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => fileInput.current?.click()}
              >
                Cambiar imagen
              </button>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void load(e.target.files?.[0])}
          />

          <details className="laminas__prompt">
            <summary>Armar mi prompt para ChatGPT o Gemini</summary>
            <label className="field-label" htmlFor="lam-desc">
              ¿Qué querés ilustrar?
            </label>
            <textarea
              id="lam-desc"
              className="input"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <pre className="laminas__promptText">
              {armarPrompt(producto, descripcion, producto.max_colores)}
            </pre>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void copiar()}
            >
              {copiado ? 'Copiado' : 'Copiar prompt'}
            </button>
          </details>

          <div className="tools__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep('producto')}
            >
              Atrás
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!source || !area}
              onClick={() => setStep('colores')}
            >
              Siguiente
            </button>
          </div>
        </section>
      )}

      {step === 'colores' && (
        <div className="tools">
          <section className="card tools__panel">
            <p className="field-label">Cantidad de colores</p>
            <div className="segmented" role="group" aria-label="Colores">
              {Array.from(
                { length: producto.max_colores - 1 },
                (_, i) => i + 2,
              ).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={colores === v}
                  onClick={() => setN(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="tools__hint">
              Las zonas muy chicas o los degradés se funden con la vecina, así
              que pueden quedar menos.
            </p>

            <label className="field-label" htmlFor="lam-printer">
              Impresora
            </label>
            <select
              id="lam-printer"
              value={printer}
              onChange={(e) => setPrinter(e.target.value)}
            >
              {IMPRESORAS.map((p) => (
                <option key={p.clave} value={p.clave}>
                  {p.nombre} ({p.cama[0]} × {p.cama[1]})
                </option>
              ))}
            </select>
            {!cabe && (
              <p className="tools__warn">
                La lámina no entra en la cama de esta impresora.
              </p>
            )}

            {result && (
              <>
                <p className="field-label">Filamento de cada zona</p>
                <div className="laminas__zones">
                  {result.paleta.map((_, i) => (
                    <label key={i} className="laminas__zone">
                      <input
                        type="color"
                        className="tools__color"
                        value={filaments[i] ?? '#ffffff'}
                        onChange={(e) =>
                          setFilaments((f) =>
                            f.map((c, k) => (k === i ? e.target.value : c)),
                          )
                        }
                      />
                      <span>
                        Zona {i + 1}
                        {i === masClaro(result) && ' · también la base'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="tools__hint">
                  Elegí el color del filamento que vas a cargar en cada posición
                  del AMS; la base usa el de la zona más clara.
                </p>
              </>
            )}
          </section>

          <section className="card tools__preview">
            <div className="tools__canvas">
              {result && <ZonePreview q={result} colors={filaments} />}
              {busy && <span className="tools__busy">Procesando…</span>}
            </div>
            {result && (
              <p className="tools__hint">
                {result.paleta.length} colores · {util.ancho} × {util.alto} mm ·
                espesor {producto.espesor_mm} mm
              </p>
            )}
            <div className="tools__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStep('imagen')}
              >
                Atrás
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !result}
                onClick={descargar}
              >
                <Icon name="download" /> Descargar 3MF
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QuoteFiles, type QuoteAttachment } from '../components/QuoteFiles'
import { useShop } from '../lib/data'
import { onlyDigits } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'
import { waLink } from '../lib/whatsapp'

// Pedido a medida: arma el mensaje y abre WhatsApp. Las fotos, logos o planos
// se pueden adjuntar acá (van como links en el mensaje) o mandar por el chat.
export function Custom() {
  usePageTitle('Pedido a medida')
  const { settings } = useShop()
  const [params, setParams] = useSearchParams()
  const empresa = params.get('tipo') === 'empresa'
  const [f, setF] = useState({
    idea: '',
    ref: '',
    qty: '',
    fecha: '',
    medidas: '',
    nombre: '',
    empresa: '',
    cuit: '',
  })
  const [tried, setTried] = useState(false)
  const [files, setFiles] = useState<QuoteAttachment[]>([])
  const uploading = files.some((x) => x.status === 'uploading')
  const uploaded = files.filter((x) => x.status === 'done' && x.url)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value })

  const valid = f.idea.trim().length >= 5 && f.nombre.trim().length >= 2

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!valid || uploading) return
    const lines = [
      `¡Hola Global3D! Soy ${f.nombre.trim()} y quiero pedir un presupuesto${empresa ? ' para empresa' : ''}.`,
      '',
      `Qué quiero: ${f.idea.trim()}`,
      f.qty && `Cantidad: ${onlyDigits(f.qty) || f.qty}`,
      f.fecha &&
        `Lo necesito para: ${new Date(f.fecha + 'T12:00').toLocaleDateString('es-AR')}`,
      f.medidas && `Tamaño y colores: ${f.medidas.trim()}`,
      f.ref && `Referencia: ${f.ref.trim()}`,
      empresa && f.empresa && `Empresa: ${f.empresa.trim()}`,
      empresa && f.cuit && `CUIT para factura: ${f.cuit.trim()}`,
      ...(uploaded.length
        ? ['', 'Archivos:', ...uploaded.map((x) => x.url)]
        : ['', 'Les mando por acá las fotos o el logo.']),
    ].filter((l) => l !== false && l !== undefined && l !== null) as string[]
    window.open(
      // Los campos opcionales vacíos dejan líneas en blanco: queda una sola.
      waLink(settings.whatsapp, lines.join('\n').replace(/\n{3,}/g, '\n\n')),
      '_blank',
      'noopener',
    )
  }

  return (
    <div className="container" style={{ maxWidth: 760, paddingBottom: 48 }}>
      <div className="page-title">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4.4vw, 2.6rem)' }}>
          Contanos tu idea y te cotizamos
        </h1>
        <p className="muted">
          Te respondemos por WhatsApp con precio y plazo. Lo confirmás con una
          seña del 50%.
        </p>
        <p className="muted">
          {empresa
            ? 'Algunas ideas: trofeos y medallas, llaveros con tu logo, vasos y regalos para tu equipo o tus clientes, carteles y letras. Si no está en la lista, contanos igual.'
            : 'Algunas ideas: vasos con tu nombre o tu equipo, figuras y personajes, llaveros, regalos, lámparas y organizadores, carteles y letras. Si no está en la lista, contanos igual.'}
        </p>
      </div>
      <div
        className="chips"
        role="group"
        aria-label="Tipo de pedido"
        style={{ marginBottom: 18 }}
      >
        <button
          type="button"
          className="chip"
          aria-pressed={!empresa}
          onClick={() => setParams({}, { replace: true })}
        >
          Para mí
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={empresa}
          onClick={() => setParams({ tipo: 'empresa' }, { replace: true })}
        >
          Empresa, evento o mayorista
        </button>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        <section className="panel">
          <label className="field">
            <span className="label">¿Qué querés que hagamos?</span>
            <textarea
              id="idea"
              className="textarea"
              maxLength={600}
              value={f.idea}
              onChange={set('idea')}
              aria-invalid={(tried && f.idea.trim().length < 5) || undefined}
              placeholder={
                empresa
                  ? 'Ej: 60 medallas para un torneo infantil con el logo del club'
                  : 'Ej: una figura de mi perro para la torta de cumpleaños'
              }
            />
            {tried && f.idea.trim().length < 5 && (
              <span className="error-text">
                Contanos un poco qué necesitás.
              </span>
            )}
          </label>
          <label className="field">
            <span className="label">Link de referencia (opcional)</span>
            <input
              id="ref"
              className="input"
              type="url"
              inputMode="url"
              placeholder="MakerWorld, Printables, Pinterest…"
              value={f.ref}
              onChange={set('ref')}
            />
          </label>
          <QuoteFiles files={files} setFiles={setFiles} />
          <div className="grid-2">
            <label className="field">
              <span className="label">Cantidad</span>
              <input
                id="cantidad"
                className="input"
                inputMode="numeric"
                placeholder={empresa ? '60' : '1'}
                value={f.qty}
                onChange={set('qty')}
              />
            </label>
            <label className="field">
              <span className="label">¿Para cuándo lo necesitás?</span>
              <input
                id="fecha"
                className="input"
                type="date"
                value={f.fecha}
                onChange={set('fecha')}
              />
            </label>
          </div>
          <label className="field">
            <span className="label">
              Tamaño aproximado y colores (opcional)
            </span>
            <input
              id="medidas"
              className="input"
              placeholder="Ej: 15 cm de alto, azul y blanco"
              value={f.medidas}
              onChange={set('medidas')}
            />
          </label>
        </section>

        {empresa && (
          <section className="panel">
            <h2>Datos de la empresa</h2>
            <div className="grid-2">
              <label className="field">
                <span className="label">Empresa o institución</span>
                <input
                  id="empresa"
                  className="input"
                  value={f.empresa}
                  onChange={set('empresa')}
                />
              </label>
              <label className="field">
                <span className="label">CUIT (si necesitás factura)</span>
                <input
                  id="cuit"
                  className="input"
                  inputMode="numeric"
                  placeholder="30-00000000-0"
                  value={f.cuit}
                  onChange={set('cuit')}
                />
              </label>
            </div>
            <p className="hint">
              Precios por cantidad. Para fechas fijas, reservamos el lugar con
              la seña.
            </p>
          </section>
        )}

        <section className="panel">
          <label className="field">
            <span className="label">Tu nombre</span>
            <input
              id="nombre"
              className="input"
              autoComplete="name"
              value={f.nombre}
              onChange={set('nombre')}
              aria-invalid={(tried && f.nombre.trim().length < 2) || undefined}
            />
            {tried && f.nombre.trim().length < 2 && (
              <span className="error-text">Escribí tu nombre.</span>
            )}
          </label>
          <button
            type="submit"
            className="btn btn-wa btn-block"
            disabled={uploading}
          >
            {uploading ? 'Subiendo archivos…' : 'Enviar por WhatsApp'}
          </button>
          <p className="hint">
            Te abrimos WhatsApp con todo escrito
            {uploaded.length ? ' y los links de tus archivos' : ''}: solo tenés
            que mandarlo.
          </p>
        </section>
      </form>
    </div>
  )
}

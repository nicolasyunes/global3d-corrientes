import { useSearchParams } from 'react-router-dom'
import QrTool from './QrTool'
import VectorizeTool from './VectorizeTool'
import './tools.css'

const TABS = [
  { id: 'svg', label: 'Imagen a SVG' },
  { id: 'qr', label: 'Generador de QR' },
  { id: '3d', label: 'Generadores 3D' },
] as const

// Los generadores 3D son páginas aparte (/herramientas): pesan varios MB por
// three.js y manifold, así que se abren en otra pestaña en vez de cargarse acá.
const GENERADORES = [
  {
    href: '/herramientas/letra-caja.html',
    title: 'Letra caja',
    text: 'Letras con LED en 15 estilos: frente impreso o acrílico, 3MF, STL y DXF. Los diseños se guardan y se asocian al pedido.',
  },
  {
    href: '/herramientas/llavero.html',
    title: 'Llavero con logo',
    text: 'Llavero paramétrico con el logo del cliente, en OpenSCAD.',
  },
  {
    href: '/herramientas/vaso.html',
    title: 'Vaso Chop 650',
    text: 'Vista a color del vaso con el logo y las tres zonas de color.',
  },
]

type TabId = (typeof TABS)[number]['id']

// Everything runs in the browser: no paid service, no upload, no usage limit.
export default function ToolsPage() {
  const [params, setParams] = useSearchParams()
  const h = params.get('h')
  const tab: TabId = h === 'qr' || h === '3d' ? h : 'svg'

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Herramientas</h1>
        </div>
      </div>
      <div
        className="segmented tools__tabs"
        role="group"
        aria-label="Herramienta"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setParams({ h: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'qr' ? (
        <QrTool />
      ) : tab === '3d' ? (
        <div className="tools__gens">
          {GENERADORES.map((g) => (
            <a
              key={g.href}
              className="card tools__gen"
              href={g.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <h2 className="card__title">{g.title}</h2>
              <p className="tools__hint">{g.text}</p>
            </a>
          ))}
        </div>
      ) : (
        <VectorizeTool />
      )}
    </>
  )
}

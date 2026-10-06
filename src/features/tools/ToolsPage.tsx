import { useSearchParams } from 'react-router-dom'
import QrTool from './QrTool'
import VectorizeTool from './VectorizeTool'
import './tools.css'

const TABS = [
  { id: 'svg', label: 'Imagen a SVG' },
  { id: 'qr', label: 'Generador de QR' },
] as const

type TabId = (typeof TABS)[number]['id']

// Everything runs in the browser: no paid service, no upload, no usage limit.
export default function ToolsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = params.get('h') === 'qr' ? 'qr' : 'svg'

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
      {tab === 'qr' ? <QrTool /> : <VectorizeTool />}
    </>
  )
}

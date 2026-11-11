import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DispatchTab from './DispatchTab'
import ListingsTab from './ListingsTab'
import PricesTab from './PricesTab'
import { latestRuns, type MlTaskRun } from './ml.api'
import './mercadolibre.css'

const TABS = [
  { id: 'despachos', label: 'Despachos' },
  { id: 'publicaciones', label: 'Publicaciones' },
  { id: 'precios', label: 'Precios' },
] as const

type TabId = (typeof TABS)[number]['id']

function ago(iso: string, now = new Date()): string {
  const h = Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000)
  if (h < 1) return 'hace menos de 1 h'
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

// Última corrida de la tarea diaria del gestor (registrar ventas + sincronizar).
function RunStatus({ runs }: { runs: MlTaskRun[] | null }) {
  if (runs === null) return null
  const last = (task: MlTaskRun['task']) => runs.find((r) => r.task === task)
  const ventas = last('ventas')
  const sync = last('sync')
  if (!ventas && !sync)
    return (
      <p className="ml-run muted">
        La tarea diaria del gestor todavía no corrió.
      </p>
    )
  const stale =
    !ventas || Date.now() - new Date(ventas.ran_at).getTime() > 36 * 3_600_000
  const failed = (ventas && !ventas.ok) || (sync && !sync.ok)
  return (
    <p className={`ml-run${stale || failed ? ' ml-run--warn' : ''}`}>
      {ventas && (
        <span>
          Ventas registradas {ago(ventas.ran_at)}
          {ventas.summary?.registradas
            ? ` (${String(ventas.summary.registradas)} nuevas)`
            : ''}
        </span>
      )}
      {sync && (
        <span>
          Precio y stock sincronizados {ago(sync.ran_at)}
          {sync.summary?.corregidos
            ? ` (${String(sync.summary.corregidos)} corregidas)`
            : ''}
          {!sync.ok ? ' — con errores, revisá el log del gestor' : ''}
        </span>
      )}
      {stale && <span>La tarea diaria no corrió en el último día.</span>}
    </p>
  )
}

// MercadoLibre: lo que el gestor publica y vende en ML, visto desde el taller.
export default function MercadoLibrePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === raw)
    ? (raw as TabId)
    : 'despachos'
  const [runs, setRuns] = useState<MlTaskRun[] | null>(null)

  useEffect(() => {
    latestRuns()
      .then(setRuns)
      .catch(() => setRuns([]))
  }, [])

  return (
    <section className="page ml">
      <header className="ml-head">
        <div>
          <p className="eyebrow">Canal de venta</p>
          <h1 className="page-title">MercadoLibre</h1>
        </div>
        <div className="ml-tabs" role="group" aria-label="Sección">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() =>
                setParams(t.id === 'despachos' ? {} : { tab: t.id })
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <RunStatus runs={runs} />
      {tab === 'despachos' && <DispatchTab />}
      {tab === 'publicaciones' && <ListingsTab />}
      {tab === 'precios' && <PricesTab />}
    </section>
  )
}

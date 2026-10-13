import { useSearchParams } from 'react-router-dom'
import CashTab from './CashTab'
import SummaryTab from './SummaryTab'
import './stats.css'

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'caja', label: 'Caja y filamento' },
] as const

type TabId = (typeof TABS)[number]['id']

// Owner-only numbers. The tab lives in the URL (?tab=); each tab keeps its
// own period.
export default function StatsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabId = params.get('tab') === 'caja' ? 'caja' : 'resumen'

  return (
    <div className="st">
      <header className="st-head">
        <div>
          <p className="eyebrow">Control</p>
          <h1 className="page-title">Números</h1>
        </div>
        <div className="st-tabs" role="group" aria-label="Sección">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              // Switching tab starts clean: the other tab's period means nothing here.
              onClick={() => setParams(t.id === 'resumen' ? {} : { tab: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      {tab === 'resumen' ? <SummaryTab /> : <CashTab />}
    </div>
  )
}

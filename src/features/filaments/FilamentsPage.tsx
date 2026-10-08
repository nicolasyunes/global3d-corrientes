import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import ActivityView from './ActivityView'
import ColorView from './ColorView'
import ExportModal from './ExportModal'
import LineCard, { type MoveHandler } from './LineCard'
import LineDrawer from './LineDrawer'
import PurchaseModal from './PurchaseModal'
import TakeSheet from './TakeSheet'
import {
  filterLines,
  MATERIAL_TABS,
  money,
  summarize,
  type FilamentColor,
  type FilamentLine,
} from './filaments'
import { listLines } from './filaments.api'
import '@/features/orders/taller.css'
import './filaments.css'

type View = 'brand' | 'color' | 'activity'
const VIEW_KEY = 'g3d.filamentsView'

function readView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    return saved === 'color' || saved === 'activity' ? saved : 'brand'
  } catch {
    return 'brand'
  }
}

export default function FilamentsPage() {
  const { isAdmin } = useOperator()
  const [toast, showToast] = useToast()
  const [lines, setLines] = useState<FilamentLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(readView)
  const [material, setMaterial] = useState('all')
  const [query, setQuery] = useState('')
  const [hideEmpty, setHideEmpty] = useState(false)
  // undefined = closed, null = new line.
  const [editing, setEditing] = useState<FilamentLine | null | undefined>()
  const [buying, setBuying] = useState<{ lineId: string | null } | null>(null)
  // Bumps on every saved change so the activity list refetches.
  const [exporting, setExporting] = useState(false)
  const [changes, setChanges] = useState(0)
  const [taking, setTaking] = useState<{
    line: FilamentLine
    color: FilamentColor
    refill: boolean
    direction: 'out' | 'in'
  } | null>(null)
  // An operator never lands on the activity tab, even if it was saved.
  const shownView: View = view === 'activity' && !isAdmin ? 'brand' : view

  const reload = useCallback(async () => {
    try {
      setLines(await listLines())
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los filamentos.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function setView(next: View) {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* preferencia opcional */
    }
  }

  // − opens "Sacar" (why it leaves); + is an admin adjust. The stock only
  // changes through the database, which logs who and when.
  const move: MoveHandler = (line, color, delta, refill) => {
    if (delta > 0 && !isAdmin) return
    setTaking({ line, color, refill, direction: delta < 0 ? 'out' : 'in' })
  }

  const summary = summarize(lines)
  const shown = filterLines(lines, { material, query, hideEmpty })

  return (
    <div className="fl">
      <header className="fl-head">
        <div>
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Filamentos</h1>
        </div>
        <div className="fl-head__actions">
          {isAdmin && (
            <button
              type="button"
              className="fl-btn"
              onClick={() => setEditing(null)}
            >
              <Icon name="plus" size={16} />
              Nueva línea
            </button>
          )}
          <button
            type="button"
            className="fl-btn"
            disabled={lines.length === 0}
            onClick={() => setExporting(true)}
          >
            <Icon name="download" size={16} />
            Exportar PDF
          </button>
          {isAdmin && (
            <button
              type="button"
              className="fl-btn fl-btn--primary"
              disabled={lines.length === 0}
              onClick={() => setBuying({ lineId: null })}
            >
              <Icon name="cart" size={16} />
              Registrar compra
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="fl-error" role="alert">
          {error}
        </p>
      )}

      {shownView === 'brand' && (
        <div className="fl-kpis">
          <div className="fl-kpi">
            <span>Bobinas de 1 kg en stock</span>
            <span className="fl-mono">{summary.spools}</span>
          </div>
          <div className="fl-kpi">
            <span>Valor del stock</span>
            <span className="fl-mono">{money(summary.value)}</span>
          </div>
          <div className="fl-kpi is-out">
            <span>Colores sin stock</span>
            <span className="fl-mono">
              {summary.outOfStock} de {summary.colors}
            </span>
          </div>
          <div className="fl-kpi is-low">
            <span>Quedan 1</span>
            <span className="fl-mono">{summary.low}</span>
          </div>
        </div>
      )}
      <div className="fl-bar">
        {shownView !== 'activity' && (
          <>
            <label className="fl-search">
              <Icon name="search" size={16} />
              <input
                placeholder="Buscar color o marca"
                aria-label="Buscar color o marca"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="fl-seg" role="group" aria-label="Material">
              {['all', ...MATERIAL_TABS].map((m) => (
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
            <label className="fl-check">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
              />
              Ocultar sin stock
            </label>
          </>
        )}
        <div
          className="fl-seg fl-seg--view fl-bar__view"
          role="group"
          aria-label="Vista"
        >
          <button
            type="button"
            aria-pressed={shownView === 'brand'}
            onClick={() => setView('brand')}
          >
            <Icon name="list" size={15} />
            Por marca
          </button>
          <button
            type="button"
            aria-pressed={shownView === 'color'}
            onClick={() => setView('color')}
          >
            <span className="fl-rainbow" aria-hidden="true" />
            Por color
          </button>
          {isAdmin && (
            <button
              type="button"
              aria-pressed={shownView === 'activity'}
              onClick={() => setView('activity')}
            >
              <Icon name="receipt" size={15} />
              Actividad
            </button>
          )}
        </div>
      </div>

      {shownView === 'activity' ? (
        <ActivityView
          reloadKey={changes}
          onChanged={() => {
            setChanges((n) => n + 1)
            void reload()
          }}
        />
      ) : loading ? (
        <p className="fl-quiet">Cargando filamentos…</p>
      ) : lines.length === 0 ? (
        <div className="fl-empty">
          Todavía no hay filamentos cargados. Empezá con “Nueva línea”.
        </div>
      ) : shownView === 'color' ? (
        <ColorView lines={shown} />
      ) : shown.length === 0 ? (
        <p className="fl-empty">Nada coincide con la búsqueda.</p>
      ) : (
        <div className="fl-lines">
          {shown.map((line) => (
            <LineCard
              key={line.id}
              line={line}
              onMove={move}
              canAdd={isAdmin}
              onEdit={
                isAdmin
                  ? (l) => setEditing(lines.find((x) => x.id === l.id) ?? l)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {taking && (
        <TakeSheet
          {...taking}
          onClose={() => setTaking(null)}
          onDone={(message) => {
            setTaking(null)
            setChanges((n) => n + 1)
            showToast(message)
            void reload()
          }}
        />
      )}
      {editing !== undefined && (
        <LineDrawer
          key={editing?.id ?? 'new'}
          line={editing}
          position={editing?.position ?? lines.length}
          onClose={() => setEditing(undefined)}
          onBuy={(l) => {
            setEditing(undefined)
            setBuying({ lineId: l.id })
          }}
          onSaved={(warning) => {
            setEditing(undefined)
            showToast(warning ?? 'Línea guardada')
            void reload()
          }}
        />
      )}
      {buying && (
        <PurchaseModal
          lines={lines}
          initialLineId={buying.lineId}
          onClose={() => setBuying(null)}
          onSaved={(n) => {
            setBuying(null)
            showToast(
              `Compra registrada: ${n} ${n === 1 ? 'bobina' : 'bobinas'}`,
            )
            void reload()
          }}
        />
      )}
      {exporting && (
        <ExportModal
          lines={lines}
          onClose={() => setExporting(false)}
          onNotice={showToast}
        />
      )}
      {toast}
    </div>
  )
}

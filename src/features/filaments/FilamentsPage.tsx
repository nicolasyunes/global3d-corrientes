import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import ActivityView from './ActivityView'
import ColorView from './ColorView'
import ExportModal from './ExportModal'
import LineCard, { type MoveHandler } from './LineCard'
import LineDrawer from './LineDrawer'
import PrintSheet from './PrintSheet'
import PurchaseModal from './PurchaseModal'
import {
  filterLines,
  MATERIAL_TABS,
  type ExportOptions,
  money,
  signed,
  summarize,
  type FilamentLine,
} from './filaments'
import { listLines, moveFilament } from './filaments.api'
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
  const { current } = useOperator()
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
  const [printing, setPrinting] = useState<ExportOptions | null>(null)
  const [changes, setChanges] = useState(0)

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

  // − means a spool ran out in the workshop; + is a correction. Both show at
  // once and roll back if the database says no.
  const move: MoveHandler = (line, color, delta, refill) => {
    const field = refill ? 'stock_refill' : 'stock'
    const apply = (d: number) =>
      setLines((prev) =>
        prev.map((l) =>
          l.id !== line.id
            ? l
            : {
                ...l,
                colors: l.colors.map((c) =>
                  c.id === color.id
                    ? { ...c, [field]: Math.max(0, (c[field] ?? 0) + d) }
                    : c,
                ),
              },
        ),
      )
    apply(delta)
    moveFilament(
      color.id,
      delta,
      delta < 0 ? 'used' : 'adjust',
      current?.id ?? null,
      {
        refill,
      },
    )
      .then(() => {
        setChanges((n) => n + 1)
        showToast(
          `${color.name} · ${line.brand} ${line.name}: ${signed(delta)}${
            delta < 0 ? ' (se terminó)' : ''
          }`,
        )
      })
      .catch(() => {
        apply(-delta)
        showToast('No se pudo guardar el cambio de stock.')
      })
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
          <button
            type="button"
            className="fl-btn"
            onClick={() => setEditing(null)}
          >
            <Icon name="plus" size={16} />
            Nueva línea
          </button>
          <button
            type="button"
            className="fl-btn"
            disabled={lines.length === 0}
            onClick={() => setExporting(true)}
          >
            <Icon name="download" size={16} />
            Exportar PDF
          </button>
          <button
            type="button"
            className="fl-btn fl-btn--primary"
            disabled={lines.length === 0}
            onClick={() => setBuying({ lineId: null })}
          >
            <Icon name="cart" size={16} />
            Registrar compra
          </button>
        </div>
      </header>

      {error && (
        <p className="fl-error" role="alert">
          {error}
        </p>
      )}

      {view === 'brand' && (
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
        {view !== 'activity' && (
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
            aria-pressed={view === 'brand'}
            onClick={() => setView('brand')}
          >
            <Icon name="list" size={15} />
            Por marca
          </button>
          <button
            type="button"
            aria-pressed={view === 'color'}
            onClick={() => setView('color')}
          >
            <span className="fl-rainbow" aria-hidden="true" />
            Por color
          </button>
          <button
            type="button"
            aria-pressed={view === 'activity'}
            onClick={() => setView('activity')}
          >
            <Icon name="receipt" size={15} />
            Actividad
          </button>
        </div>
      </div>

      {view === 'activity' ? (
        <ActivityView reloadKey={changes} />
      ) : loading ? (
        <p className="fl-quiet">Cargando filamentos…</p>
      ) : lines.length === 0 ? (
        <div className="fl-empty">
          Todavía no hay filamentos cargados. Empezá con “Nueva línea”.
        </div>
      ) : view === 'color' ? (
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
              onEdit={(l) => setEditing(lines.find((x) => x.id === l.id) ?? l)}
            />
          ))}
        </div>
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
          onSaved={() => {
            setEditing(undefined)
            showToast('Línea guardada')
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
          onExport={(options) => {
            setExporting(false)
            setPrinting(options)
          }}
        />
      )}
      {printing && (
        <PrintSheet
          lines={lines}
          options={printing}
          onDone={() => setPrinting(null)}
        />
      )}
      {toast}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { countDiff, summarizeCount, type StockCount } from './count'
import { logStamp, moveWhen, signed } from './filaments'
import { listStockCounts, resolveStockCount } from './stockCount.api'
import './count.css'

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// Admin: counts waiting for review (what was counted vs. what the system
// expected) and the latest resolved ones.
export default function CountReview({
  reloadKey = 0,
  onResolved,
}: {
  reloadKey?: number
  onResolved: () => void
}) {
  const { current, byId } = useOperator()
  const [counts, setCounts] = useState<StockCount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listStockCounts()
      .then((c) => alive && setCounts(c))
      .catch(
        (err) =>
          alive &&
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los conteos.'),
      )
    return () => {
      alive = false
    }
  }, [reloadKey])

  async function resolve(count: StockCount, approve: boolean) {
    if (!approve && !window.confirm('¿Descartar este conteo? No se toca el stock.')) return
    setBusy(true)
    setError(null)
    try {
      await resolveStockCount(count.id, current?.id ?? null, approve)
      onResolved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver el conteo.')
    } finally {
      setBusy(false)
    }
  }

  const pending = (counts ?? []).filter((c) => c.status === 'pending')
  const resolved = (counts ?? []).filter((c) => c.status !== 'pending').slice(0, 5)
  const shown = [...pending, ...resolved]
  const who = (id: string | null) => (id ? (byId(id)?.name ?? '—') : '—')

  return (
    <section className="ct-review" aria-label="Revisión de conteos">
      <h2 className="ct-title">Conteos para revisar</h2>
      {error && (
        <p className="fl-error" role="alert">
          {error}
        </p>
      )}
      {counts == null && !error && <p className="fl-quiet">Cargando conteos…</p>}
      {counts != null && shown.length === 0 && (
        <p className="fl-quiet">Todavía no hay conteos.</p>
      )}
      {shown.map((count) => {
        const s = summarizeCount(count.items)
        const diffs = count.items.filter((it) => countDiff(it) !== 0)
        const title = `Conteo de ${who(count.operator_id)} · ${
          count.status === 'pending' ? logStamp(count.created_at) : moveWhen(count.created_at)
        }`
        return (
          <article key={count.id} className="ct-card" aria-label={title}>
            <h3 className="ct-card__title">{title}</h3>
            <p className="ct-card__sum">
              {`${plural(s.total, 'color', 'colores')}: ${s.same} iguales, ${s.over} de más, ${s.short} de menos · neto ${signed(s.net)}`}
            </p>
            {diffs.length === 0 ? (
              <p className="fl-quiet">Sin diferencias.</p>
            ) : (
              <ul className="ct-diffs">
                {diffs.map((it) => (
                  <li key={it.id}>
                    <span className="ct-diffs__what">
                      {it.line_label} · {it.color_label}
                      {it.refill ? ' Recarga' : ''}
                    </span>
                    <span className="ct-diffs__nums">
                      esperado {it.expected} → contó {it.counted}
                    </span>
                    <strong className="ct-diff">{signed(countDiff(it))}</strong>
                  </li>
                ))}
              </ul>
            )}
            {count.status === 'pending' ? (
              <div className="ct-actions">
                <button
                  type="button"
                  className="fl-btn fl-btn--primary"
                  disabled={busy}
                  onClick={() => resolve(count, true)}
                >
                  Aprobar ajustes
                </button>
                <button
                  type="button"
                  className="fl-btn"
                  disabled={busy}
                  onClick={() => resolve(count, false)}
                >
                  Descartar
                </button>
                <p className="fl-quiet">Corrige el stock en las diferencias y queda en Actividad</p>
              </div>
            ) : (
              <p className="ct-resolved">
                {count.status === 'approved' ? 'Aprobado' : 'Descartado'} por{' '}
                {who(count.resolved_by)}
                {count.resolved_at ? ` · ${logStamp(count.resolved_at)}` : ''}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}

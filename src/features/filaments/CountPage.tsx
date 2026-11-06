import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import CountReminder from './CountReminder'
import CountReview from './CountReview'
import { countGroups, draftToItems, parseCounted } from './count'
import { listLines } from './filaments.api'
import type { FilamentLine } from './filaments'
import { submitStockCount } from './stockCount.api'
import '@/features/orders/taller.css'
import './filaments.css'
import './count.css'

const draftKey = (operatorId: string | null | undefined) =>
  `g3d.countDraft:${operatorId ?? 'anon'}`

type Draft = Record<string, string>

function loadDraft(key: string): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}')
    return raw && typeof raw === 'object' ? (raw as Draft) : {}
  } catch {
    return {}
  }
}

function saveDraft(key: string, draft: Draft) {
  try {
    if (Object.keys(draft).length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // storage unavailable: the draft just does not survive a reload
  }
}

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Blind count: people type what they see on the shelf. The system's stock is
// never shown here; the admin compares it afterwards in CountReview.
export default function CountPage() {
  const { current, isAdmin } = useOperator()
  const [toast, showToast] = useToast()
  const [lines, setLines] = useState<FilamentLine[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const storageKey = draftKey(current?.id)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(storageKey))
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    listLines()
      .then((l) => alive && setLines(l))
      .catch(
        (err) =>
          alive &&
          setLoadError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los filamentos.',
          ),
      )
    return () => {
      alive = false
    }
  }, [])

  const groups = useMemo(() => countGroups(lines ?? []), [lines])
  const allKeys = useMemo(
    () => new Set(groups.flatMap((g) => g.rows.map((r) => r.key))),
    [groups],
  )
  const total = allKeys.size
  const counted = [...allKeys].filter((k) => {
    const n = parseCounted(draft[k] ?? '')
    return n !== null && n !== 'invalid'
  }).length

  const hasEntries = [...allKeys].some((k) => (draft[k] ?? '').trim() !== '')
  const q = fold(query)
  const visible = groups
    .map((g) => ({
      ...g,
      rows: q
        ? g.rows.filter(
            (r) => fold(g.label).includes(q) || fold(r.colorLabel).includes(q),
          )
        : g.rows,
    }))
    .filter((g) => g.rows.length > 0)

  function setValue(key: string, value: string) {
    setError(null)
    setDraft((prev) => {
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = value
      saveDraft(storageKey, next)
      return next
    })
  }

  async function close() {
    setError(null)
    const known = Object.fromEntries(
      Object.entries(draft).filter(([k]) => allKeys.has(k)),
    )
    const { items, invalid } = draftToItems(known)
    if (invalid.length > 0)
      return setError('Revisá las cantidades: solo números enteros.')
    if (items.length === 0) return
    if (
      items.length < total &&
      !window.confirm(
        total - items.length === 1
          ? 'Falta 1 fila sin contar. ¿Cerrar igual?'
          : `Faltan ${total - items.length} filas sin contar. ¿Cerrar igual?`,
      )
    )
      return
    setSaving(true)
    try {
      await submitStockCount(current?.id ?? null, items)
      saveDraft(storageKey, {})
      setDraft({})
      showToast('Conteo enviado. Gracias.')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo enviar el conteo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fl ct">
      <header className="fl-head">
        <div>
          <p className="eyebrow">Taller</p>
          <h1 className="page-title">Conteo de stock</h1>
          <p className="fl-quiet">
            Contá los rollos cerrados que hay en el estante. No se muestra
            cuánto debería haber.
          </p>
        </div>
      </header>

      <CountReminder showLink={false} reloadKey={reloadKey} />

      {loadError && (
        <p className="fl-error" role="alert">
          {loadError}
        </p>
      )}
      {lines == null && !loadError && (
        <p className="fl-quiet">Cargando filamentos…</p>
      )}

      {lines != null && (
        <>
          <div className="ct-form">
            <label className="fl-search ct-search">
              <input
                type="search"
                aria-label="Buscar color o marca"
                placeholder="Buscar color o marca"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            {visible.map((g) => (
              <section key={g.lineId} className="ct-group" aria-label={g.label}>
                <h2 className="ct-group__title">{g.label}</h2>
                {g.rows.map((r) => {
                  const bad = parseCounted(draft[r.key] ?? '') === 'invalid'
                  const name = `${r.colorLabel}${r.suffix ? ' ' + r.suffix : ''}`
                  return (
                    <div key={r.key} className="ct-row">
                      <span
                        className="ct-row__swatch"
                        style={{ background: r.swatch }}
                        aria-hidden="true"
                      />
                      <span className="ct-row__name">
                        {r.colorLabel}
                        {r.suffix && <small> {r.suffix}</small>}
                        {bad && (
                          <small className="ct-row__hint">
                            {' '}
                            Solo números enteros
                          </small>
                        )}
                      </span>
                      <input
                        className="ct-input"
                        inputMode="numeric"
                        aria-invalid={bad ? 'true' : undefined}
                        aria-label={`Contados de ${name} — ${g.label}`}
                        value={draft[r.key] ?? ''}
                        onChange={(e) => setValue(r.key, e.target.value)}
                      />
                    </div>
                  )
                })}
              </section>
            ))}

            {error && (
              <p className="fl-error" role="alert">
                {error}
              </p>
            )}

            <div className="ct-foot">
              <span className="ct-foot__count">
                Contados: {counted} de {total}
              </span>
              <button
                type="button"
                className="fl-btn fl-btn--primary"
                disabled={!hasEntries || saving}
                onClick={close}
              >
                Cerrar conteo
              </button>
            </div>
          </div>
        </>
      )}

      {isAdmin && (
        <CountReview
          reloadKey={reloadKey}
          onResolved={() => setReloadKey((k) => k + 1)}
        />
      )}
      {toast}
    </div>
  )
}

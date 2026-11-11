import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import { pesos } from '@/features/sales/sales'
import { rulePrice, type PriceRule } from './ml'
import {
  deleteOverride,
  listOverrides,
  listPriceRules,
  listProductPrices,
  saveOverride,
  savePriceRule,
  type PriceOverride,
  type ProductPriceRow,
} from './ml.api'

const CHANNEL_LABELS: Record<PriceRule['channel'], string> = {
  ml: 'MercadoLibre',
  efectivo: 'Efectivo / transferencia',
}

// Reglas de precio por canal (la web usa el precio base del producto) y
// precios puntuales que pisan la regla.
export default function PricesTab() {
  const { isAdmin } = useOperator()
  const [toast, showToast] = useToast()
  const [rules, setRules] = useState<PriceRule[]>([])
  const [draft, setDraft] = useState<PriceRule[]>([])
  const [products, setProducts] = useState<ProductPriceRow[]>([])
  const [overrides, setOverrides] = useState<PriceOverride[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [saving, setSaving] = useState(false)
  const [newOv, setNewOv] = useState({
    productId: '',
    channel: 'ml' as PriceRule['channel'],
    price: '',
  })

  const load = useCallback(() => {
    setStatus('loading')
    Promise.all([listPriceRules(), listProductPrices(), listOverrides()])
      .then(([r, p, o]) => {
        const order = (c: PriceRule['channel']) => (c === 'ml' ? 0 : 1)
        const sorted = [...r].sort((a, b) => order(a.channel) - order(b.channel))
        setRules(sorted)
        setDraft(sorted)
        setProducts(p)
        setOverrides(o)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dirty = JSON.stringify(rules) !== JSON.stringify(draft)
  const ruleOf = (c: PriceRule['channel']) => draft.find((r) => r.channel === c)

  // Vista previa con las reglas que se están editando (sin pisar los manuales).
  const preview = useMemo(() => {
    const ml = ruleOf('ml')
    const ef = ruleOf('efectivo')
    return products.slice(0, 8).map((p) => ({
      ...p,
      price_ml: p.ml_manual || !ml ? p.price_ml : rulePrice(p.price_web, ml),
      price_efectivo:
        p.efectivo_manual || !ef ? p.price_efectivo : rulePrice(p.price_web, ef),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, draft])

  function setRule(c: PriceRule['channel'], patch: Partial<PriceRule>) {
    setDraft((d) => d.map((r) => (r.channel === c ? { ...r, ...patch } : r)))
  }

  async function saveRules() {
    setSaving(true)
    try {
      for (const r of draft) await savePriceRule(r)
      showToast('Reglas guardadas')
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function addOverride() {
    const price = Number(newOv.price)
    if (!newOv.productId || !(price > 0)) return
    try {
      await saveOverride(newOv.productId, newOv.channel, price)
      setNewOv({ productId: '', channel: newOv.channel, price: '' })
      showToast('Precio manual guardado')
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function removeOverride(o: PriceOverride) {
    try {
      await deleteOverride(o.product_id, o.channel)
      showToast('Vuelve a usar la regla')
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo borrar')
    }
  }

  if (status === 'error')
    return (
      <p className="banner banner--error" role="alert">
        No se pudieron cargar los precios.{' '}
        <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
          Reintentar
        </button>
      </p>
    )

  return (
    <div className="ml-tab ml-prices">
      <div className="card">
        <h2 className="card__title">Reglas por canal</h2>
        <p className="muted">
          La web usa el precio base de cada producto. Los otros canales se
          calculan desde ahí y se redondean hacia arriba.
        </p>
        <p className="muted ml-note">
          El descuento por efectivo que ve el cliente en la tienda web se
          configura aparte, en los ajustes de la tienda.
        </p>
        <div className="ml-rules">
          {draft.map((r) => (
            <fieldset key={r.channel} className="ml-rule" disabled={!isAdmin}>
              <legend>{CHANNEL_LABELS[r.channel]}</legend>
              <label>
                <span className="field-label">% sobre la web</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  aria-label={`Porcentaje ${CHANNEL_LABELS[r.channel]}`}
                  value={r.markup_pct}
                  onChange={(e) =>
                    setRule(r.channel, { markup_pct: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span className="field-label">Redondear a</span>
                <select
                  className="input"
                  aria-label={`Redondeo ${CHANNEL_LABELS[r.channel]}`}
                  value={r.round_to}
                  onChange={(e) =>
                    setRule(r.channel, { round_to: Number(e.target.value) })
                  }
                >
                  {[1, 10, 50, 100, 500, 1000].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'Sin redondeo' : `$${n}`}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!dirty || saving}
            onClick={() => void saveRules()}
          >
            {saving ? 'Guardando…' : 'Guardar reglas'}
          </button>
        ) : (
          <p className="muted">Solo el admin puede cambiar las reglas.</p>
        )}
        {dirty && (
          <p className="muted ml-note">
            Al guardar, MercadoLibre se actualiza en la próxima corrida de la
            tarea diaria.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="card__title">Cómo quedan</h2>
        <table className="ml-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Web</th>
              <th>Efectivo</th>
              <th>ML</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((p) => (
              <tr key={p.product_id}>
                <td>{p.name}</td>
                <td>{pesos(p.price_web)}</td>
                <td>
                  {pesos(p.price_efectivo)}
                  {p.efectivo_manual ? ' *' : ''}
                </td>
                <td className="ml-price">
                  {pesos(p.price_ml)}
                  {p.ml_manual ? ' *' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted ml-note">* precio manual</p>
      </div>

      <div className="card">
        <h2 className="card__title">Precios manuales</h2>
        <p className="muted">
          Para un producto puntual con otro precio en un canal. Pisa la regla.
        </p>
        {overrides.length === 0 && <p className="muted">No hay ninguno.</p>}
        <ul className="ml-overrides">
          {overrides.map((o) => (
            <li key={`${o.product_id}-${o.channel}`}>
              <span>
                {o.products?.name ?? 'Producto'} ·{' '}
                {CHANNEL_LABELS[o.channel]}
              </span>
              <strong>{pesos(o.price)}</strong>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => void removeOverride(o)}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div className="ml-override-form">
            <select
              className="input"
              aria-label="Producto"
              value={newOv.productId}
              onChange={(e) => setNewOv({ ...newOv, productId: e.target.value })}
            >
              <option value="">Elegí un producto</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              aria-label="Canal"
              value={newOv.channel}
              onChange={(e) =>
                setNewOv({
                  ...newOv,
                  channel: e.target.value as PriceRule['channel'],
                })
              }
            >
              <option value="ml">MercadoLibre</option>
              <option value="efectivo">Efectivo</option>
            </select>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Precio"
              aria-label="Precio manual"
              value={newOv.price}
              onChange={(e) => setNewOv({ ...newOv, price: e.target.value })}
            />
            <button
              type="button"
              className="btn btn--dark"
              disabled={!newOv.productId || !(Number(newOv.price) > 0)}
              onClick={() => void addOverride()}
            >
              Agregar
            </button>
          </div>
        )}
      </div>
      {toast}
    </div>
  )
}

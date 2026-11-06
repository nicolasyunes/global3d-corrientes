import {
  categoryLabel,
  usedValues,
  type ShopFamilyOption,
  type ShopLinkDraft,
  type ShopLinkMode,
} from './shopLink'

const MODES: { mode: ShopLinkMode; label: string }[] = [
  { mode: 'none', label: 'No se muestra' },
  { mode: 'existing', label: 'En una ficha que ya existe' },
  { mode: 'new', label: 'Ficha nueva' },
]

/**
 * "Tienda online" en la ficha del producto: en qué ficha de la tienda aparece
 * y con qué opciones (Tamaño, Equipo…). Precio, stock y fotos salen del
 * propio producto.
 */
export function ShopLinkSection({
  draft,
  onChange,
  families,
  status,
  error,
  productName,
}: {
  draft: ShopLinkDraft
  onChange: (next: ShopLinkDraft) => void
  families: ShopFamilyOption[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  productName: string
}) {
  const family = families.find((f) => f.id === draft.familyId)
  const categories = [...new Set(families.map((f) => f.category))].sort()
  const set = (patch: Partial<ShopLinkDraft>) =>
    onChange({ ...draft, ...patch })

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Tienda online</h2>
      </div>
      {status === 'loading' && <p className="muted">Cargando la tienda…</p>}
      {status === 'error' && (
        <p className="pform__err">
          No se pudo leer la tienda. El producto se guarda igual, sin tocar
          dónde aparece.
        </p>
      )}
      {status === 'ready' && (
        <>
          <div
            className="segmented shoplink__modes"
            role="group"
            aria-label="Dónde aparece en la tienda"
          >
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                aria-pressed={draft.mode === m.mode}
                onClick={() =>
                  set({
                    mode: m.mode,
                    newName:
                      m.mode === 'new' && !draft.newName
                        ? productName.trim()
                        : draft.newName,
                  })
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          {draft.mode === 'none' && (
            <p className="muted pform__hint">
              No aparece en la tienda. Se sigue pudiendo cargar en pedidos.
            </p>
          )}

          {draft.mode === 'existing' && (
            <div className="shoplink__fields">
              <label className="field-label" htmlFor="shop-family">
                Ficha de la tienda
              </label>
              <select
                id="shop-family"
                className="input"
                value={draft.familyId}
                onChange={(e) => set({ familyId: e.target.value })}
              >
                <option value="">Elegí una ficha…</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {categoryLabel(f.category)}
                    {f.published ? '' : ' (oculta)'}
                  </option>
                ))}
              </select>
              {family && family.axes.length === 0 && (
                <p className="muted pform__hint">
                  Esta ficha no tiene opciones: el producto aparece tal cual.
                </p>
              )}
              {family?.axes.map((a) => (
                <div key={a.key}>
                  <label className="field-label" htmlFor={`shop-opt-${a.key}`}>
                    {a.label}
                  </label>
                  <input
                    id={`shop-opt-${a.key}`}
                    className="input"
                    list={`shop-opt-${a.key}-list`}
                    value={draft.options[a.key] ?? ''}
                    placeholder={usedValues(family, a.key)[0] ?? ''}
                    onChange={(e) =>
                      set({
                        options: { ...draft.options, [a.key]: e.target.value },
                      })
                    }
                  />
                  <datalist id={`shop-opt-${a.key}-list`}>
                    {usedValues(family, a.key).map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              ))}
              {family && family.axes.length > 0 && (
                <p className="muted pform__hint">
                  Es lo que elige el cliente en la ficha. Escribí un valor que
                  ya existe para sumarlo a esa opción, o uno nuevo.
                </p>
              )}
            </div>
          )}

          {draft.mode === 'new' && (
            <div className="shoplink__fields">
              <label className="field-label" htmlFor="shop-new-name">
                Nombre en la tienda
              </label>
              <input
                id="shop-new-name"
                className="input"
                value={draft.newName}
                onChange={(e) => set({ newName: e.target.value })}
              />
              <label className="field-label" htmlFor="shop-new-category">
                Categoría
              </label>
              <select
                id="shop-new-category"
                className="input"
                value={draft.newCategory}
                onChange={(e) => set({ newCategory: e.target.value })}
              >
                <option value="">Elegí una categoría…</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
              <p className="muted pform__hint">
                Se publica una ficha con este producto solo. Precio, stock y
                fotos salen de este producto.
              </p>
            </div>
          )}

          {error && <p className="pform__err">{error}</p>}
        </>
      )}
    </section>
  )
}

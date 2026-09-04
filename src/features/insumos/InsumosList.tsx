import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from '@/features/orders/format'
import {
  adjustRolls,
  listInsumos,
  syncFromSheet,
  type InventoryRow,
  type SyncSummary,
} from './insumos.api'
import {
  availableColors,
  availableMarcas,
  availableTipos,
  emptyInsumoFilters,
  filterInsumos,
  formatRolls,
  insumoLabel,
  isLowStock,
  type InsumoFilters,
} from './insumos'
import '@/features/orders/orders.css'
import './insumos.css'

// `/admin/insumos`: the filament stock that mirrors the Google Sheet. Fast
// in-place −/+ per spool (matches the planilla's speed, the priority for this
// screen), filters by nombre / marca / tipo / color / stock, plus a one-tap
// pull from the sheet. Marca y tipo salen del texto de `material` (la planilla
// no los separa). Capture of a sale still lives in /admin/ventas; this screen
// is stock only.
export default function InsumosList() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [filters, setFilters] = useState<InsumoFilters>(emptyInsumoFilters)

  function load() {
    setLoading(true)
    listInsumos()
      .then(setRows)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los insumos.',
        ),
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const marcas = useMemo(() => availableMarcas(rows), [rows])
  const tipos = useMemo(() => availableTipos(rows), [rows])
  const colors = useMemo(() => availableColors(rows), [rows])
  const visible = useMemo(() => filterInsumos(rows, filters), [rows, filters])

  async function handleAdjust(row: InventoryRow, deltaRolls: number) {
    setBusyId(row.id)
    setError(null)
    try {
      const updated = await adjustRolls(row, deltaRolls)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo actualizar el stock.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setNotice(null)
    try {
      const summary: SyncSummary = await syncFromSheet()
      setNotice(
        `Planilla sincronizada: ${summary.created} nuevos, ${summary.updated} actualizados, ${summary.deactivated} dados de baja.`,
      )
      load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo sincronizar con la planilla.',
      )
    } finally {
      setSyncing(false)
    }
  }

  return (
    <main className="orders-list">
      <div className="orders-list__toolbar insumos-toolbar">
        <span className="insumos-toolbar__label">Stock de insumos</span>
        <button
          type="button"
          className="chip"
          onClick={() => void handleSync()}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando…' : 'Sincronizar desde planilla'}
        </button>
      </div>

      {notice && (
        <p
          className="form-banner form-banner--success orders-list__status"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading && <p className="orders-list__status">Cargando…</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">Todavía no hay insumos</p>
          <p className="empty-state__hint">
            Cargá el stock en la planilla y tocá Sincronizar desde planilla.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="sheet-filters insumos-filters">
            <input
              type="search"
              className="sheet-filters__select insumos-filters__search"
              placeholder="Buscar producto o color…"
              aria-label="Buscar por nombre o color"
              value={filters.query}
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
            />
            <select
              className="sheet-filters__select"
              aria-label="Filtrar por marca"
              value={filters.marca}
              onChange={(e) =>
                setFilters((f) => ({ ...f, marca: e.target.value }))
              }
            >
              <option value="">Todas las marcas</option>
              {marcas.map((marca) => (
                <option key={marca} value={marca}>
                  {marca}
                </option>
              ))}
            </select>
            <select
              className="sheet-filters__select"
              aria-label="Filtrar por tipo"
              value={filters.tipo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, tipo: e.target.value }))
              }
            >
              <option value="">Todos los tipos</option>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            <select
              className="sheet-filters__select"
              aria-label="Filtrar por color"
              value={filters.color}
              onChange={(e) =>
                setFilters((f) => ({ ...f, color: e.target.value }))
              }
            >
              <option value="">Todos los colores</option>
              {colors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <select
              className="sheet-filters__select"
              aria-label="Filtrar por stock"
              value={filters.stock}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  stock: e.target.value as InsumoFilters['stock'],
                }))
              }
            >
              <option value="all">Todo el stock</option>
              <option value="in">Con stock (1+ rollo)</option>
              <option value="low">Stock bajo (&lt; 1 rollo)</option>
              <option value="out">Sin stock</option>
            </select>
            <span className="insumos-filters__count">
              {visible.length} de {rows.length}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">
                Ningún insumo coincide con los filtros
              </p>
            </div>
          ) : (
            <div className="insumos-list__container">
              <ul className="orders-list__rows">
                {visible.map((row) => (
                  <li key={row.id}>
                    <div
                      className={`order-row insumo-row${row.active ? '' : ' insumo-row--inactive'}`}
                    >
                      <div className="order-row__main">
                        <span className="order-row__customer">
                          {insumoLabel(row)}
                        </span>
                        <span className="order-row__product">
                          {formatMoney(row.unit_price)} por rollo
                        </span>
                      </div>
                      <div className="insumo-row__stock">
                        <button
                          type="button"
                          className="insumo-step"
                          aria-label={`Restar un rollo de ${insumoLabel(row)}`}
                          onClick={() => void handleAdjust(row, -1)}
                          disabled={
                            busyId === row.id || (row.remaining_grams ?? 0) < 1000
                          }
                        >
                          −
                        </button>
                        <span
                          className={`insumo-row__rolls${isLowStock(row) ? ' insumo-row__rolls--low' : ''}`}
                        >
                          {formatRolls(row.remaining_grams)}
                          <span className="insumo-row__rolls-unit"> rollos</span>
                        </span>
                        <button
                          type="button"
                          className="insumo-step"
                          aria-label={`Sumar un rollo de ${insumoLabel(row)}`}
                          onClick={() => void handleAdjust(row, 1)}
                          disabled={busyId === row.id}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  )
}

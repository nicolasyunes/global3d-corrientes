# Split pedido: Producción vs. Datos/Edición — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir el `/admin/orders/:id` actual en dos pantallas — una de producción (piso de taller) y una de datos/edición — y rediseñar la tarjeta del Kanban con datos de producción.

**Architecture:** `/admin/orders/:id` pasa a montar `OrderProduction` (solo lectura salvo avanzar etapa + checklist); `/admin/orders/:id/editar` monta `OrderEdit` (envoltorio fino sobre el `OrderForm` existente en modo edición). El `OrderDetail` actual se elimina y sus piezas se reparten. La tarjeta del Kanban suma colores, texto a grabar y un pill de progreso de checklist alimentado por un nuevo `listProductionTaskCounts()` que viaja en el `Promise.all` de carga que ya tiene `OrdersList`.

**Tech Stack:** React 18 + TypeScript, React Router 6, Vitest + Testing Library (jsdom), Supabase JS. Sin librerías nuevas.

**Spec:** [docs/superpowers/specs/2026-08-27-orders-produccion-edicion-split-design.md](../specs/2026-08-27-orders-produccion-edicion-split-design.md)

## Global Constraints

- **Sin migración de base de datos.** Solo se reorganizan campos que ya existen en `orders`, `order_items`, `order_production_tasks`, `order_images`.
- **CSS: solo valores y tokens ya usados en el repo.** Tokens en `src/styles/tokens.css` (`--color-carbon`, `--color-carbon-muted`, `--color-carbon-soft`, `--status-red`, `--radius-sm`, `--shadow-sm`, etc.). El resto del archivo `orders.css` usa rem crudos — seguir ese idioma.
- **Carga rápida:** ninguna pantalla agrega fetches en serie. El Kanban suma como mucho **un** `select` liviano, en paralelo dentro del `Promise.all` existente.
- **`OrderForm` nunca toca `status`** (ya es así). El avance de etapa es exclusivo de `OrderProduction`.
- **`pending_balance` se muestra verbatim**, nunca recalculado desde `total − seña`.
- Locale de textos: español rioplatense, igual que el resto de `src/features/orders`.
- Test runner: `npm run test` (vitest run). Un test puntual: `npx vitest run <ruta> -t "<nombre>"`.
- Al terminar cada tarea: `npm run typecheck` y `npm run lint` deben pasar antes del commit.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/features/orders/colorSpec.ts` | **Nuevo.** Helpers puros de lectura de `color_spec`: `colorSpecEntries`, `swatchFor`. Separado de `validation.ts` (que maneja el round-trip del *formulario*). |
| `src/features/orders/colorSpec.test.ts` | **Nuevo.** Tests de los helpers puros. |
| `src/features/orders/orders.api.ts` | **Modificado.** `+ reduceProductionTaskCounts` (puro) y `+ listProductionTaskCounts` (fetch). |
| `src/features/orders/orders.api.test.ts` | **Nuevo.** Test del reducer puro. |
| `src/features/orders/OrderProduction.tsx` | **Nuevo.** Pantalla de piso de taller. Monta en `/admin/orders/:id`. |
| `src/features/orders/OrderProduction.test.tsx` | **Nuevo.** |
| `src/features/orders/OrderEdit.tsx` | **Nuevo.** Pantalla de datos/edición. Monta en `/admin/orders/:id/editar`. |
| `src/features/orders/OrderEdit.test.tsx` | **Nuevo.** |
| `src/features/orders/OrderDetail.tsx` | **Eliminado.** |
| `src/features/admin/admin.route.tsx` | **Modificado.** Swap de import; ruta `orders/:id/editar` nueva. |
| `src/features/admin/admin.route.test.tsx` | **Nuevo.** Bloquea la tabla de rutas. |
| `src/features/orders/OrdersKanban.tsx` | **Modificado.** Rediseño de tarjeta; prop `taskCounts`. |
| `src/features/orders/OrdersKanban.test.tsx` | **Nuevo.** |
| `src/features/orders/OrdersList.tsx` | **Modificado.** Fetch de `listProductionTaskCounts`; pasa `taskCounts` al Kanban. |
| `src/features/orders/orders.css` | **Modificado.** Estilos de `OrderProduction`, `OrderEdit` y tarjeta Kanban. |
| `src/features/orders/ProductionChecklist.tsx`, `OrderImages.tsx` | Sin cambios — reutilizados por `OrderProduction`. |

---

## Task 1: `listProductionTaskCounts` + reducer puro

**Files:**
- Modify: `src/features/orders/orders.api.ts` (agregar al final, después de `listOrderItemCounts` ~línea 169)
- Test: `src/features/orders/orders.api.test.ts` (nuevo)

**Interfaces:**
- Consumes: `supabase` (ya importado en el archivo).
- Produces:
  - `type ProductionTaskCount = { done: number; total: number }`
  - `reduceProductionTaskCounts(rows: readonly { order_id: string; done: boolean }[]): Record<string, ProductionTaskCount>`
  - `listProductionTaskCounts(): Promise<Record<string, ProductionTaskCount>>`

- [ ] **Step 1: Write the failing test**

Crear `src/features/orders/orders.api.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { reduceProductionTaskCounts } from './orders.api'

describe('reduceProductionTaskCounts', () => {
  it('collapses task rows into done/total per order', () => {
    const counts = reduceProductionTaskCounts([
      { order_id: 'a', done: true },
      { order_id: 'a', done: false },
      { order_id: 'a', done: true },
      { order_id: 'b', done: false },
    ])
    expect(counts).toEqual({
      a: { done: 2, total: 3 },
      b: { done: 0, total: 1 },
    })
  })

  it('returns an empty map for no rows', () => {
    expect(reduceProductionTaskCounts([])).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/orders/orders.api.test.ts`
Expected: FAIL — `reduceProductionTaskCounts` is not exported.

- [ ] **Step 3: Write minimal implementation**

En `src/features/orders/orders.api.ts`, al final del archivo:

```ts
export type ProductionTaskCount = { done: number; total: number }

// Pure reducer: one row per production task (order_id + done flag) collapsed
// into { done, total } per order. Extracted from the fetch below so the
// aggregation is unit-tested without a Supabase round-trip (mirrors the pure
// helpers in pendingSheet.api.ts).
export function reduceProductionTaskCounts(
  rows: readonly { order_id: string; done: boolean }[],
): Record<string, ProductionTaskCount> {
  const counts: Record<string, ProductionTaskCount> = {}
  for (const row of rows) {
    const entry = (counts[row.order_id] ??= { done: 0, total: 0 })
    entry.total += 1
    if (row.done) entry.done += 1
  }
  return counts
}

// Checklist progress for every order, for the Kanban card pill. Cheapest
// shape (two columns, no relations) reduced client-side — the table is small
// and this rides in the list view's existing Promise.all.
export async function listProductionTaskCounts(): Promise<
  Record<string, ProductionTaskCount>
> {
  const { data, error } = await supabase
    .from('order_production_tasks')
    .select('order_id, done')
  if (error) throw error
  return reduceProductionTaskCounts(data ?? [])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/orders/orders.api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/features/orders/orders.api.ts src/features/orders/orders.api.test.ts
git commit -m "feat(orders): listProductionTaskCounts para el pill de checklist del Kanban"
```

---

## Task 2: `colorSpec.ts` — helpers de lectura de color

**Files:**
- Create: `src/features/orders/colorSpec.ts`
- Test: `src/features/orders/colorSpec.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces:
  - `interface ColorEntry { part: string; color: string }`
  - `colorSpecEntries(spec: unknown): ColorEntry[]` — entradas ordenadas, sin blancos; `[]` si el spec no es objeto plano.
  - `swatchFor(color: string): string | null` — hex para un nombre de color conocido (case/acento-insensible), `null` si no.

- [ ] **Step 1: Write the failing test**

Crear `src/features/orders/colorSpec.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { colorSpecEntries, swatchFor } from './colorSpec'

describe('colorSpecEntries', () => {
  it('maps a spec object to ordered part/color entries', () => {
    expect(colorSpecEntries({ tapa: 'negro', base: 'blanco' })).toEqual([
      { part: 'tapa', color: 'negro' },
      { part: 'base', color: 'blanco' },
    ])
  })

  it('drops blank and non-string values', () => {
    expect(colorSpecEntries({ tapa: '  ', base: 'rojo', n: 3 })).toEqual([
      { part: 'base', color: 'rojo' },
    ])
  })

  it('returns [] for null, arrays, or non-objects', () => {
    expect(colorSpecEntries(null)).toEqual([])
    expect(colorSpecEntries(['negro'])).toEqual([])
    expect(colorSpecEntries('negro')).toEqual([])
  })
})

describe('swatchFor', () => {
  it('resolves a known name, accent- and case-insensitive', () => {
    expect(swatchFor('Negro')).toBe('#1a1a1a')
    expect(swatchFor('violéta')).toBe('#7b1fa2')
  })

  it('returns null for an unknown name', () => {
    expect(swatchFor('fucsia neón')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/orders/colorSpec.test.ts`
Expected: FAIL — el módulo `./colorSpec` no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `src/features/orders/colorSpec.ts`:

```ts
// Rendering helpers for a stored `color_spec` (a `{ part: color }` JSON blob).
// Kept pure and separate from validation.ts (which owns the *form* round-trip
// via colorPartsFromSpec) so the read-only production/Kanban views can list
// entries and draw swatches without pulling in form types.

export interface ColorEntry {
  part: string
  color: string
}

// Ordered, blank-free entries for display. Tolerates null / non-object /
// non-string values (returns []), unlike colorPartsFromSpec which pads an
// empty spec with a blank editable row.
export function colorSpecEntries(spec: unknown): ColorEntry[] {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return []
  return Object.entries(spec as Record<string, unknown>)
    .filter(
      (e): e is [string, string] =>
        typeof e[1] === 'string' && e[1].trim() !== '',
    )
    .map(([part, color]) => ({ part, color: color.trim() }))
}

// Best-effort swatch colour for a Spanish colour name. Returns a hex string
// for a known name (case/accent-insensitive), or null so the caller falls
// back to text only. Deliberately small — the filament colours the shop
// actually stocks, not a full dictionary.
const SWATCH_HEX: Record<string, string> = {
  negro: '#1a1a1a',
  blanco: '#f5f5f5',
  gris: '#9aa0a6',
  plata: '#c0c0c0',
  dorado: '#d4af37',
  rojo: '#d32f2f',
  naranja: '#f57c00',
  amarillo: '#fbc02d',
  verde: '#388e3c',
  azul: '#1976d2',
  celeste: '#4fc3f7',
  violeta: '#7b1fa2',
  rosa: '#ec407a',
  marron: '#6d4c41',
  beige: '#e8dcc0',
  transparente: '#e0f7fa',
}

// Strips combining accent marks (U+0300–U+036F) after NFD so 'violéta' and
// 'Violeta' both hit the 'violeta' key.
const ACCENTS = /[̀-ͯ]/g

export function swatchFor(color: string): string | null {
  const key = color.toLowerCase().normalize('NFD').replace(ACCENTS, '').trim()
  return SWATCH_HEX[key] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/orders/colorSpec.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add src/features/orders/colorSpec.ts src/features/orders/colorSpec.test.ts
git commit -m "feat(orders): helpers colorSpecEntries / swatchFor para vistas de solo lectura"
```

---

## Task 3: `OrderProduction` — pantalla de piso de taller

**Files:**
- Create: `src/features/orders/OrderProduction.tsx`
- Test: `src/features/orders/OrderProduction.test.tsx`
- Modify: `src/features/orders/orders.css` (agregar bloque `.order-production*` / `.production-spec*` al final)

**Interfaces:**
- Consumes:
  - `colorSpecEntries`, `swatchFor` de `./colorSpec` (Task 2).
  - `getOrder(id): Promise<OrderWithCustomer | null>`, `listOrderItems(id): Promise<OrderItemRow[]>`, `updateOrder(id, patch): Promise<OrderRow>` — ya existen en `./orders.api`.
  - `nextOrderStatus`, `ORDER_STATUS_LABELS`, `formatDueDate`, `formatMoney`, `isOverdue`, `toISODate` — ya existen.
  - `OrderImages`, `ProductionChecklist`, `StatusBadge` — sin cambios.
- Produces: `export default function OrderProduction()` — se monta en `/admin/orders/:id` (Task 5).

- [ ] **Step 1: Write the failing test**

Crear `src/features/orders/OrderProduction.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrderProduction from './OrderProduction'

const { getOrderMock, listOrderItemsMock, updateOrderMock } = vi.hoisted(() => ({
  getOrderMock: vi.fn(),
  listOrderItemsMock: vi.fn(),
  updateOrderMock: vi.fn(),
}))

vi.mock('./orders.api', () => ({
  getOrder: getOrderMock,
  listOrderItems: listOrderItemsMock,
  updateOrder: updateOrderMock,
}))
vi.mock('./OrderImages', () => ({ default: () => <div>IMAGES</div> }))
vi.mock('./ProductionChecklist', () => ({ default: () => <div>CHECKLIST</div> }))

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: { tapa: 'negro', base: 'blanco' },
    personalization: 'Feliz cumple Ada',
    measurements: '10x10 cm',
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-08',
    total_amount: 5000,
    deposit: 2000,
    pending_balance: 3000,
    payment_method: 'cash',
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: 'whatsapp',
    reference_link: 'https://makerworld.com/x',
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

async function renderAt(id = 'order-1') {
  const view = render(
    <MemoryRouter initialEntries={[`/admin/orders/${id}`]}>
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderProduction />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  getOrderMock.mockResolvedValue(order())
  listOrderItemsMock.mockResolvedValue([])
  updateOrderMock.mockResolvedValue(order({ status: 'post_processing' }))
})

describe('OrderProduction', () => {
  it('shows the production spec: colours, measurements, engraving text', async () => {
    await renderAt()
    expect(screen.getByText('Qué hay que hacer')).toBeInTheDocument()
    expect(screen.getByText(/tapa:/)).toBeInTheDocument()
    expect(screen.getByText(/negro/)).toBeInTheDocument()
    expect(screen.getByText('10x10 cm')).toBeInTheDocument()
    expect(screen.getByText('Feliz cumple Ada')).toBeInTheDocument()
  })

  it('omits a spec row when its field is empty', async () => {
    getOrderMock.mockResolvedValue(
      order({ measurements: null, color_spec: {}, personalization: null }),
    )
    await renderAt()
    expect(screen.queryByText('Medidas')).not.toBeInTheDocument()
    expect(screen.queryByText('Colores')).not.toBeInTheDocument()
  })

  it('does not render commercial fields', async () => {
    await renderAt()
    expect(screen.queryByText(/Método de pago/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Canal de origen/i)).not.toBeInTheDocument()
    // status is 'printing' → saldo hidden
    expect(screen.queryByText(/Saldo pendiente/)).not.toBeInTheDocument()
  })

  it('shows the pending balance only when the order is finished', async () => {
    getOrderMock.mockResolvedValue(order({ status: 'finished' }))
    await renderAt()
    expect(screen.getByText(/Saldo pendiente: \$3\.000,00/)).toBeInTheDocument()
  })

  it('advances the production stage', async () => {
    await renderAt()
    const btn = screen.getByRole('button', {
      name: /Avanzar a Post-procesado/i,
    })
    await act(async () => {
      btn.click()
    })
    expect(updateOrderMock).toHaveBeenCalledWith('order-1', {
      status: 'post_processing',
    })
  })

  it('links to the edit screen', async () => {
    await renderAt()
    expect(
      screen.getByRole('link', { name: /Datos y edición/i }),
    ).toHaveAttribute('href', '/admin/orders/order-1/editar')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/orders/OrderProduction.test.tsx`
Expected: FAIL — `./OrderProduction` no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `src/features/orders/OrderProduction.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/domain-constants'
import {
  getOrder,
  listOrderItems,
  updateOrder,
  type OrderItemRow,
  type OrderWithCustomer,
} from './orders.api'
import { nextOrderStatus } from './status'
import { colorSpecEntries, swatchFor } from './colorSpec'
import { formatDueDate, formatMoney } from './format'
import { isOverdue } from './list'
import { toISODate } from './validation'
import OrderImages from './OrderImages'
import ProductionChecklist from './ProductionChecklist'
import StatusBadge from './StatusBadge'
import './orders.css'

// `/admin/orders/:id` — the shop-floor view. Everything needed to *make* the
// order (colours, measurements, engraving text, reference photos, checklist)
// with exactly one write path that matters here: advancing the production
// stage. Commercial data (money, payment method, channel, customer contact)
// lives on the sibling `/editar` screen (OrderEdit). Replaces the former
// OrderDetail, which mixed both concerns on one page.
export default function OrderProduction() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getOrder(id), listOrderItems(id)])
      .then(([row, itemRows]) => {
        if (cancelled) return
        setOrder(row)
        setItems(itemRows)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el pedido.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const today = toISODate(new Date())

  async function setStatus(status: OrderStatus) {
    if (!order) return
    setBusy(true)
    setActionError(null)
    try {
      const updated = await updateOrder(order.id, { status })
      // Merge the persisted row over the loaded one, keeping the customer
      // relation that updateOrder (order-only select) does not return.
      setOrder((prev) => (prev ? { ...prev, ...updated } : prev))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="order-production">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-production">
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error ?? 'Pedido no encontrado.'}
        </p>
        <Link to="/admin/orders" className="link-btn back-link">
          Volver a pedidos
        </Link>
      </main>
    )
  }

  const next = nextOrderStatus(order.status)
  const isFinished = order.status === 'finished'
  const isCancelled = order.status === 'cancelled'
  const overdue = isOverdue(order, today)
  const colors = colorSpecEntries(order.color_spec)
  const hasSpec =
    colors.length > 0 ||
    Boolean(order.measurements) ||
    Boolean(order.personalization) ||
    items.length > 0

  return (
    <main className="order-production">
      <header className="order-production__header">
        <div className="order-production__nav">
          <Link to="/admin/orders" className="link-btn back-link">
            Volver a pedidos
          </Link>
          <Link
            to={`/admin/orders/${order.id}/editar`}
            className="link-btn"
          >
            Datos y edición ↗
          </Link>
        </div>
        <p className="order-production__customer">
          {order.customers?.name ?? 'Desconocido'}
        </p>
        <div className="order-production__meta">
          <StatusBadge status={order.status} />
          <span
            className={`order-production__due${
              overdue ? ' order-production__due--overdue' : ''
            }`}
          >
            Entrega: {formatDueDate(order.due_date, today)}
          </span>
        </div>
      </header>

      <section className="status-actions">
        {next && (
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void setStatus(next)}
          >
            {busy ? 'Actualizando…' : `Avanzar a ${ORDER_STATUS_LABELS[next]}`}
          </button>
        )}
        {!isFinished && !isCancelled && (
          <button
            type="button"
            className="danger-btn"
            disabled={busy}
            onClick={() => void setStatus('cancelled')}
          >
            Cancelar pedido
          </button>
        )}
        {isFinished && (
          <p className="status-actions__done">
            Listo para entregar. Saldo pendiente:{' '}
            {formatMoney(order.pending_balance)}
          </p>
        )}
        {isCancelled && (
          <p className="status-actions__done">Este pedido fue cancelado.</p>
        )}
        {actionError && (
          <p className="form-banner form-banner--error" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section className="production-spec">
        <h2 className="form-section__heading">Qué hay que hacer</h2>

        {hasSpec ? (
          <>
            <dl className="production-spec__list">
              {colors.length > 0 && (
                <div className="production-spec__row">
                  <dt>Colores</dt>
                  <dd>
                    <ul className="production-spec__colors">
                      {colors.map(({ part, color }) => {
                        const hex = swatchFor(color)
                        return (
                          <li key={part}>
                            {hex && (
                              <span
                                className="production-spec__swatch"
                                style={{ backgroundColor: hex }}
                                aria-hidden="true"
                              />
                            )}
                            <span className="production-spec__part">
                              {part}:
                            </span>{' '}
                            {color}
                          </li>
                        )
                      })}
                    </ul>
                  </dd>
                </div>
              )}
              {order.measurements && (
                <div className="production-spec__row">
                  <dt>Medidas</dt>
                  <dd>{order.measurements}</dd>
                </div>
              )}
              {order.personalization && (
                <div className="production-spec__row">
                  <dt>Personalización</dt>
                  <dd className="production-spec__engraving">
                    {order.personalization}
                  </dd>
                </div>
              )}
            </dl>

            {items.length > 0 && (
              <ul className="production-spec__items">
                {items.map((item) => (
                  <li key={item.id} className="production-spec__item">
                    <span className="production-spec__item-qty">
                      {item.quantity}×
                    </span>{' '}
                    {item.description}
                    {item.personalization && (
                      <span className="production-spec__engraving">
                        {' '}
                        — {item.personalization}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="field__hint">
            Sin especificaciones cargadas. Completá los detalles en{' '}
            <Link
              to={`/admin/orders/${order.id}/editar`}
              className="link-btn link-btn--inline"
            >
              Datos y edición
            </Link>
            .
          </p>
        )}
      </section>

      {order.reference_link && (
        <a
          href={order.reference_link}
          target="_blank"
          rel="noopener noreferrer"
          className="link-btn"
        >
          Ver modelo ↗
        </a>
      )}

      <OrderImages orderId={order.id} />

      <ProductionChecklist orderId={order.id} />

      {order.observations && (
        <section className="production-observations">
          <h2 className="form-section__heading">Observaciones</h2>
          <p>{order.observations}</p>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/orders/OrderProduction.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Add styles**

Al final de `src/features/orders/orders.css`:

```css
/* --- OrderProduction (/admin/orders/:id) ------------------------------- */
.order-production {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem 1rem 6rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.order-production__nav {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.order-production__customer {
  margin: 0.5rem 0 0;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-carbon);
}

.order-production__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.375rem;
}

.order-production__due {
  font-size: 0.875rem;
  color: var(--color-carbon-muted);
  font-variant-numeric: tabular-nums;
}

.order-production__due--overdue {
  color: var(--status-red);
  font-weight: 700;
}

.production-spec__list {
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.production-spec__row {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 0.5rem;
}

.production-spec__row dt {
  color: var(--color-carbon-muted);
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.production-spec__row dd {
  margin: 0;
  color: var(--color-carbon);
}

.production-spec__colors {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.production-spec__swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
  margin-right: 0.375rem;
  border: 1px solid var(--color-carbon-soft);
  vertical-align: middle;
}

.production-spec__part {
  color: var(--color-carbon-muted);
}

.production-spec__engraving {
  font-weight: 600;
}

.production-spec__items {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0.75rem 0 0;
  border-top: 1px solid var(--color-carbon-soft);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.production-spec__item-qty {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.production-observations p {
  margin: 0.375rem 0 0;
  white-space: pre-wrap;
  color: var(--color-carbon);
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 7: Commit**

```bash
git add src/features/orders/OrderProduction.tsx src/features/orders/OrderProduction.test.tsx src/features/orders/orders.css
git commit -m "feat(orders): pantalla OrderProduction para /admin/orders/:id"
```

---

## Task 4: `OrderEdit` — pantalla de datos/edición

**Files:**
- Create: `src/features/orders/OrderEdit.tsx`
- Test: `src/features/orders/OrderEdit.test.tsx`
- Modify: `src/features/orders/orders.css` (bloque `.order-edit*`)

**Interfaces:**
- Consumes:
  - `getOrder(id): Promise<OrderWithCustomer | null>` — ya existe.
  - `OrderForm` (default export) con props `{ initialOrder?: OrderWithCustomer; onSaved?: (order: OrderRow) => void }` — ya existe, sin cambios.
  - `StatusBadge` — sin cambios.
- Produces: `export default function OrderEdit()` — se monta en `/admin/orders/:id/editar` (Task 5).

- [ ] **Step 1: Write the failing test**

Crear `src/features/orders/OrderEdit.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrderEdit from './OrderEdit'

const { getOrderMock } = vi.hoisted(() => ({ getOrderMock: vi.fn() }))
vi.mock('./orders.api', () => ({ getOrder: getOrderMock }))
vi.mock('./OrderForm', () => ({
  default: ({
    initialOrder,
    onSaved,
  }: {
    initialOrder: OrderWithCustomer
    onSaved: (o: OrderWithCustomer) => void
  }) => (
    <div>
      <span>FORM {initialOrder.customers?.name}</span>
      <button type="button" onClick={() => onSaved(initialOrder)}>
        save
      </button>
    </div>
  ),
}))

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-08',
    total_amount: null,
    deposit: null,
    pending_balance: null,
    payment_method: null,
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

async function renderEdit() {
  render(
    <MemoryRouter initialEntries={['/admin/orders/order-1/editar']}>
      <Routes>
        <Route path="/admin/orders/:id/editar" element={<OrderEdit />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
  getOrderMock.mockResolvedValue(order())
})

describe('OrderEdit', () => {
  it('renders OrderForm seeded with the loaded order', async () => {
    await renderEdit()
    expect(screen.getByText('FORM Ada')).toBeInTheDocument()
  })

  it('has no production stage controls', async () => {
    await renderEdit()
    expect(
      screen.queryByRole('button', { name: /Avanzar a/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Cancelar pedido/i }),
    ).not.toBeInTheDocument()
  })

  it('re-fetches the order after a save', async () => {
    await renderEdit()
    expect(getOrderMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      screen.getByRole('button', { name: 'save' }).click()
    })
    expect(getOrderMock).toHaveBeenCalledTimes(2)
  })

  it('links back to the production screen', async () => {
    await renderEdit()
    expect(
      screen.getByRole('link', { name: /Volver a producción/i }),
    ).toHaveAttribute('href', '/admin/orders/order-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/orders/OrderEdit.test.tsx`
Expected: FAIL — `./OrderEdit` no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `src/features/orders/OrderEdit.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder, type OrderWithCustomer } from './orders.api'
import OrderForm from './OrderForm'
import StatusBadge from './StatusBadge'
import './orders.css'

// `/admin/orders/:id/editar` — the commercial/data screen. A thin loader
// around the shared OrderForm (edit mode): customer contact, money, payment
// method, channel, reference link, colours, items, measurements, notes.
// Production stage is deliberately NOT editable here — OrderProduction owns
// stage progression.
export default function OrderEdit() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderWithCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setOrder(await getOrder(id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el pedido.',
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <main className="order-edit">
        <p className="orders-list__status">Cargando…</p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="order-edit">
        <p
          className="form-banner form-banner--error orders-list__status"
          role="alert"
        >
          {error ?? 'Pedido no encontrado.'}
        </p>
        <Link to="/admin/orders" className="link-btn back-link">
          Volver a pedidos
        </Link>
      </main>
    )
  }

  return (
    <main className="order-edit">
      <header className="order-edit__header">
        <Link to={`/admin/orders/${order.id}`} className="link-btn back-link">
          Volver a producción
        </Link>
        <p className="order-edit__customer">
          {order.customers?.name ?? 'Desconocido'}
        </p>
        <StatusBadge status={order.status} />
      </header>

      <OrderForm
        key={order.id}
        initialOrder={order}
        onSaved={() => void load()}
      />
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/orders/OrderEdit.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Add styles**

Al final de `src/features/orders/orders.css`:

```css
/* --- OrderEdit (/admin/orders/:id/editar) ---------------------------- */
.order-edit__header {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem 1rem 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.order-edit__customer {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-carbon);
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 7: Commit**

```bash
git add src/features/orders/OrderEdit.tsx src/features/orders/OrderEdit.test.tsx src/features/orders/orders.css
git commit -m "feat(orders): pantalla OrderEdit para /admin/orders/:id/editar"
```

---

## Task 5: Wire routes + delete `OrderDetail`

**Files:**
- Modify: `src/features/admin/admin.route.tsx` (línea 8 import, línea 36 ruta)
- Delete: `src/features/orders/OrderDetail.tsx`
- Test: `src/features/admin/admin.route.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `OrderProduction` (Task 3), `OrderEdit` (Task 4) — ambos default export.
- Produces: tabla de rutas final — `orders/:id` → `OrderProduction`, `orders/:id/editar` → `OrderEdit`.

- [ ] **Step 1: Write the failing test**

Crear `src/features/admin/admin.route.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Component as AdminRoutes } from './admin.route'

// Stub the auth wrappers (they call Supabase) and every page component so the
// test exercises only the routing table.
vi.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/features/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('@/features/auth/AdminOnlyRoute', () => ({
  AdminOnlyRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock('@/features/admin/AdminLayout', async () => {
  const rr = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { default: () => <rr.Outlet /> }
})
vi.mock('@/features/orders/OrderProduction', () => ({
  default: () => <div>PRODUCTION SCREEN</div>,
}))
vi.mock('@/features/orders/OrderEdit', () => ({
  default: () => <div>EDIT SCREEN</div>,
}))
vi.mock('@/features/orders/OrdersList', () => ({
  default: () => <div>LIST</div>,
}))
vi.mock('@/features/orders/OrderForm', () => ({
  default: () => <div>NEW FORM</div>,
}))
vi.mock('@/features/orders/DeliveredOrdersList', () => ({
  default: () => <div />,
}))
vi.mock('@/features/sales/SalesForm', () => ({ default: () => <div /> }))
vi.mock('@/features/sales/SalesList', () => ({ default: () => <div /> }))
vi.mock('@/features/insumos/InsumosList', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductForm', () => ({ default: () => <div /> }))
vi.mock('@/features/products/ProductsList', () => ({ default: () => <div /> }))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('admin routing table', () => {
  it('mounts OrderProduction at /admin/orders/:id', () => {
    renderAt('/admin/orders/abc')
    expect(screen.getByText('PRODUCTION SCREEN')).toBeInTheDocument()
  })

  it('mounts OrderEdit at /admin/orders/:id/editar', () => {
    renderAt('/admin/orders/abc/editar')
    expect(screen.getByText('EDIT SCREEN')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/admin/admin.route.test.tsx`
Expected: FAIL — hoy `orders/:id` monta `OrderDetail` y `orders/:id/editar` no existe (cae en el `Navigate` catch-all → no aparece "EDIT SCREEN"); además el `vi.mock` de `@/features/orders/OrderProduction` / `OrderEdit` apunta a módulos inexistentes. (Tras Task 3/4 esos módulos ya existen; el fallo real es la tabla de rutas.)

- [ ] **Step 3: Apply the change**

En `src/features/admin/admin.route.tsx`:

Reemplazar la línea 8:

```tsx
import OrderDetail from '@/features/orders/OrderDetail'
```

por:

```tsx
import OrderProduction from '@/features/orders/OrderProduction'
import OrderEdit from '@/features/orders/OrderEdit'
```

Reemplazar la línea 36:

```tsx
          <Route path="orders/:id" element={<OrderDetail />} />
```

por:

```tsx
          <Route path="orders/:id" element={<OrderProduction />} />
          <Route path="orders/:id/editar" element={<OrderEdit />} />
```

Borrar el archivo:

```bash
git rm src/features/orders/OrderDetail.tsx
```

- [ ] **Step 4: Verify no dangling references**

Run: `grep -rn "OrderDetail" src/`
Expected: sin resultados.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/admin/admin.route.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Full suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/admin.route.tsx src/features/admin/admin.route.test.tsx
git commit -m "feat(admin): rutear /admin/orders/:id a producción y :id/editar a edición"
```

---

## Task 6: Rediseño de la tarjeta del Kanban

**Files:**
- Modify: `src/features/orders/OrdersKanban.tsx`
- Modify: `src/features/orders/OrdersList.tsx` (import + estado + `Promise.all` + prop)
- Modify: `src/features/orders/orders.css` (bloque `.kanban-card__colors` / `__engraving` / `__tasks`)
- Test: `src/features/orders/OrdersKanban.test.tsx` (nuevo)

**Interfaces:**
- Consumes:
  - `colorSpecEntries`, `swatchFor` de `./colorSpec` (Task 2).
  - `listProductionTaskCounts(): Promise<Record<string, { done: number; total: number }>>` (Task 1).
  - `OrdersKanbanProps` gana `taskCounts: Record<string, { done: number; total: number }>`.
- Produces: tarjeta del Kanban con líneas de colores + personalización + pill `done/total`.

- [ ] **Step 1: Write the failing test**

Crear `src/features/orders/OrdersKanban.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrdersKanban from './OrdersKanban'

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: { tapa: 'negro' },
    personalization: 'Texto grabado de ejemplo',
    measurements: null,
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-10',
    total_amount: null,
    deposit: null,
    pending_balance: 1500,
    payment_method: null,
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

function renderBoard(
  props: Partial<React.ComponentProps<typeof OrdersKanban>> = {},
) {
  const onAdvance = vi.fn()
  render(
    <MemoryRouter>
      <OrdersKanban
        orders={[order()]}
        today="2026-01-05"
        advancingId={null}
        onAdvance={onAdvance}
        taskCounts={{ 'order-1': { done: 2, total: 5 } }}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onAdvance }
}

describe('OrdersKanban card', () => {
  it('shows colours and the engraving snippet', () => {
    renderBoard()
    expect(screen.getByText(/tapa negro/)).toBeInTheDocument()
    expect(screen.getByText('Texto grabado de ejemplo')).toBeInTheDocument()
  })

  it('shows the checklist progress pill', () => {
    renderBoard()
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('omits the pill when the order has no tasks', () => {
    renderBoard({ taskCounts: {} })
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })

  it('still advances a card', () => {
    const { onAdvance } = renderBoard()
    screen
      .getByRole('button', { name: /Avanzar a Post-procesado/i })
      .click()
    expect(onAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
    )
  })

  it('links the card to the production screen', () => {
    renderBoard()
    expect(screen.getByRole('link', { name: /Ada/ })).toHaveAttribute(
      'href',
      '/admin/orders/order-1',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/orders/OrdersKanban.test.tsx`
Expected: FAIL — `OrdersKanban` no acepta `taskCounts` (error de tipo) y no renderiza colores / snippet / pill.

- [ ] **Step 3: Update `OrdersKanban.tsx`**

En `src/features/orders/OrdersKanban.tsx`:

Agregar import tras los existentes:

```tsx
import { colorSpecEntries, swatchFor } from './colorSpec'
```

Extender la interfaz de props:

```tsx
interface OrdersKanbanProps {
  orders: readonly OrderWithCustomer[]
  today: string
  advancingId: string | null
  onAdvance: (order: OrderWithCustomer) => void
  taskCounts: Record<string, { done: number; total: number }>
}
```

Y la firma del componente:

```tsx
export default function OrdersKanban({
  orders,
  today,
  advancingId,
  onAdvance,
  taskCounts,
}: OrdersKanbanProps) {
```

Dentro del `.map(order => …)`, justo después de calcular `overdue`, agregar:

```tsx
                  const colors = colorSpecEntries(order.color_spec)
                  const tasks = taskCounts[order.id]
```

En el JSX del `<Link className="kanban-card__link">`, **después** de
`<span className="kanban-card__product">…</span>` y **antes** de
`<span className="kanban-card__row">`, insertar:

```tsx
                        {colors.length > 0 && (
                          <span className="kanban-card__colors">
                            {colors.map(({ part, color }, i) => {
                              const hex = swatchFor(color)
                              return (
                                <span
                                  key={part}
                                  className="kanban-card__color"
                                >
                                  {i > 0 && ' · '}
                                  {hex && (
                                    <span
                                      className="kanban-card__swatch"
                                      style={{ backgroundColor: hex }}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {part} {color}
                                </span>
                              )
                            })}
                          </span>
                        )}
                        {order.personalization && (
                          <span className="kanban-card__engraving">
                            {order.personalization}
                          </span>
                        )}
```

Dentro de `<span className="kanban-card__row">`, después del
`<span className="kanban-card__pending">…</span>`, agregar el pill:

```tsx
                          {tasks && tasks.total > 0 && (
                            <span className="kanban-card__tasks">
                              {tasks.done}/{tasks.total}
                            </span>
                          )}
```

- [ ] **Step 4: Wire the fetch in `OrdersList.tsx`**

En `src/features/orders/OrdersList.tsx`:

Añadir `listProductionTaskCounts` al import de `./orders.api`:

```tsx
import {
  deleteOrder,
  listOrderItemCounts,
  listOrders,
  listProductionTaskCounts,
  updateOrder,
  type OrderWithCustomer,
} from './orders.api'
```

Añadir estado junto a `itemCounts`:

```tsx
  const [taskCounts, setTaskCounts] = useState<
    Record<string, { done: number; total: number }>
  >({})
```

Cambiar el `Promise.all` de carga (actualmente
`Promise.all([listOrders(), listOrderItemCounts()])`) por:

```tsx
    Promise.all([listOrders(), listOrderItemCounts(), listProductionTaskCounts()])
      .then(([rows, counts, tasks]) => {
        if (!cancelled) {
          setOrders(rows)
          setItemCounts(counts)
          setTaskCounts(tasks)
        }
      })
```

Pasar la prop al `<OrdersKanban>` (bloque `view === 'kanban'`):

```tsx
        <OrdersKanban
          orders={orders}
          today={today}
          advancingId={advancingId}
          onAdvance={handleAdvance}
          taskCounts={taskCounts}
        />
```

- [ ] **Step 5: Add styles**

Al final de `src/features/orders/orders.css`:

```css
/* --- Kanban card: production data ----------------------------------- */
.kanban-card__colors {
  font-size: 0.8125rem;
  color: var(--color-carbon-muted);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kanban-card__swatch {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 999px;
  margin-right: 0.25rem;
  border: 1px solid var(--color-carbon-soft);
  vertical-align: middle;
}

.kanban-card__engraving {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-carbon);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kanban-card__tasks {
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--color-carbon-soft);
  color: var(--color-carbon-muted);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/orders/OrdersKanban.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Full suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: todo verde. (Confirma que `OrdersList.tsx` compila con la prop nueva.)

- [ ] **Step 8: Commit**

```bash
git add src/features/orders/OrdersKanban.tsx src/features/orders/OrdersKanban.test.tsx src/features/orders/OrdersList.tsx src/features/orders/orders.css
git commit -m "feat(orders): tarjeta de Kanban con colores, texto a grabar y progreso de checklist"
```

---

## Self-Review

**1. Spec coverage**

| Sección del spec | Task |
|---|---|
| Ruteo `orders/:id` → producción, `orders/:id/editar` → edición, borrar `OrderDetail` | Task 5 |
| `OrderProduction`: encabezado + urgencia de entrega | Task 3 |
| `OrderProduction`: control de etapa (avanzar/cancelar) | Task 3 |
| `OrderProduction`: bloque "Qué hay que hacer" (colores, medidas, personalización, ítems), filas vacías omitidas | Task 3 |
| `OrderProduction`: `reference_link` como "Ver modelo ↗", `OrderImages`, `ProductionChecklist`, observaciones | Task 3 |
| `OrderProduction`: saldo pendiente solo con `status === 'finished'` | Task 3 (test incluido) |
| `OrderProduction`: sin total / seña / método de pago / canal / teléfono | Task 3 (test "does not render commercial fields") |
| `OrderEdit`: loader fino sobre `OrderForm`, header solo-lectura, `← Volver a producción`, sin botones de etapa, sin galería | Task 4 |
| Kanban: columnas sin cambios | Sin cambios (no se toca `KANBAN_STATUSES`) |
| Kanban: tarjeta con colores + snippet de personalización + pill `3/5` + `N ítems` | Task 6 (el `N ítems` ya existe en `OrdersKanban`; se conserva) |
| Kanban: `color_spec`/`personalization` gratis; `listProductionTaskCounts` en el `Promise.all` | Task 1 + Task 6 |
| Kanban: botón "Avanzar", sin drag-and-drop | Task 6 (test "still advances a card") |
| Kanban: modernización visual con tokens | Task 6 (CSS) — borde de etapa por columna ya existe vía `borderTopColor`; la tarjeta gana jerarquía tipográfica |
| Unit test del reducer de conteo de tareas | Task 1 |
| Test de ruteo | Task 5 |
| `colorPartsFromSpec` tolerante / sección de colores omitida si no parsea | Task 2 (`colorSpecEntries` devuelve `[]`) + Task 3 |

**Gap consciente:** el spec menciona "borde izquierdo de la tarjeta en color de
etapa" como refuerzo visual opcional. La agrupación por columnas ya comunica la
etapa (header tintado + columna), así que Task 6 prioriza la jerarquía de datos
de la tarjeta y no agrega el borde por color por-tarjeta. Si al revisar en el
navegador se quiere, es una regla CSS de una línea sobre `.kanban-card`
usando el `color` que el `.map` de columnas ya tiene a mano — se puede sumar en
el paso de estilos de Task 6 sin cambiar el árbol.

**Gap consciente 2:** el spec sugería texto "faltan N días / vencido hace N".
El plan reutiliza `formatDueDate` + énfasis `--overdue` (mismo patrón que Lista
y Kanban) en vez de introducir un formateador relativo nuevo. Es una
simplificación deliberada; el countdown relativo se puede agregar después como
helper puro en `format.ts` sin tocar estructura.

**2. Placeholder scan:** sin `TODO`/`TBD`/"similar to Task N"/"handle edge
cases". Cada paso de código trae el bloque completo.

**3. Type consistency:**
- `reduceProductionTaskCounts` / `listProductionTaskCounts` → `Record<string, { done: number; total: number }>` (alias `ProductionTaskCount`), idéntico en Task 1, Task 6 (`OrdersKanbanProps.taskCounts`) y `OrdersList` state.
- `colorSpecEntries(spec: unknown): ColorEntry[]` con `ColorEntry = { part; color }`, consumido igual en Task 3 y Task 6.
- `swatchFor(color: string): string | null` — el `null` se chequea con `{hex && …}` en ambos consumidores.
- `OrderProduction` / `OrderEdit` son default exports; los `vi.mock` de Task 5 usan `{ default: … }`.
- `OrderForm` props `{ initialOrder, onSaved }` — usadas tal cual en Task 4, coincide con la firma real del componente.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-27-orders-produccion-edicion-split.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

# Control de filamentos — Entrega 2: Estadísticas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla `/admin/estadisticas`, solo para el admin, con ventas de filamento (día, hora, persona, precio, cobro), productos entregados, salidas por motivo y por persona, y lo más vendido, por hoy / semana / mes / rango, comparado con el período anterior.

**Architecture:** Funciones puras en `src/features/stats/stats.ts` (períodos, filas de entregados, agregaciones) con tests de unidad; `stats.api.ts` trae los datos crudos del período (volumen chico: se filtra en el cliente) y reusa `listDeliveredOrders`/`listProductSales`; `StatsPage.tsx` solo presenta. La fecha de un pedido entregado es el momento real en que pasó a "Entregado" (`production_events`, `kind = 'stage'`, `to_status = 'delivered'`) y, si no hay evento, su `due_date`. Además, una migración chica mejora el texto que deja una venta en el registro.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library, Supabase.

**Spec:** `docs/superpowers/specs/2026-10-08-control-filamentos-design.md` (sección "Entrega 2"). Decisión posterior del dueño (2026-10-08): fecha de entrega = la real cuando existe, si no la prometida (`due_date`).

## Global Constraints

- Proyecto Supabase: `bukjmleercxlxbexekos` (base **real**). Migraciones: prueba en seco con `DO ... raise exception 'DRYRUN_OK'` en una sola llamada `execute_sql`; **aplicar pide confirmación del dueño en el chat** y lo hace el controlador, no el implementador.
- Node: el PATH del sistema tiene Node 16 (rompe vitest). Siempre `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH"` antes de `npx`/`npm`.
- `vi.mock` con constantes de nivel superior: usar `vi.hoisted`.
- Copy de la UI en español rioplatense. Formas de cobro: "Efectivo" y "Transferencia MP". Montos con `money()` de `src/features/filaments/filaments.ts` (formato `$24.000`).
- Fechas y horas en hora local del navegador (Argentina), formateadas con `Intl` `es-AR`, 24 h.
- La semana empieza el lunes. "Mes" es el mes calendario.
- Las ventas anuladas se listan tachadas y **no** suman en totales.
- Pantalla y ruta solo admin (`OperatorAdminOnly` + `adminOnly` en el menú).
- No commitear: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `*.xlsx`.
- Comentarios en inglés, breves (SQL en español).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/features/stats/stats.ts` (crear) | Períodos, filas de entregados, agregaciones (puro) |
| `src/features/stats/stats.test.ts` (crear) | Tests de unidad |
| `src/features/stats/stats.api.ts` (crear) | Carga de datos del período |
| `src/features/stats/stats.api.test.ts` (crear) | Filtros de las consultas y armado de fechas de entrega |
| `src/features/stats/StatsPage.tsx` (crear) | Pantalla |
| `src/features/stats/StatsPage.test.tsx` (crear) | Tests de la pantalla |
| `src/features/stats/stats.css` (crear) | Estilos |
| `src/features/admin/admin.route.tsx` (modificar) | Ruta `estadisticas` solo admin |
| `src/features/admin/AdminLayout.tsx` (modificar) | Ítem de menú solo admin |
| `src/features/admin/AdminLayout.test.tsx` (modificar) | El operador no ve "Estadísticas" |
| `supabase/migrations/20261008180000_filament_sale_note.sql` (crear) | Nota de venta legible |

---

### Task 1: Períodos y agregaciones (puro)

**Files:**
- Create: `src/features/stats/stats.ts`
- Test: `src/features/stats/stats.test.ts`

**Interfaces:**
- Consumes: `FilamentSale`, `FilamentLogRow` de `@/features/filaments/filaments`; `OrderWithCustomer` de `@/features/orders/orders.api`; `ProductSaleRow` de `@/features/orders/productSales.api`; `orderToVentaRow`, `productSaleToVentaRow` de `@/features/orders/deliveredOrders`.
- Produces:
  - `type PeriodKind = 'today' | 'week' | 'month' | 'custom'`
  - `interface Range { from: Date; to: Date }` (intervalo `[from, to)`)
  - `periodRange(kind: PeriodKind, now: Date, custom?: { from: string; to: string }): Range`
  - `previousRange(kind: PeriodKind, r: Range): Range`
  - `inRange(stamp: string, r: Range): boolean` (acepta ISO o `YYYY-MM-DD`)
  - `interface DeliveredRow { id: string; kind: 'order' | 'product'; at: string; exact: boolean; customerName: string | null; productLabel: string; amount: number | null; method: 'cash' | 'transfer' | null; href: string | null }`
  - `toDeliveredRows(orders: readonly OrderWithCustomer[], productSales: readonly ProductSaleRow[], deliveredAt: ReadonlyMap<string, string>): DeliveredRow[]` (más nuevo primero)
  - `salesSummary(sales: readonly FilamentSale[]): { count: number; units: number; total: number; cash: number; transfer: number; voided: number }`
  - `deliveredSummary(rows: readonly DeliveredRow[]): { orders: number; ordersAmount: number; direct: number; directAmount: number; cash: number; transfer: number }`
  - `type ExitReason = 'used' | 'transfer' | 'personal' | 'adjust' | 'count'`
  - `exitsByReason(log: readonly FilamentLogRow[]): Record<ExitReason, { moves: number; units: number }>`
  - `interface PersonRow { operatorId: string | null; sale: number; used: number; transfer: number; personal: number; adjust: number }`
  - `exitsByPerson(log: readonly FilamentLogRow[]): PersonRow[]` (ordenado por total de unidades, desc)
  - `topColors(sales: readonly FilamentSale[], n?: number): { label: string; units: number; total: number }[]`
  - `pctChange(curr: number, prev: number): number | null`

- [ ] **Step 1: Test que falla**

```ts
// src/features/stats/stats.test.ts
import { describe, expect, it } from 'vitest'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import type { ProductSaleRow } from '@/features/orders/productSales.api'
import {
  deliveredSummary,
  exitsByPerson,
  exitsByReason,
  inRange,
  pctChange,
  periodRange,
  previousRange,
  salesSummary,
  toDeliveredRows,
  topColors,
} from './stats'

// Wednesday 8 Oct 2026, 15:30 local time.
const NOW = new Date(2026, 9, 8, 15, 30)
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

function sale(over: Partial<FilamentSale>): FilamentSale {
  return {
    id: 's',
    created_at: new Date(2026, 9, 8, 10, 0).toISOString(),
    operator_id: 'op-1',
    color_id: 'c1',
    line_label: '3N3 PLA',
    color_label: 'Rojo',
    refill: false,
    quantity: 1,
    unit_price: 12000,
    total: 12000,
    payment: 'cash',
    customer: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    ...over,
  }
}

function log(over: Partial<FilamentLogRow>): FilamentLogRow {
  return {
    id: 'l',
    created_at: new Date(2026, 9, 8, 10, 0).toISOString(),
    operator_id: 'op-1',
    kind: 'used',
    line_label: '3N3 PLA',
    color_label: 'Rojo',
    refill: false,
    delta: -1,
    note: null,
    ...over,
  }
}

describe('periodRange', () => {
  it('hoy es el día local completo', () => {
    expect(periodRange('today', NOW)).toEqual({ from: d(2026, 10, 8), to: d(2026, 10, 9) })
  })
  it('la semana arranca el lunes', () => {
    expect(periodRange('week', NOW)).toEqual({ from: d(2026, 10, 6), to: d(2026, 10, 13) })
  })
  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(periodRange('week', new Date(2026, 9, 12, 9))).toEqual({
      from: d(2026, 10, 6),
      to: d(2026, 10, 13),
    })
  })
  it('mes calendario', () => {
    expect(periodRange('month', NOW)).toEqual({ from: d(2026, 10, 1), to: d(2026, 11, 1) })
  })
  it('rango libre incluye el último día', () => {
    expect(periodRange('custom', NOW, { from: '2026-09-01', to: '2026-09-15' })).toEqual({
      from: d(2026, 9, 1),
      to: d(2026, 9, 16),
    })
  })
})

describe('previousRange', () => {
  it('semana anterior', () => {
    expect(previousRange('week', periodRange('week', NOW))).toEqual({
      from: d(2026, 9, 29),
      to: d(2026, 10, 6),
    })
  })
  it('mes anterior es el mes calendario anterior', () => {
    expect(previousRange('month', periodRange('month', NOW))).toEqual({
      from: d(2026, 9, 1),
      to: d(2026, 10, 1),
    })
  })
  it('rango libre: misma cantidad de días justo antes', () => {
    const r = periodRange('custom', NOW, { from: '2026-09-11', to: '2026-09-20' })
    expect(previousRange('custom', r)).toEqual({ from: d(2026, 9, 1), to: d(2026, 9, 11) })
  })
})

describe('inRange', () => {
  const week = periodRange('week', NOW)
  it('acepta ISO y fecha sola', () => {
    expect(inRange(new Date(2026, 9, 6, 0, 0).toISOString(), week)).toBe(true)
    expect(inRange('2026-10-12', week)).toBe(true)
    expect(inRange('2026-10-13', week)).toBe(false)
    expect(inRange('2026-10-05', week)).toBe(false)
  })
})

describe('toDeliveredRows', () => {
  const order = {
    id: 'o1',
    due_date: '2026-10-01',
    total_amount: 55000,
    title: 'Trofeo',
    product_type: 'other',
    origin_channel: null,
    customers: { name: 'María', phone: null },
  } as unknown as OrderWithCustomer
  const direct = {
    id: 't1',
    transacted_at: new Date(2026, 9, 7, 18, 0).toISOString(),
    amount: 8000,
    method: 'transfer',
    note: 'Llavero',
    customers: null,
    products: null,
  } as unknown as ProductSaleRow

  it('usa la fecha real de entrega si existe', () => {
    const at = new Date(2026, 9, 3, 11, 20).toISOString()
    const [row] = toDeliveredRows([order], [], new Map([['o1', at]]))
    expect(row).toMatchObject({ id: 'o1', kind: 'order', at, exact: true, amount: 55000, method: null })
  })
  it('si no, la fecha prometida', () => {
    const [row] = toDeliveredRows([order], [], new Map())
    expect(row).toMatchObject({ at: '2026-10-01', exact: false })
  })
  it('ventas directas con forma de cobro, más nuevo primero', () => {
    const rows = toDeliveredRows([order], [direct], new Map())
    expect(rows.map((r) => r.id)).toEqual(['t1', 'o1'])
    expect(rows[0]).toMatchObject({ kind: 'product', exact: true, method: 'transfer', amount: 8000 })
  })
  it('una forma de cobro desconocida queda en null', () => {
    const [row] = toDeliveredRows([], [{ ...direct, method: 'other' } as ProductSaleRow], new Map())
    expect(row.method).toBeNull()
  })
})

describe('salesSummary', () => {
  it('suma por forma de cobro y deja afuera las anuladas', () => {
    const s = salesSummary([
      sale({ id: 'a', quantity: 2, total: 24000, payment: 'cash' }),
      sale({ id: 'b', total: 12000, payment: 'transfer' }),
      sale({ id: 'c', total: 12000, payment: 'cash', voided_at: 'x', void_reason: 'error' }),
    ])
    expect(s).toEqual({ count: 2, units: 3, total: 36000, cash: 24000, transfer: 12000, voided: 1 })
  })
})

describe('deliveredSummary', () => {
  it('separa pedidos y ventas directas', () => {
    const s = deliveredSummary([
      { id: 'o1', kind: 'order', at: '2026-10-01', exact: false, customerName: null, productLabel: 'x', amount: 55000, method: null, href: null },
      { id: 'o2', kind: 'order', at: '2026-10-02', exact: false, customerName: null, productLabel: 'x', amount: null, method: null, href: null },
      { id: 't1', kind: 'product', at: '2026-10-02', exact: true, customerName: null, productLabel: 'x', amount: 8000, method: 'transfer', href: null },
      { id: 't2', kind: 'product', at: '2026-10-02', exact: true, customerName: null, productLabel: 'x', amount: 3000, method: 'cash', href: null },
    ])
    expect(s).toEqual({ orders: 2, ordersAmount: 55000, direct: 2, directAmount: 11000, cash: 3000, transfer: 8000 })
  })
})

describe('exitsByReason / exitsByPerson', () => {
  const rows = [
    log({ kind: 'used', delta: -2 }),
    log({ kind: 'transfer', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'personal', delta: -1, operator_id: 'op-2' }),
    log({ kind: 'adjust', delta: -1 }),
    log({ kind: 'adjust', delta: 2 }),
    log({ kind: 'sale', delta: -3, operator_id: 'op-2' }),
    log({ kind: 'purchase', delta: 10 }),
  ]
  it('cuenta movimientos y unidades por motivo (ajuste = neto)', () => {
    const r = exitsByReason(rows)
    expect(r.used).toEqual({ moves: 1, units: 2 })
    expect(r.transfer).toEqual({ moves: 1, units: 1 })
    expect(r.personal).toEqual({ moves: 1, units: 1 })
    expect(r.adjust).toEqual({ moves: 2, units: 1 })
    expect(r.count).toEqual({ moves: 0, units: 0 })
  })
  it('por persona, ordenado por unidades', () => {
    expect(exitsByPerson(rows)).toEqual([
      { operatorId: 'op-2', sale: 3, used: 0, transfer: 1, personal: 1, adjust: 0 },
      { operatorId: 'op-1', sale: 0, used: 2, transfer: 0, personal: 0, adjust: 2 },
    ])
  })
})

describe('topColors', () => {
  it('agrupa por color y línea, sin anuladas', () => {
    expect(
      topColors([
        sale({ id: 'a', quantity: 2, total: 24000 }),
        sale({ id: 'b', color_label: 'Azul', total: 12000 }),
        sale({ id: 'c', quantity: 1, total: 12000 }),
        sale({ id: 'd', color_label: 'Azul', quantity: 5, total: 60000, voided_at: 'x', void_reason: 'e' }),
      ]),
    ).toEqual([
      { label: 'Rojo · 3N3 PLA', units: 3, total: 36000 },
      { label: 'Azul · 3N3 PLA', units: 1, total: 12000 },
    ])
  })
})

describe('pctChange', () => {
  it('variación porcentual; null sin base', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(50, 100)).toBe(-50)
    expect(pctChange(10, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/stats/stats.test.ts`
Expected: FAIL (`Cannot find module './stats'`).

- [ ] **Step 3: Implementar**

```ts
// src/features/stats/stats.ts
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import {
  orderToVentaRow,
  productSaleToVentaRow,
} from '@/features/orders/deliveredOrders'
import type { OrderWithCustomer } from '@/features/orders/orders.api'
import type { ProductSaleRow } from '@/features/orders/productSales.api'

export type PeriodKind = 'today' | 'week' | 'month' | 'custom'

// Half-open interval [from, to) in local time.
export interface Range {
  from: Date
  to: Date
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

// 'YYYY-MM-DD' → local midnight (Date parses bare dates as UTC).
function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function periodRange(
  kind: PeriodKind,
  now: Date,
  custom?: { from: string; to: string },
): Range {
  const today = startOfDay(now)
  if (kind === 'today') return { from: today, to: addDays(today, 1) }
  if (kind === 'week') {
    // Monday-based: getDay() is 0 on Sunday.
    const from = addDays(today, -((today.getDay() + 6) % 7))
    return { from, to: addDays(from, 7) }
  }
  if (kind === 'month') {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 1),
    }
  }
  const from = custom ? parseDay(custom.from) : today
  const to = custom ? addDays(parseDay(custom.to), 1) : addDays(today, 1)
  return { from, to }
}

export function previousRange(kind: PeriodKind, r: Range): Range {
  if (kind === 'month') {
    return {
      from: new Date(r.from.getFullYear(), r.from.getMonth() - 1, 1),
      to: r.from,
    }
  }
  const days = Math.round((r.to.getTime() - r.from.getTime()) / DAY)
  return { from: addDays(r.from, -days), to: r.from }
}

function toDate(stamp: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? parseDay(stamp) : new Date(stamp)
}

export function inRange(stamp: string, r: Range): boolean {
  const t = toDate(stamp).getTime()
  return t >= r.from.getTime() && t < r.to.getTime()
}

export interface DeliveredRow {
  id: string
  kind: 'order' | 'product'
  // ISO timestamp when `exact`, otherwise the promised 'YYYY-MM-DD'.
  at: string
  exact: boolean
  customerName: string | null
  productLabel: string
  amount: number | null
  method: 'cash' | 'transfer' | null
  href: string | null
}

// Orders count on the day they really moved to "Entregado" when that was
// recorded; older ones fall back to their promised date.
export function toDeliveredRows(
  orders: readonly OrderWithCustomer[],
  productSales: readonly ProductSaleRow[],
  deliveredAt: ReadonlyMap<string, string>,
): DeliveredRow[] {
  const rows: DeliveredRow[] = [
    ...orders.map((o) => {
      const v = orderToVentaRow(o)
      const at = deliveredAt.get(o.id)
      return {
        id: v.id,
        kind: 'order' as const,
        at: at ?? o.due_date,
        exact: at != null,
        customerName: v.customerName,
        productLabel: v.productLabel,
        amount: v.amount,
        method: null,
        href: v.href,
      }
    }),
    ...productSales.map((s) => {
      const v = productSaleToVentaRow(s)
      return {
        id: v.id,
        kind: 'product' as const,
        at: s.transacted_at,
        exact: true,
        customerName: v.customerName,
        productLabel: v.productLabel,
        amount: v.amount,
        method:
          s.method === 'cash' || s.method === 'transfer' ? s.method : null,
        href: null,
      }
    }),
  ]
  return rows.sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime())
}

export function salesSummary(sales: readonly FilamentSale[]) {
  const s = { count: 0, units: 0, total: 0, cash: 0, transfer: 0, voided: 0 }
  for (const x of sales) {
    if (x.voided_at) {
      s.voided++
      continue
    }
    s.count++
    s.units += x.quantity
    s.total += x.total ?? 0
    if (x.payment === 'cash') s.cash += x.total ?? 0
    else s.transfer += x.total ?? 0
  }
  return s
}

export function deliveredSummary(rows: readonly DeliveredRow[]) {
  const s = { orders: 0, ordersAmount: 0, direct: 0, directAmount: 0, cash: 0, transfer: 0 }
  for (const r of rows) {
    const amount = r.amount ?? 0
    if (r.kind === 'order') {
      s.orders++
      s.ordersAmount += amount
    } else {
      s.direct++
      s.directAmount += amount
    }
    if (r.method === 'cash') s.cash += amount
    if (r.method === 'transfer') s.transfer += amount
  }
  return s
}

export type ExitReason = 'used' | 'transfer' | 'personal' | 'adjust' | 'count'
const EXIT_REASONS: readonly ExitReason[] = ['used', 'transfer', 'personal', 'adjust', 'count']

// Spools out per reason; adjustments and counts report the net (absolute).
export function exitsByReason(
  log: readonly FilamentLogRow[],
): Record<ExitReason, { moves: number; units: number }> {
  const out = Object.fromEntries(
    EXIT_REASONS.map((k) => [k, { moves: 0, units: 0, net: 0 }]),
  ) as Record<ExitReason, { moves: number; units: number; net: number }>
  for (const r of log) {
    const k = r.kind as ExitReason
    if (!EXIT_REASONS.includes(k)) continue
    out[k].moves++
    out[k].net += r.delta ?? 0
  }
  return Object.fromEntries(
    EXIT_REASONS.map((k) => [k, { moves: out[k].moves, units: Math.abs(out[k].net) }]),
  ) as Record<ExitReason, { moves: number; units: number }>
}

export interface PersonRow {
  operatorId: string | null
  sale: number
  used: number
  transfer: number
  personal: number
  adjust: number
}

const PERSON_KINDS = ['sale', 'used', 'transfer', 'personal', 'adjust'] as const

// Spools each person moved, by reason (adjustments counted in absolute value).
export function exitsByPerson(log: readonly FilamentLogRow[]): PersonRow[] {
  const byOp = new Map<string | null, PersonRow>()
  for (const r of log) {
    const k = r.kind as (typeof PERSON_KINDS)[number]
    if (!PERSON_KINDS.includes(k)) continue
    const row =
      byOp.get(r.operator_id) ??
      { operatorId: r.operator_id, sale: 0, used: 0, transfer: 0, personal: 0, adjust: 0 }
    row[k] += Math.abs(r.delta ?? 0)
    byOp.set(r.operator_id, row)
  }
  const total = (p: PersonRow) => p.sale + p.used + p.transfer + p.personal + p.adjust
  return [...byOp.values()].sort((a, b) => total(b) - total(a))
}

export function topColors(sales: readonly FilamentSale[], n = 5) {
  const map = new Map<string, { label: string; units: number; total: number }>()
  for (const s of sales) {
    if (s.voided_at) continue
    const label = `${s.color_label} · ${s.line_label}`
    const row = map.get(label) ?? { label, units: 0, total: 0 }
    row.units += s.quantity
    row.total += s.total ?? 0
    map.set(label, row)
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.total - a.total).slice(0, n)
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}
```

Si `orderToVentaRow`/`productSaleToVentaRow` no están exportadas en `deliveredOrders.ts`, exportarlas (cambio de una palabra) e incluir el archivo en el commit.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/stats/stats.test.ts && npm run typecheck`
Expected: PASS. Si `prettier` reformatea líneas largas de los tests, está bien.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/stats.ts src/features/stats/stats.test.ts src/features/orders/deliveredOrders.ts
git commit -m "feat(estadisticas): períodos y agregaciones"
```

---

### Task 2: Carga de datos del período

**Files:**
- Create: `src/features/stats/stats.api.ts`
- Test: `src/features/stats/stats.api.test.ts`

**Interfaces:**
- Consumes: `Range`, `inRange`, `toDeliveredRows`, `DeliveredRow` (Task 1); `listDeliveredOrders` (`@/features/orders/orders.api`); `listProductSales` (`@/features/orders/productSales.api`); `supabase` (`@/lib/supabase`).
- Produces:
  - `interface StatsData { sales: FilamentSale[]; log: FilamentLogRow[]; delivered: DeliveredRow[] }`
  - `loadStats(range: Range): Promise<StatsData>`
  - `STATS_LOG_KINDS` = `['sale', 'used', 'transfer', 'personal', 'adjust', 'count']`

- [ ] **Step 1: Test que falla**

```ts
// src/features/stats/stats.api.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: { table: string; filters: unknown[][] }[] = []
  const data: Record<string, unknown[]> = {}
  function from(table: string) {
    const entry = { table, filters: [] as unknown[][] }
    calls.push(entry)
    const q = {
      select: () => q,
      gte: (...a: unknown[]) => (entry.filters.push(['gte', ...a]), q),
      lt: (...a: unknown[]) => (entry.filters.push(['lt', ...a]), q),
      eq: (...a: unknown[]) => (entry.filters.push(['eq', ...a]), q),
      in: (...a: unknown[]) => (entry.filters.push(['in', ...a]), q),
      order: () => q,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: data[table] ?? [], error: null }),
    }
    return q
  }
  return { calls, data, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
vi.mock('@/features/orders/orders.api', () => ({
  listDeliveredOrders: vi.fn().mockResolvedValue([
    { id: 'o1', due_date: '2026-10-07', total_amount: 1000, title: 'A', product_type: 'other', origin_channel: null, customers: null },
    { id: 'o2', due_date: '2026-09-01', total_amount: 2000, title: 'B', product_type: 'other', origin_channel: null, customers: null },
  ]),
}))
vi.mock('@/features/orders/productSales.api', () => ({
  listProductSales: vi.fn().mockResolvedValue([
    { id: 't1', transacted_at: new Date(2026, 9, 7, 12).toISOString(), amount: 500, method: 'cash', note: 'x', customers: null, products: null },
    { id: 't2', transacted_at: new Date(2026, 8, 1, 12).toISOString(), amount: 900, method: 'cash', note: 'y', customers: null, products: null },
  ]),
}))

import { loadStats, STATS_LOG_KINDS } from './stats.api'

const RANGE = { from: new Date(2026, 9, 6), to: new Date(2026, 9, 13) }

describe('loadStats', () => {
  beforeEach(() => {
    h.calls.length = 0
    for (const k of Object.keys(h.data)) delete h.data[k]
  })

  it('pide ventas y registro solo del período', async () => {
    await loadStats(RANGE)
    const sales = h.calls.find((c) => c.table === 'filament_sales')!
    expect(sales.filters).toContainEqual(['gte', 'created_at', RANGE.from.toISOString()])
    expect(sales.filters).toContainEqual(['lt', 'created_at', RANGE.to.toISOString()])
    const log = h.calls.find((c) => c.table === 'filament_log')!
    expect(log.filters).toContainEqual(['in', 'kind', STATS_LOG_KINDS])
    expect(log.filters).toContainEqual(['gte', 'created_at', RANGE.from.toISOString()])
  })

  it('fecha de entrega real (último evento) o prometida, filtrada por período', async () => {
    h.data.production_events = [
      { order_id: 'o2', created_at: new Date(2026, 9, 8, 9).toISOString() },
      { order_id: 'o2', created_at: new Date(2026, 9, 7, 9).toISOString() },
    ]
    const { delivered } = await loadStats(RANGE)
    expect(delivered.map((r) => r.id).sort()).toEqual(['o1', 'o2', 't1'])
    expect(delivered.find((r) => r.id === 'o2')).toMatchObject({
      exact: true,
      at: new Date(2026, 9, 8, 9).toISOString(),
    })
    const ev = h.calls.find((c) => c.table === 'production_events')!
    expect(ev.filters).toContainEqual(['eq', 'kind', 'stage'])
    expect(ev.filters).toContainEqual(['eq', 'to_status', 'delivered'])
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/stats/stats.api.test.ts`
Expected: FAIL (`Cannot find module './stats.api'`).

- [ ] **Step 3: Implementar**

```ts
// src/features/stats/stats.api.ts
import { supabase } from '@/lib/supabase'
import type { FilamentLogRow, FilamentSale } from '@/features/filaments/filaments'
import { listDeliveredOrders } from '@/features/orders/orders.api'
import { listProductSales } from '@/features/orders/productSales.api'
import { inRange, toDeliveredRows, type DeliveredRow, type Range } from './stats'

export const STATS_LOG_KINDS = ['sale', 'used', 'transfer', 'personal', 'adjust', 'count']

export interface StatsData {
  sales: FilamentSale[]
  log: FilamentLogRow[]
  delivered: DeliveredRow[]
}

// The latest move to "Entregado" per order (an order can be re-delivered).
async function deliveredMoments(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('production_events')
    .select('order_id, created_at')
    .eq('kind', 'stage')
    .eq('to_status', 'delivered')
  if (error) throw new Error(error.message)
  const map = new Map<string, string>()
  for (const e of data ?? []) {
    const prev = map.get(e.order_id)
    if (!prev || e.created_at > prev) map.set(e.order_id, e.created_at)
  }
  return map
}

// Everything the stats screen needs for one period. Volumes are small (tens of
// rows a month), so delivered orders and product sales are filtered here.
export async function loadStats(range: Range): Promise<StatsData> {
  const from = range.from.toISOString()
  const to = range.to.toISOString()
  const [sales, log, orders, productSales, moments] = await Promise.all([
    supabase
      .from('filament_sales')
      .select('*')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as FilamentSale[]
      }),
    supabase
      .from('filament_log')
      .select('*')
      .in('kind', STATS_LOG_KINDS)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as FilamentLogRow[]
      }),
    listDeliveredOrders(),
    listProductSales(),
    deliveredMoments(),
  ])
  const delivered = toDeliveredRows(orders, productSales, moments).filter((r) =>
    inRange(r.at, range),
  )
  return { sales, log, delivered }
}
```

Si TypeScript no infiere el tipo de `.then` sobre el builder de Supabase, reescribir cada consulta como `const { data, error } = await ...` en funciones `async` chicas (`loadSales`, `loadLog`) y llamarlas en el `Promise.all`; el test no cambia. El mock del test resuelve vía `then`, así que ambas formas funcionan.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/stats && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/stats.api.ts src/features/stats/stats.api.test.ts
git commit -m "feat(estadisticas): carga de datos del período"
```

---

### Task 3: Pantalla de Estadísticas

**Files:**
- Create: `src/features/stats/StatsPage.tsx`, `src/features/stats/stats.css`
- Test: `src/features/stats/StatsPage.test.tsx`

**Interfaces:**
- Consumes: todo lo de Task 1 y `loadStats` (Task 2); `money` de `@/features/filaments/filaments`; `useOperator` (`byId`).
- Produces: `export default function StatsPage()`.

Comportamiento:
- Selector de período (`role="group"`, `aria-label="Período"`, botones con `aria-pressed`): "Hoy", "Semana", "Mes", "Rango". Por defecto "Semana". "Rango" muestra dos `input type="date"` con labels "Desde" y "Hasta" (default: últimos 30 días hasta hoy).
- Carga `loadStats(range)` y `loadStats(previousRange(...))` en paralelo; muestra "Cargando…" y el error en `role="alert"` si falla.
- Tarjetas (cada una con valor y, si hay base, "▲ 12 % vs período anterior" / "▼ 8 % …"):
  1. "Ventas de filamento": `money(total)`, debajo "N bobinas · M ventas".
  2. "Efectivo esperado": `money(sales.cash + delivered.cash)`.
  3. "Transferencias esperadas": `money(sales.transfer + delivered.transfer)`.
  4. "Pedidos entregados": cantidad, debajo `money(ordersAmount)`.
  5. "Ventas directas": cantidad, debajo `money(directAmount)`.
- Nota bajo las tarjetas: "Efectivo y transferencias suman ventas de filamento y ventas directas. Los pedidos no tienen forma de cobro cargada."
- Sección "Ventas de filamento" (tabla): Día y hora, Persona, Filamento (`Color · Línea` + " (recarga)"), Cant., Precio, Total, Cobro, Cliente. Anuladas con clase `is-void` y "Anulada: motivo". Vacío: "Sin ventas en este período."
- Sección "Entregados" (tabla): Fecha (con hora si `exact`, si no la fecha sola + " (prometida)"), Cliente, Producto, Monto, Cobro. Link al pedido si `href`.
- Sección "Salidas del estante" (tabla por motivo): A producción, A la otra sede, Uso personal, Ajustes, Ajustes por conteo — columnas Movimientos y Bobinas.
- Sección "Por persona" (tabla): Persona, Vendió, A producción, A la otra sede, Uso personal, Ajustes.
- Sección "Más vendidos": lista de `topColors` con unidades y total.

- [ ] **Step 1: Test que falla**

```tsx
// src/features/stats/StatsPage.test.tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'

const api = vi.hoisted(() => ({ loadStats: vi.fn() }))
vi.mock('./stats.api', () => api)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }) }),
}))

const current = {
  sales: [
    {
      id: 's1', created_at: '2026-10-08T13:30:00Z', operator_id: 'op-2', color_id: 'c1',
      line_label: '3N3 PLA', color_label: 'Rojo', refill: false, quantity: 2,
      unit_price: 12000, total: 24000, payment: 'cash', customer: 'Juan',
      voided_at: null, voided_by: null, void_reason: null,
    },
    {
      id: 's2', created_at: '2026-10-08T14:00:00Z', operator_id: 'op-1', color_id: 'c2',
      line_label: '3N3 PLA', color_label: 'Azul', refill: false, quantity: 1,
      unit_price: 12000, total: 12000, payment: 'transfer', customer: null,
      voided_at: '2026-10-08T15:00:00Z', voided_by: 'op-1', void_reason: 'error',
    },
  ],
  log: [
    { id: 'l1', created_at: '2026-10-08T12:00:00Z', operator_id: 'op-2', kind: 'transfer', line_label: '3N3 PLA', color_label: 'Rojo', refill: false, delta: -1, note: null },
  ],
  delivered: [
    { id: 'o1', kind: 'order', at: '2026-10-07', exact: false, customerName: 'María', productLabel: 'Trofeo', amount: 55000, method: null, href: '/admin/orders/o1' },
    { id: 't1', kind: 'product', at: '2026-10-07T18:00:00Z', exact: true, customerName: null, productLabel: 'Llavero', amount: 8000, method: 'transfer', href: null },
  ],
}
const empty = { sales: [], log: [], delivered: [] }

async function renderPage() {
  render(
    <MemoryRouter>
      <StatsPage />
    </MemoryRouter>,
  )
  await act(async () => {})
}

describe('StatsPage', () => {
  beforeEach(() => {
    api.loadStats.mockReset()
    api.loadStats.mockResolvedValueOnce(current).mockResolvedValueOnce(empty)
  })

  it('arranca en Semana y pide el período y el anterior', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(api.loadStats).toHaveBeenCalledTimes(2)
  })

  it('totales sin la venta anulada y cobros sumando ventas directas', async () => {
    await renderPage()
    // Some labels repeat as section titles: pick the one inside a tile.
    const tile = (name: string) =>
      screen
        .getAllByText(name)
        .map((el) => el.closest('.st-tile'))
        .find(Boolean) as HTMLElement
    expect(within(tile('Ventas de filamento')).getByText('$24.000')).toBeInTheDocument()
    expect(within(tile('Efectivo esperado')).getByText('$24.000')).toBeInTheDocument()
    expect(within(tile('Transferencias esperadas')).getByText('$8.000')).toBeInTheDocument()
    expect(within(tile('Pedidos entregados')).getByText('1')).toBeInTheDocument()
  })

  it('lista las ventas con persona, cobro y la anulada tachada', async () => {
    await renderPage()
    const table = screen.getByRole('table', { name: 'Ventas de filamento' })
    expect(within(table).getByText('sabri')).toBeInTheDocument()
    expect(within(table).getByText('Efectivo')).toBeInTheDocument()
    expect(within(table).getByText(/Anulada: error/)).toBeInTheDocument()
  })

  it('marca la fecha prometida en entregados', async () => {
    await renderPage()
    const table = screen.getByRole('table', { name: 'Entregados' })
    expect(within(table).getByText(/prometida/)).toBeInTheDocument()
  })

  it('cambiar a Mes vuelve a cargar', async () => {
    await renderPage()
    api.loadStats.mockResolvedValue(empty)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mes' }))
    })
    expect(api.loadStats).toHaveBeenCalledTimes(4)
    expect(screen.getAllByText('Sin ventas en este período.').length).toBeGreaterThan(0)
  })

  it('muestra el error de carga', async () => {
    api.loadStats.mockReset()
    api.loadStats.mockRejectedValue(new Error('sin conexión'))
    await renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('sin conexión')
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/stats/StatsPage.test.tsx`
Expected: FAIL (`Cannot find module './StatsPage'`).

- [ ] **Step 3: Implementar**

```tsx
// src/features/stats/StatsPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '@/features/filaments/filaments'
import { useOperator } from '@/features/operators/operator-context'
import {
  deliveredSummary,
  exitsByPerson,
  exitsByReason,
  pctChange,
  periodRange,
  previousRange,
  salesSummary,
  topColors,
  type PeriodKind,
} from './stats'
import { loadStats, type StatsData } from './stats.api'
import './stats.css'

const PERIODS: [PeriodKind, string][] = [
  ['today', 'Hoy'],
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['custom', 'Rango'],
]

const PAYMENT: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia MP' }

const STAMP = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function dayLabel(at: string, exact: boolean): string {
  if (exact) return STAMP.format(new Date(at))
  const [y, m, d] = at.split('-').map(Number)
  return `${DAY.format(new Date(y, m - 1, d))} (prometida)`
}

function Change({ curr, prev }: { curr: number; prev: number }) {
  const pct = pctChange(curr, prev)
  if (pct == null) return null
  return (
    <span className={`st-change${pct < 0 ? ' is-down' : ''}`}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)} % vs período anterior
    </span>
  )
}

function Tile({
  label,
  value,
  sub,
  curr,
  prev,
}: {
  label: string
  value: string
  sub?: string
  curr: number
  prev: number
}) {
  return (
    <div className="st-tile">
      <span className="st-tile__label">{label}</span>
      <span className="st-tile__value num">{value}</span>
      {sub && <span className="st-tile__sub">{sub}</span>}
      <Change curr={curr} prev={prev} />
    </div>
  )
}

// Owner-only numbers: what was sold, delivered and taken off the shelf in a
// period, compared with the one before.
export default function StatsPage() {
  const { byId } = useOperator()
  const [kind, setKind] = useState<PeriodKind>('week')
  const [custom, setCustom] = useState(() => {
    const today = new Date()
    return {
      from: isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
      to: isoDay(today),
    }
  })
  const [data, setData] = useState<{ curr: StatsData; prev: StatsData } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(
    () => periodRange(kind, new Date(), custom),
    // Recompute when the period or the custom dates change.
    [kind, custom],
  )

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    Promise.all([loadStats(range), loadStats(previousRange(kind, range))])
      .then(([curr, prev]) => alive && setData({ curr, prev }))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudieron cargar las estadísticas.'))
    return () => {
      alive = false
    }
  }, [range, kind])

  const name = (id: string | null) => (id ? (byId(id)?.name ?? '—') : '—')

  return (
    <div className="st">
      <header className="st-head">
        <div>
          <p className="eyebrow">Control</p>
          <h1 className="page-title">Estadísticas</h1>
        </div>
        <div className="st-period">
          <div className="chips" role="group" aria-label="Período">
            {PERIODS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {kind === 'custom' && (
            <div className="st-dates">
              <label>
                Desde
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </label>
            </div>
          )}
        </div>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}
      {!error && !data && <p className="st-quiet">Cargando…</p>}
      {data && <Body data={data} name={name} />}
    </div>
  )
}

function Body({
  data,
  name,
}: {
  data: { curr: StatsData; prev: StatsData }
  name: (id: string | null) => string
}) {
  const { curr, prev } = data
  const s = salesSummary(curr.sales)
  const sp = salesSummary(prev.sales)
  const dl = deliveredSummary(curr.delivered)
  const dp = deliveredSummary(prev.delivered)
  const exits = exitsByReason(curr.log)
  const people = exitsByPerson(curr.log)
  const top = topColors(curr.sales)

  return (
    <>
      <div className="st-tiles">
        <Tile
          label="Ventas de filamento"
          value={money(s.total)}
          sub={`${s.units} bobinas · ${s.count} ventas`}
          curr={s.total}
          prev={sp.total}
        />
        <Tile
          label="Efectivo esperado"
          value={money(s.cash + dl.cash)}
          curr={s.cash + dl.cash}
          prev={sp.cash + dp.cash}
        />
        <Tile
          label="Transferencias esperadas"
          value={money(s.transfer + dl.transfer)}
          curr={s.transfer + dl.transfer}
          prev={sp.transfer + dp.transfer}
        />
        <Tile
          label="Pedidos entregados"
          value={String(dl.orders)}
          sub={money(dl.ordersAmount)}
          curr={dl.orders}
          prev={dp.orders}
        />
        <Tile
          label="Ventas directas"
          value={String(dl.direct)}
          sub={money(dl.directAmount)}
          curr={dl.direct}
          prev={dp.direct}
        />
      </div>
      <p className="st-hint">
        Efectivo y transferencias suman ventas de filamento y ventas directas. Los pedidos no
        tienen forma de cobro cargada.
      </p>

      <section className="st-section">
        <h2>Ventas de filamento</h2>
        {curr.sales.length === 0 ? (
          <p className="st-quiet">Sin ventas en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Ventas de filamento">
              <thead>
                <tr>
                  <th>Día y hora</th>
                  <th>Persona</th>
                  <th>Filamento</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                  <th className="num">Total</th>
                  <th>Cobro</th>
                  <th>Cliente</th>
                </tr>
              </thead>
              <tbody>
                {curr.sales.map((x) => (
                  <tr key={x.id} className={x.voided_at ? 'is-void' : undefined}>
                    <td>{STAMP.format(new Date(x.created_at))}</td>
                    <td>{name(x.operator_id)}</td>
                    <td>
                      {x.color_label} · {x.line_label}
                      {x.refill ? ' (recarga)' : ''}
                      {x.voided_at && <span className="st-void">Anulada: {x.void_reason}</span>}
                    </td>
                    <td className="num">{x.quantity}</td>
                    <td className="num">{money(x.unit_price)}</td>
                    <td className="num">{money(x.total)}</td>
                    <td>{PAYMENT[x.payment] ?? x.payment}</td>
                    <td>{x.customer ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Entregados</h2>
        {curr.delivered.length === 0 ? (
          <p className="st-quiet">Nada entregado en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Entregados">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th className="num">Monto</th>
                  <th>Cobro</th>
                </tr>
              </thead>
              <tbody>
                {curr.delivered.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <td>{dayLabel(r.at, r.exact)}</td>
                    <td>{r.customerName ?? ''}</td>
                    <td>{r.href ? <Link to={r.href}>{r.productLabel}</Link> : r.productLabel}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td>{r.method ? PAYMENT[r.method] : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Salidas del estante</h2>
        <table className="st-table" aria-label="Salidas por motivo">
          <thead>
            <tr>
              <th>Motivo</th>
              <th className="num">Movimientos</th>
              <th className="num">Bobinas</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['used', 'A producción'],
                ['transfer', 'A la otra sede'],
                ['personal', 'Uso personal'],
                ['adjust', 'Ajustes'],
                ['count', 'Ajustes por conteo'],
              ] as const
            ).map(([k, label]) => (
              <tr key={k}>
                <td>{label}</td>
                <td className="num">{exits[k].moves}</td>
                <td className="num">{exits[k].units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="st-section">
        <h2>Por persona</h2>
        {people.length === 0 ? (
          <p className="st-quiet">Sin movimientos en este período.</p>
        ) : (
          <div className="st-scroll">
            <table className="st-table" aria-label="Por persona">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="num">Vendió</th>
                  <th className="num">A producción</th>
                  <th className="num">A la otra sede</th>
                  <th className="num">Uso personal</th>
                  <th className="num">Ajustes</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.operatorId ?? 'none'}>
                    <td>{name(p.operatorId)}</td>
                    <td className="num">{p.sale}</td>
                    <td className="num">{p.used}</td>
                    <td className="num">{p.transfer}</td>
                    <td className="num">{p.personal}</td>
                    <td className="num">{p.adjust}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-section">
        <h2>Más vendidos</h2>
        {top.length === 0 ? (
          <p className="st-quiet">Sin ventas en este período.</p>
        ) : (
          <ol className="st-top">
            {top.map((t) => (
              <li key={t.label}>
                <span>{t.label}</span>
                <span className="num">
                  {t.units} · {money(t.total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
```

Nota: `useMemo` de `range` depende de `custom` aunque el período no sea "Rango"; está bien (es un objeto estable mientras no se edita). Si eslint (`react-hooks/exhaustive-deps`) marca algo, ajustar dependencias sin cambiar el comportamiento.

Antes de escribir el CSS, mirar `src/styles/tokens.css` y `src/features/orders/deliveredOrders.css` y usar las mismas variables (colores, radios, sombras, `--space-*` o lo que exista). Base:

```css
/* src/features/stats/stats.css — owner stats screen */
.st { display: grid; gap: 1.25rem; }
.st-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 1rem; }
.st-period { display: grid; gap: 0.5rem; justify-items: end; }
.st-dates { display: flex; gap: 0.75rem; }
.st-dates label { display: grid; gap: 0.25rem; font-size: 0.85rem; }
.st-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; }
.st-tile { display: grid; gap: 0.25rem; padding: 1rem; border-radius: 14px; background: var(--surface, #fff); }
.st-tile__label { font-size: 0.85rem; opacity: 0.75; }
.st-tile__value { font-size: 1.5rem; font-weight: 700; }
.st-tile__sub { font-size: 0.85rem; }
.st-change { font-size: 0.75rem; color: var(--ok, #2e7d32); }
.st-change.is-down { color: var(--danger, #c62828); }
.st-hint, .st-quiet { font-size: 0.85rem; opacity: 0.75; margin: 0; }
.st-section { display: grid; gap: 0.5rem; }
.st-section h2 { font-size: 1.05rem; margin: 0; }
.st-scroll { overflow-x: auto; }
.st-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.st-table th, .st-table td { padding: 0.45rem 0.6rem; text-align: left; border-bottom: 1px solid var(--line, #e7e1d8); white-space: nowrap; }
.st-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.st-table tr.is-void td { text-decoration: line-through; opacity: 0.6; }
.st-void { display: block; font-size: 0.8rem; text-decoration: none; }
.st-top { margin: 0; padding-left: 1.25rem; display: grid; gap: 0.25rem; }
.st-top li { display: flex; justify-content: space-between; gap: 1rem; }
@media (max-width: 640px) {
  .st-period { justify-items: start; }
}
```

Reemplazar los fallbacks (`#fff`, `#e7e1d8`, etc.) por los tokens reales que encuentres.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/stats && npm run typecheck && npx eslint src/features/stats`
Expected: PASS, 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/StatsPage.tsx src/features/stats/StatsPage.test.tsx src/features/stats/stats.css
git commit -m "feat(estadisticas): pantalla de estadísticas para el admin"
```

---

### Task 4: Ruta y menú solo admin

**Files:**
- Modify: `src/features/admin/admin.route.tsx` (import + `<Route path="estadisticas">` junto a `personas`)
- Modify: `src/features/admin/AdminLayout.tsx` (`SECONDARY`)
- Test: `src/features/admin/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: `StatsPage` (Task 3), `OperatorAdminOnly` (ya existe en `admin.route.tsx`).

- [ ] **Step 1: Test que falla**

En `AdminLayout.test.tsx`, en el test que verifica que un operador NO ve "Personas" (~línea 87), agregar:

```tsx
    expect(screen.queryByText('Estadísticas')).not.toBeInTheDocument()
```

y en el que verifica que el admin SÍ ve "Personas" (~línea 94):

```tsx
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/admin/AdminLayout.test.tsx`
Expected: FAIL en el caso admin (no encuentra "Estadísticas").

- [ ] **Step 3: Implementar**

`AdminLayout.tsx`, en `SECONDARY`, antes de Personas:

```tsx
  {
    to: '/admin/estadisticas',
    label: 'Estadísticas',
    icon: 'spark',
    adminOnly: true,
  },
```

(Si `spark` no queda bien, usar otro nombre ya existente en `Icon.tsx`; no agregar íconos.)

`admin.route.tsx`: como `ToolsPage`, cargarla con `lazy` para no sumar peso a las demás pantallas:

```tsx
const StatsPage = lazy(() => import('@/features/stats/StatsPage'))
```

y la ruta, junto a `personas`:

```tsx
          <Route
            path="estadisticas"
            element={
              <OperatorAdminOnly>
                <Suspense fallback={null}>
                  <StatsPage />
                </Suspense>
              </OperatorAdminOnly>
            }
          />
```

Copiar exactamente cómo envuelve `ToolsPage` con `Suspense` (fallback incluido) si es distinto.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/admin && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/admin.route.tsx src/features/admin/AdminLayout.tsx src/features/admin/AdminLayout.test.tsx
git commit -m "feat(estadisticas): ruta y menú solo para el admin"
```

---

### Task 5: Nota de venta legible en el registro

**Files:**
- Create: `supabase/migrations/20261008180000_filament_sale_note.sql`

Hoy una venta deja en el registro "2 × $12000.00 · efectivo". Pasa a "2 × $12.000 = $24.000 · efectivo · Juan".

- [ ] **Step 1: Escribir la migración**

```sql
-- La nota que deja una venta en el registro de filamentos pasa a leerse como
-- en la app: "2 × $12.000 = $24.000 · efectivo · cliente".

create or replace function public.ars(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$' || replace(to_char(round(p), 'FM999,999,999,990'), ',', '.');
$$;

revoke execute on function public.ars(numeric) from public, anon;
grant execute on function public.ars(numeric) to authenticated;

create or replace function public.sell_filament(
  p_color uuid,
  p_refill boolean,
  p_qty integer,
  p_payment text,
  p_operator uuid,
  p_customer text default null
)
returns public.filament_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_color public.filament_colors;
  v_line public.filament_lines;
  v_price numeric(12, 2);
  v_have integer;
  v_customer text := nullif(trim(p_customer), '');
  v_sale public.filament_sales;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'La cantidad tiene que ser 1 o más';
  end if;
  if p_payment is null or p_payment not in ('cash', 'transfer') then
    raise exception 'Elegí cómo te pagaron';
  end if;

  select * into v_color from public.filament_colors where id = p_color for update;
  if not found then
    raise exception 'No se encontró el color';
  end if;
  select * into v_line from public.filament_lines where id = v_color.line_id;

  -- Igual que colorPrice() en filaments.ts.
  v_price := case when p_refill then v_line.refill_price
                  else coalesce(v_color.price, v_line.price) end;
  if v_price is null then
    raise exception 'Este filamento no tiene precio de lista';
  end if;

  v_have := case when p_refill then coalesce(v_color.stock_refill, 0)
                 else v_color.stock end;
  if v_have < p_qty then
    raise exception 'No hay stock suficiente (quedan %)', v_have;
  end if;

  perform public.move_filament(
    p_color, p_refill, -p_qty, 'sale', p_operator,
    p_qty || ' × ' || public.ars(v_price) || ' = ' || public.ars(v_price * p_qty)
      || ' · '
      || case p_payment when 'cash' then 'efectivo' else 'transferencia MP' end
      || coalesce(' · ' || v_customer, '')
  );

  insert into public.filament_sales
    (operator_id, color_id, line_label, color_label, refill, quantity,
     unit_price, payment, customer)
  values
    (p_operator, p_color, v_line.brand || ' ' || v_line.name, v_color.name,
     p_refill, p_qty, v_price, p_payment, v_customer)
  returning * into v_sale;

  return v_sale;
end;
$$;
```

(`create or replace` conserva los grants existentes de `sell_filament`.)

- [ ] **Step 2: Prueba en seco**

Una sola llamada `execute_sql` (proyecto `bukjmleercxlxbexekos`) con la migración completa seguida de:

```sql
do $$
declare
  v_op uuid; v_line uuid; v_color uuid; v_note text;
begin
  assert public.ars(12000) = '$12.000', 'ars 12000: ' || public.ars(12000);
  assert public.ars(1234567.4) = '$1.234.567', 'ars millón: ' || public.ars(1234567.4);
  assert public.ars(0) = '$0', 'ars 0: ' || public.ars(0);

  insert into public.operators (name, initials, role, pin_hash)
    values ('dryrun op', 'DO', 'operator', 'x') returning id into v_op;
  insert into public.filament_lines (brand, name, price)
    values ('dryrun', 'PLA', 12000) returning id into v_line;
  insert into public.filament_colors (line_id, name) values (v_line, 'Rojo')
    returning id into v_color;
  perform public.move_filament(v_color, false, 3, 'purchase', v_op, null);
  perform public.sell_filament(v_color, false, 2, 'cash', v_op, 'Juan');

  select note into v_note from public.filament_log
    where kind = 'sale' and line_label = 'dryrun PLA' order by created_at desc limit 1;
  assert v_note = '2 × $12.000 = $24.000 · efectivo · Juan', 'nota: ' || coalesce(v_note, 'null');

  raise exception 'DRYRUN_OK';
end;
$$;
```

Expected: error exactamente `DRYRUN_OK`. Si falla 2 veces seguidas, parar y reportar BLOCKED.

- [ ] **Step 3: Aplicar (lo hace el controlador)**

El implementador **no** aplica. Reporta el resultado de la prueba en seco. El controlador pide confirmación al dueño y aplica con `apply_migration` (nombre `filament_sale_note`).

- [ ] **Step 4: Commit (después de aplicada)**

```bash
git add supabase/migrations/20261008180000_filament_sale_note.sql
git commit -m "fix(filamentos): nota de venta con precio y total legibles"
```

---

### Task 6: Verificación completa y PR

- [ ] **Step 1:** `npm test && npm run typecheck && npm run lint && npm run build` → todo verde (0 errores de lint).
- [ ] **Step 2:** Con el server `dev`, el dueño inicia sesión (Claude no escribe PINs). Verificar con `read_page`/captura: como admin aparece "Estadísticas" en el menú y la pantalla carga con datos reales; cambiar Hoy/Semana/Mes/Rango; en un ancho de 375 px las tablas scrollean horizontalmente sin romper la página. Con perfil de operador: no aparece el ítem y `/admin/estadisticas` redirige a `/admin/hoy`.
- [ ] **Step 3:** `git push -u origin feature/estadisticas` y `gh pr create --base master` con resumen, cómo probar y `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. No mergear sin que el dueño lo pida.

# Números: pestaña Resumen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar una pestaña **Resumen** a `/admin/estadisticas` (menú "Números") con período Semana/Mes/Año en la URL, seis tarjetas y tres gráficos, calculados en el cliente con datos existentes más los cobros de la F1.

**Architecture:** Funciones puras de período (`period.ts`) y de agregación (`summary.ts`), una capa de carga (`summary.api.ts`) y componentes de presentación (`SummaryTab.tsx`, `charts.tsx`). La pantalla actual pasa a `CashTab` sin cambios de lógica y `StatsPage` queda como contenedor de pestañas. Sin migraciones ni tablas nuevas.

**Tech Stack:** React 18, TypeScript, react-router-dom (`useSearchParams`), Supabase JS, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-numeros-resumen-design.md`

## Global Constraints

- Rama: `feature/numeros-resumen`, apilada sobre `feature/cobros-canal` (PR #27). El PR de esta entrega apunta a `feature/cobros-canal`.
- Solo admin: sin tocar `adminOnly` del menú ni `OperatorAdminOnly` de la ruta.
- La ruta sigue siendo `/admin/estadisticas`; solo cambia la etiqueta del menú a **"Números"**.
- Texto de la UI en español rioplatense; montos con `money()` de `@/features/filaments/filaments` (formato `es-AR`).
- Sin librerías nuevas (gráficos en SVG/CSS propio). Colores: `#2f5fd0` (ventas) y `#c2500e` (resto); el texto nunca va en color de serie.
- Fecha de corte de migración `2026-09-30` (constante única `COMPARE_CUTOFF`); día de la carga masiva `2026-09-29`.
- Cálculos en funciones puras con Vitest **antes** de la UI. Nada de acceso a la base dentro de `summary.ts` ni `period.ts`.
- No commitear archivos locales: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `*.xlsx`.
- Correr tests con Node 22 (el Node 16 por defecto no sirve para vitest/eslint). En PowerShell:
  `$env:PATH = "$env:NVM_HOME\v22.22.3;$env:PATH"; node node_modules/vitest/vitest.mjs run <ruta>`
  y para tipos: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.
- Mensajes de commit terminan con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/features/stats/stats.ts` | Modificar | `PeriodKind` suma `'year'`; `periodRange` y `previousRange` lo resuelven |
| `src/features/stats/stats.test.ts` | Modificar | Tests del año |
| `src/features/stats/period.ts` | Crear | Período del Resumen: parseo de la URL, flechas, rangos, títulos, corte de migración |
| `src/features/stats/period.test.ts` | Crear | Tests de `period.ts` |
| `src/features/stats/summary.ts` | Crear | Agregaciones puras del Resumen |
| `src/features/stats/summary.test.ts` | Crear | Tests de `summary.ts` |
| `src/features/stats/stats.api.ts` | Modificar | Exportar `deliveredMoments` |
| `src/features/stats/summary.api.ts` | Crear | `loadSummary`: pedidos, cobros, ventas y entregas |
| `src/features/stats/summary.api.test.ts` | Crear | Tests de la carga |
| `src/features/stats/charts.tsx` | Crear | `WeeklyBars` (SVG), `ShareBars` (barras CSS) |
| `src/features/stats/charts.test.tsx` | Crear | Tests de los gráficos |
| `src/features/stats/SummaryTab.tsx` | Crear | Período, tarjetas y gráficos del Resumen |
| `src/features/stats/SummaryTab.test.tsx` | Crear | Tests de la pestaña |
| `src/features/stats/CashTab.tsx` | Crear (git mv de `StatsPage.tsx`) | Pantalla actual, sin cambios de lógica |
| `src/features/stats/CashTab.test.tsx` | Crear (git mv de `StatsPage.test.tsx`) | Tests actuales apuntando a `CashTab` |
| `src/features/stats/StatsPage.tsx` | Crear | Contenedor: título y pestañas |
| `src/features/stats/StatsPage.test.tsx` | Crear | Tests del contenedor |
| `src/features/stats/stats.css` | Modificar | Estilos de pestañas, período, gráficos y banner |
| `src/features/admin/AdminLayout.tsx` | Modificar | Etiqueta "Números" |
| `src/features/admin/AdminLayout.test.tsx` | Modificar | Etiqueta "Números" |

---

### Task 1: El año como período en `stats.ts`

**Files:**
- Modify: `src/features/stats/stats.ts` (`PeriodKind`, `periodRange`, `previousRange`)
- Test: `src/features/stats/stats.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `PeriodKind` ahora es `'today' | 'week' | 'month' | 'year' | 'custom'`. `periodRange('year', now)` devuelve `{ from: 1 ene, to: 1 ene del año siguiente }`. `previousRange('year', r)` devuelve el año anterior completo.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final del `describe('periodRange', ...)` y del `describe('previousRange', ...)` existentes en `src/features/stats/stats.test.ts` (si no existe un `describe('previousRange'`, crear uno con el mismo import):

```ts
  it('año: del 1 de enero al 1 de enero siguiente', () => {
    const r = periodRange('year', NOW)
    expect(r.from).toEqual(d(2026, 1, 1))
    expect(r.to).toEqual(d(2027, 1, 1))
  })
```

```ts
describe('previousRange (año)', () => {
  it('es el año anterior completo', () => {
    const r = periodRange('year', NOW)
    expect(previousRange('year', r)).toEqual({ from: d(2025, 1, 1), to: d(2026, 1, 1) })
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/stats.test.ts`
Expected: FAIL (error de tipos / `periodRange` devuelve el rango personalizado de hoy).

- [ ] **Step 3: Implementar**

En `src/features/stats/stats.ts`:

```ts
export type PeriodKind = 'today' | 'week' | 'month' | 'year' | 'custom'
```

En `periodRange`, justo después del bloque `if (kind === 'month') { ... }`:

```ts
  if (kind === 'year') {
    return {
      from: new Date(today.getFullYear(), 0, 1),
      to: new Date(today.getFullYear() + 1, 0, 1),
    }
  }
```

En `previousRange`, justo después del bloque de `'month'`:

```ts
  if (kind === 'year') {
    return { from: new Date(r.from.getFullYear() - 1, 0, 1), to: r.from }
  }
```

- [ ] **Step 4: Verificar**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/stats.test.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores (el `PERIODS` de `StatsPage.tsx` es una lista explícita, no se rompe).

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/stats.ts src/features/stats/stats.test.ts
git commit -m "feat(stats): el año como período"
```

---

### Task 2: Período del Resumen (`period.ts`)

**Files:**
- Create: `src/features/stats/period.ts`
- Test: `src/features/stats/period.test.ts`

**Interfaces:**
- Consumes: `periodRange`, `previousRange`, `comparisonRange`, `Range`, `PeriodKind` de `./stats`; `toISODate` de `@/features/orders/validation`.
- Produces (todo exportado):
  - `type SummaryKind = 'week' | 'month' | 'year'`
  - `interface SummaryPeriod { kind: SummaryKind; start: Date }` (`start` = primer día del período, hora 00:00 local)
  - `COMPARE_CUTOFF: Date` (30/09/2026), `MIGRATION_DAY: Date` (29/09/2026)
  - `parsePeriod(params: URLSearchParams, now: Date): SummaryPeriod`
  - `periodToParams(period: SummaryPeriod, now: Date): Record<string, string>`
  - `isCurrentPeriod(period, now): boolean`
  - `shiftPeriod(period, delta: -1 | 1, now): SummaryPeriod` (nunca pasa del período en curso)
  - `rangeOfPeriod(period): Range`
  - `comparisonFor(period, now): Range | null`
  - `containsMigration(range: Range): boolean`
  - `periodTitle(period): string`, `compareLabel(period): string`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/features/stats/period.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  compareLabel,
  comparisonFor,
  containsMigration,
  isCurrentPeriod,
  parsePeriod,
  periodTitle,
  periodToParams,
  rangeOfPeriod,
  shiftPeriod,
} from './period'

// Martes 13 de octubre de 2026, 12:00 local.
const NOW = new Date(2026, 9, 13, 12)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const q = (s: string) => new URLSearchParams(s)

describe('parsePeriod', () => {
  it('sin parámetros: el mes en curso', () => {
    expect(parsePeriod(q(''), NOW)).toEqual({ kind: 'month', start: day(2026, 10, 1) })
  })

  it('semana sin ancla: el lunes de la semana en curso', () => {
    expect(parsePeriod(q('p=semana'), NOW)).toEqual({ kind: 'week', start: day(2026, 10, 12) })
  })

  it('semana con ancla: la normaliza al lunes', () => {
    expect(parsePeriod(q('p=semana&d=2026-10-07'), NOW)).toEqual({
      kind: 'week',
      start: day(2026, 10, 5),
    })
  })

  it('mes y año con ancla', () => {
    expect(parsePeriod(q('p=mes&d=2026-09'), NOW).start).toEqual(day(2026, 9, 1))
    expect(parsePeriod(q('p=anio&d=2025'), NOW)).toEqual({ kind: 'year', start: day(2025, 1, 1) })
  })

  it('ancla inválida o de otro formato: el período en curso', () => {
    expect(parsePeriod(q('p=mes&d=2026-13'), NOW).start).toEqual(day(2026, 10, 1))
    expect(parsePeriod(q('p=semana&d=2026-02-31'), NOW).start).toEqual(day(2026, 10, 12))
    expect(parsePeriod(q('p=anio&d=hola'), NOW).start).toEqual(day(2026, 1, 1))
  })

  it('ancla futura: el período en curso', () => {
    expect(parsePeriod(q('p=mes&d=2027-01'), NOW).start).toEqual(day(2026, 10, 1))
  })

  it('p desconocido: mes', () => {
    expect(parsePeriod(q('p=hoy'), NOW).kind).toBe('month')
  })
})

describe('periodToParams', () => {
  it('el período en curso no lleva ancla', () => {
    expect(periodToParams({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toEqual({ p: 'mes' })
  })

  it('un período pasado lleva ancla según su tipo', () => {
    expect(periodToParams({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toEqual({
      p: 'mes',
      d: '2026-09',
    })
    expect(periodToParams({ kind: 'week', start: day(2026, 10, 5) }, NOW)).toEqual({
      p: 'semana',
      d: '2026-10-05',
    })
    expect(periodToParams({ kind: 'year', start: day(2025, 1, 1) }, NOW)).toEqual({
      p: 'anio',
      d: '2025',
    })
  })

  it('ida y vuelta con parsePeriod', () => {
    const p = { kind: 'week' as const, start: day(2026, 9, 28) }
    const params = new URLSearchParams(periodToParams(p, NOW))
    expect(parsePeriod(params, NOW)).toEqual(p)
  })
})

describe('shiftPeriod', () => {
  it('mes hacia atrás y adelante', () => {
    const oct = { kind: 'month' as const, start: day(2026, 10, 1) }
    const sep = shiftPeriod(oct, -1, NOW)
    expect(sep.start).toEqual(day(2026, 9, 1))
    expect(shiftPeriod(sep, 1, NOW).start).toEqual(day(2026, 10, 1))
  })

  it('no pasa del período en curso', () => {
    const oct = { kind: 'month' as const, start: day(2026, 10, 1) }
    expect(shiftPeriod(oct, 1, NOW)).toEqual(oct)
  })

  it('semana y año', () => {
    expect(shiftPeriod({ kind: 'week', start: day(2026, 10, 12) }, -1, NOW).start).toEqual(
      day(2026, 10, 5),
    )
    expect(shiftPeriod({ kind: 'year', start: day(2026, 1, 1) }, -1, NOW).start).toEqual(
      day(2025, 1, 1),
    )
  })

  it('cruza el fin de año', () => {
    expect(shiftPeriod({ kind: 'month', start: day(2026, 1, 1) }, -1, NOW).start).toEqual(
      day(2025, 12, 1),
    )
  })
})

describe('isCurrentPeriod / rangeOfPeriod', () => {
  it('reconoce el período en curso', () => {
    expect(isCurrentPeriod({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toBe(true)
    expect(isCurrentPeriod({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toBe(false)
  })

  it('rango semiabierto del período', () => {
    expect(rangeOfPeriod({ kind: 'week', start: day(2026, 10, 5) })).toEqual({
      from: day(2026, 10, 5),
      to: day(2026, 10, 12),
    })
  })
})

describe('comparisonFor', () => {
  it('antes del corte de migración no se compara', () => {
    expect(comparisonFor({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toBeNull()
    expect(comparisonFor({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toBeNull()
  })

  it('período en curso: mismo tramo del anterior', () => {
    const nov = new Date(2026, 10, 10, 12)
    const cmp = comparisonFor({ kind: 'month', start: day(2026, 11, 1) }, nov)
    expect(cmp?.from).toEqual(day(2026, 10, 1))
    // 9 días transcurridos (1 a 10 de noviembre a las 12:00) sobre el 1 de octubre.
    expect(cmp?.to.getTime()).toBeLessThan(day(2026, 11, 1).getTime())
  })

  it('período cerrado: el anterior completo', () => {
    const dec = new Date(2026, 11, 20)
    const cmp = comparisonFor({ kind: 'month', start: day(2026, 11, 1) }, dec)
    expect(cmp).toEqual({ from: day(2026, 10, 1), to: day(2026, 11, 1) })
  })
})

describe('containsMigration', () => {
  it('septiembre sí, octubre no', () => {
    expect(containsMigration({ from: day(2026, 9, 1), to: day(2026, 10, 1) })).toBe(true)
    expect(containsMigration({ from: day(2026, 10, 1), to: day(2026, 11, 1) })).toBe(false)
  })
})

describe('títulos', () => {
  it('periodTitle', () => {
    expect(periodTitle({ kind: 'month', start: day(2026, 9, 1) })).toBe('Septiembre 2026')
    expect(periodTitle({ kind: 'week', start: day(2026, 10, 5) })).toBe('Semana del 5 al 11 de octubre')
    expect(periodTitle({ kind: 'week', start: day(2026, 9, 28) })).toBe(
      'Semana del 28 de septiembre al 4 de octubre',
    )
    expect(periodTitle({ kind: 'year', start: day(2026, 1, 1) })).toBe('2026')
  })

  it('compareLabel', () => {
    expect(compareLabel({ kind: 'month', start: day(2026, 9, 1) })).toBe('comparado con agosto')
    expect(compareLabel({ kind: 'month', start: day(2026, 1, 1) })).toBe('comparado con diciembre')
    expect(compareLabel({ kind: 'week', start: day(2026, 10, 5) })).toBe(
      'comparado con la semana anterior',
    )
    expect(compareLabel({ kind: 'year', start: day(2026, 1, 1) })).toBe('comparado con 2025')
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/period.test.ts`
Expected: FAIL ("Failed to resolve import ./period").

- [ ] **Step 3: Implementar**

Crear `src/features/stats/period.ts`:

```ts
import { toISODate } from '@/features/orders/validation'
import { comparisonRange, periodRange, previousRange, type Range } from './stats'

export type SummaryKind = 'week' | 'month' | 'year'

// `start` is the first day of the period at local midnight.
export interface SummaryPeriod {
  kind: SummaryKind
  start: Date
}

// Orders loaded in one go on 29/09 (spreadsheet migration) make September
// meaningless as a base: nothing before this day is used for comparison.
export const COMPARE_CUTOFF = new Date(2026, 8, 30)
export const MIGRATION_DAY = new Date(2026, 8, 29)

const PARAM: Record<SummaryKind, string> = { week: 'semana', month: 'mes', year: 'anio' }
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const pad = (n: number) => String(n).padStart(2, '0')

function parseAnchor(kind: SummaryKind, value: string): Date | null {
  const pattern =
    kind === 'year' ? /^(\d{4})$/ : kind === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/
  const m = pattern.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = m[2] ? Number(m[2]) - 1 : 0
  const d = m[3] ? Number(m[3]) : 1
  const date = new Date(y, mo, d)
  // Rolled-over dates (month 13, 31 Feb) are rejected.
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null
  return date
}

function currentStart(kind: SummaryKind, now: Date): Date {
  return periodRange(kind, now).from
}

export function isCurrentPeriod(period: SummaryPeriod, now: Date): boolean {
  return period.start.getTime() === currentStart(period.kind, now).getTime()
}

export function parsePeriod(params: URLSearchParams, now: Date): SummaryPeriod {
  const p = params.get('p')
  const kind: SummaryKind = p === 'semana' ? 'week' : p === 'anio' ? 'year' : 'month'
  const current = { kind, start: currentStart(kind, now) }
  const anchor = params.get('d')
  if (!anchor) return current
  const date = parseAnchor(kind, anchor)
  if (!date) return current
  const start = periodRange(kind, date).from
  return start.getTime() > current.start.getTime() ? current : { kind, start }
}

// The current period carries no anchor so the link keeps meaning "now".
export function periodToParams(period: SummaryPeriod, now: Date): Record<string, string> {
  const p = PARAM[period.kind]
  if (isCurrentPeriod(period, now)) return { p }
  const s = period.start
  const d =
    period.kind === 'year'
      ? String(s.getFullYear())
      : period.kind === 'month'
        ? `${s.getFullYear()}-${pad(s.getMonth() + 1)}`
        : toISODate(s)
  return { p, d }
}

export function shiftPeriod(period: SummaryPeriod, delta: -1 | 1, now: Date): SummaryPeriod {
  const s = period.start
  const next =
    period.kind === 'week'
      ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * delta)
      : period.kind === 'month'
        ? new Date(s.getFullYear(), s.getMonth() + delta, 1)
        : new Date(s.getFullYear() + delta, 0, 1)
  const current = currentStart(period.kind, now)
  return { kind: period.kind, start: next.getTime() > current.getTime() ? current : next }
}

export function rangeOfPeriod(period: SummaryPeriod): Range {
  return periodRange(period.kind, period.start)
}

// Open period: same elapsed stretch of the previous one. Closed period: the
// whole previous one. Null when that base starts before the migration cut.
export function comparisonFor(period: SummaryPeriod, now: Date): Range | null {
  const curr = rangeOfPeriod(period)
  const cmp = isCurrentPeriod(period, now)
    ? comparisonRange(period.kind, curr, now)
    : previousRange(period.kind, curr)
  return cmp.from.getTime() < COMPARE_CUTOFF.getTime() ? null : cmp
}

export function containsMigration(range: Range): boolean {
  const t = MIGRATION_DAY.getTime()
  return range.from.getTime() <= t && t < range.to.getTime()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function periodTitle(period: SummaryPeriod): string {
  const s = period.start
  if (period.kind === 'year') return String(s.getFullYear())
  if (period.kind === 'month') return `${capitalize(MONTHS[s.getMonth()])} ${s.getFullYear()}`
  const end = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)
  if (end.getMonth() === s.getMonth()) {
    return `Semana del ${s.getDate()} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
  }
  return `Semana del ${s.getDate()} de ${MONTHS[s.getMonth()]} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`
}

export function compareLabel(period: SummaryPeriod): string {
  const s = period.start
  if (period.kind === 'year') return `comparado con ${s.getFullYear() - 1}`
  if (period.kind === 'week') return 'comparado con la semana anterior'
  const prev = new Date(s.getFullYear(), s.getMonth() - 1, 1)
  return `comparado con ${MONTHS[prev.getMonth()]}`
}
```

- [ ] **Step 4: Verificar**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/period.test.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/period.ts src/features/stats/period.test.ts
git commit -m "feat(stats): período del Resumen en la URL, flechas y corte de migración"
```

---

### Task 3: Agregaciones del Resumen (`summary.ts`)

**Files:**
- Create: `src/features/stats/summary.ts`
- Test: `src/features/stats/summary.test.ts`

**Interfaces:**
- Consumes: `inRange`, `pctChange`, `Range` de `./stats`; `toISODate` de `@/features/orders/validation`; `ORIGIN_CHANNEL_LABELS` de `@/lib/domain-constants`.
- Produces (todo exportado):
  - `interface SummaryOrder { id: string; customer_id: string; created_at: string; due_date: string; status: string; total_amount: number | null; pending_balance: number | null; flexible: boolean; origin_channel: string | null; quantity: number }`
  - `interface SummaryPayment { id: string; amount: number; method: string | null; at: string; source: 'order' | 'direct' | 'filament' }`
  - `sold(orders, range)` → `{ amount, orders, units, withAmount, withoutAmount }`
  - `ticketAverage(s: ReturnType<typeof sold>): number | null`
  - `collected(payments, range)` → `{ total, count, orders, direct, filament }`
  - `receivable(orders, cutoff: Date)` → `{ amount, orders, legacyOrders, legacyAmount }`
  - `onTimeRate(orders, deliveredAt: ReadonlyMap<string, string>, range)` → `{ total, late, rate: number | null }`
  - `newCustomers(orders, range)` → `{ fresh, total }`
  - `interface WeekBar { start: Date; label: string; count: number; partial: boolean }` y `ordersByWeek(orders, range, now, weeks = 8): WeekBar[]`
  - `interface ShareRow { key: string; label: string; value: number; pct: number }`, `byChannel(orders, range): ShareRow[]` (value = pedidos), `collectedByMethod(payments, range): ShareRow[]` (value = monto)
  - `pointsDiff(curr: number | null, prev: number | null): number | null`
  - re-export de `pctChange` desde `./stats` para uso de la UI.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/features/stats/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  byChannel,
  collected,
  collectedByMethod,
  newCustomers,
  onTimeRate,
  ordersByWeek,
  pointsDiff,
  receivable,
  sold,
  ticketAverage,
  type SummaryOrder,
  type SummaryPayment,
} from './summary'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString()
const OCT = { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) }

function order(over: Partial<SummaryOrder> = {}): SummaryOrder {
  return {
    id: 'o',
    customer_id: 'c1',
    created_at: at(2026, 10, 5),
    due_date: '2026-10-20',
    status: 'in_queue',
    total_amount: 10000,
    pending_balance: 0,
    flexible: false,
    origin_channel: 'whatsapp',
    quantity: 1,
    ...over,
  }
}

function pay(over: Partial<SummaryPayment> = {}): SummaryPayment {
  return { id: 'p', amount: 1000, method: 'cash', at: at(2026, 10, 5), source: 'order', ...over }
}

describe('sold', () => {
  it('cuenta por alta, sin cancelados, con unidades', () => {
    const rows = [
      order({ id: 'a', total_amount: 10000, quantity: 2 }),
      order({ id: 'b', total_amount: 5000, quantity: 3 }),
      order({ id: 'c', status: 'cancelled', total_amount: 99999 }),
      order({ id: 'd', created_at: at(2026, 9, 28), total_amount: 7000 }),
    ]
    expect(sold(rows, OCT)).toEqual({
      amount: 15000,
      orders: 2,
      units: 5,
      withAmount: 2,
      withoutAmount: 0,
    })
  })

  it('los pedidos sin monto cuentan como pedido pero no suman ni promedian', () => {
    const rows = [order({ id: 'a', total_amount: 9000 }), order({ id: 'b', total_amount: null })]
    const s = sold(rows, OCT)
    expect(s).toMatchObject({ amount: 9000, orders: 2, withAmount: 1, withoutAmount: 1 })
    expect(ticketAverage(s)).toBe(9000)
  })

  it('período vacío: ticket nulo', () => {
    expect(ticketAverage(sold([], OCT))).toBeNull()
  })
})

describe('collected', () => {
  it('suma por origen y respeta el período', () => {
    const rows = [
      pay({ id: '1', amount: 1000, source: 'order' }),
      pay({ id: '2', amount: 500, source: 'direct' }),
      pay({ id: '3', amount: 2500, source: 'filament' }),
      pay({ id: '4', amount: 9999, at: at(2026, 9, 30) }),
    ]
    expect(collected(rows, OCT)).toEqual({
      total: 4000,
      count: 3,
      orders: 1000,
      direct: 500,
      filament: 2500,
    })
  })
})

describe('collectedByMethod', () => {
  it('agrupa otros medios y marca el que no tiene', () => {
    const rows = [
      pay({ id: '1', amount: 3000, method: 'cash' }),
      pay({ id: '2', amount: 1000, method: 'uala' }),
      pay({ id: '3', amount: 1000, method: 'brubank' }),
      pay({ id: '4', amount: 2000, method: null }),
      pay({ id: '5', amount: 3000, method: 'transfer' }),
    ]
    const out = collectedByMethod(rows, OCT)
    // A igual monto, desempata por etiqueta: "Otros" antes que "Sin medio".
    expect(out.map((r) => [r.key, r.value])).toEqual([
      ['cash', 3000],
      ['transfer', 3000],
      ['other', 2000],
      ['none', 2000],
    ])
    expect(out.find((r) => r.key === 'none')?.label).toBe('Sin medio')
    expect(out.reduce((s, r) => s + r.pct, 0)).toBeGreaterThanOrEqual(99)
  })

  it('sin cobros: lista vacía', () => {
    expect(collectedByMethod([], OCT)).toEqual([])
  })
})

describe('receivable', () => {
  const cutoff = new Date(2026, 8, 30)

  it('cuenta saldos desde el corte y aparta los anteriores', () => {
    const rows = [
      order({ id: 'a', pending_balance: 4000 }),
      order({ id: 'b', pending_balance: 1000, created_at: at(2026, 9, 29) }),
      order({ id: 'c', pending_balance: 0 }),
      order({ id: 'd', pending_balance: 8000, status: 'cancelled' }),
      order({ id: 'e', pending_balance: null }),
    ]
    expect(receivable(rows, cutoff)).toEqual({
      amount: 4000,
      orders: 1,
      legacyOrders: 1,
      legacyAmount: 1000,
    })
  })
})

describe('onTimeRate', () => {
  const deliveredAt = new Map([
    ['a', at(2026, 10, 18)], // a tiempo (vence 20)
    ['b', at(2026, 10, 22)], // tarde
    ['c', at(2026, 10, 10)], // flexible: fuera
    ['e', at(2026, 9, 10)], // fuera del período
  ])

  it('porcentaje sobre entregados con fecha real, sin flexibles', () => {
    const rows = [
      order({ id: 'a' }),
      order({ id: 'b' }),
      order({ id: 'c', flexible: true }),
      order({ id: 'd' }), // sin evento de entrega
      order({ id: 'e' }),
    ]
    expect(onTimeRate(rows, deliveredAt, OCT)).toEqual({ total: 2, late: 1, rate: 50 })
  })

  it('el día de vencimiento cuenta como a tiempo', () => {
    const map = new Map([['a', at(2026, 10, 20, 23)]])
    expect(onTimeRate([order({ id: 'a', due_date: '2026-10-20' })], map, OCT).rate).toBe(100)
  })

  it('sin entregas: tasa nula', () => {
    expect(onTimeRate([order()], new Map(), OCT)).toEqual({ total: 0, late: 0, rate: null })
  })
})

describe('newCustomers', () => {
  it('es nuevo quien tuvo su primer pedido en el período', () => {
    const rows = [
      order({ id: 'a', customer_id: 'viejo', created_at: at(2026, 8, 3) }),
      order({ id: 'b', customer_id: 'viejo', created_at: at(2026, 10, 3) }),
      order({ id: 'c', customer_id: 'nuevo', created_at: at(2026, 10, 4) }),
      order({ id: 'd', customer_id: 'nuevo', created_at: at(2026, 10, 9) }),
      order({ id: 'e', customer_id: 'cancelado', created_at: at(2026, 10, 9), status: 'cancelled' }),
      order({ id: 'f', customer_id: 'futuro', created_at: at(2026, 11, 2) }),
    ]
    expect(newCustomers(rows, OCT)).toEqual({ fresh: 1, total: 2 })
  })
})

describe('ordersByWeek', () => {
  // Martes 13 de octubre de 2026.
  const NOW = new Date(2026, 9, 13, 12)

  it('8 semanas de lunes a domingo; la última en curso es parcial', () => {
    const rows = [
      order({ id: 'a', created_at: at(2026, 10, 13) }),
      order({ id: 'b', created_at: at(2026, 10, 7) }),
      order({ id: 'c', created_at: at(2026, 10, 5) }),
      order({ id: 'x', created_at: at(2026, 10, 6), status: 'cancelled' }),
    ]
    const bars = ordersByWeek(rows, OCT, NOW)
    expect(bars).toHaveLength(8)
    expect(bars[7]).toMatchObject({ label: '12/10', count: 1, partial: true })
    expect(bars[6]).toMatchObject({ label: '5/10', count: 2, partial: false })
    expect(bars[0].label).toBe('24/8')
  })

  it('un período cerrado termina en su última semana', () => {
    const sep = { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) }
    const bars = ordersByWeek([], sep, NOW)
    expect(bars[7].label).toBe('28/9')
    expect(bars[7].partial).toBe(false)
  })
})

describe('byChannel', () => {
  it('agrupa WhatsApp, deja el nulo como "Sin canal" y ordena', () => {
    const rows = [
      order({ id: 'a', origin_channel: 'whatsapp' }),
      order({ id: 'b', origin_channel: 'whatsapp_personal' }),
      order({ id: 'c', origin_channel: 'instagram' }),
      order({ id: 'd', origin_channel: null }),
      order({ id: 'e', origin_channel: 'mercadolibre' }),
      order({ id: 'f', origin_channel: 'instagram', status: 'cancelled' }),
    ]
    const out = byChannel(rows, OCT)
    expect(out[0]).toMatchObject({ key: 'whatsapp', label: 'WhatsApp', value: 2, pct: 40 })
    expect(out.map((r) => r.label)).toContain('Sin canal')
    expect(out.map((r) => r.label)).toContain('Mercado Libre')
    expect(out.reduce((s, r) => s + r.value, 0)).toBe(5)
  })
})

describe('pointsDiff', () => {
  it('diferencia en puntos o nulo si falta un lado', () => {
    expect(pointsDiff(71, 80)).toBe(-9)
    expect(pointsDiff(null, 80)).toBeNull()
    expect(pointsDiff(71, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/summary.test.ts`
Expected: FAIL (import `./summary` no resuelve).

- [ ] **Step 3: Implementar**

Crear `src/features/stats/summary.ts`:

```ts
import { toISODate } from '@/features/orders/validation'
import { ORIGIN_CHANNEL_LABELS, type OriginChannel } from '@/lib/domain-constants'
import { inRange, type Range } from './stats'

export { pctChange } from './stats'

// What the Resumen needs of an order; `quantity` is the sum of its items.
export interface SummaryOrder {
  id: string
  customer_id: string
  created_at: string
  due_date: string
  status: string
  total_amount: number | null
  pending_balance: number | null
  flexible: boolean
  origin_channel: string | null
  quantity: number
}

// Money that came in: an order payment, a direct product sale or a spool sale.
export interface SummaryPayment {
  id: string
  amount: number
  method: string | null
  at: string
  source: 'order' | 'direct' | 'filament'
}

const live = (o: SummaryOrder) => o.status !== 'cancelled'

export function sold(orders: readonly SummaryOrder[], range: Range) {
  let amount = 0
  let count = 0
  let units = 0
  let withAmount = 0
  for (const o of orders) {
    if (!live(o) || !inRange(o.created_at, range)) continue
    count++
    units += o.quantity
    if (o.total_amount != null) {
      amount += o.total_amount
      withAmount++
    }
  }
  return { amount, orders: count, units, withAmount, withoutAmount: count - withAmount }
}

export function ticketAverage(s: ReturnType<typeof sold>): number | null {
  return s.withAmount > 0 ? s.amount / s.withAmount : null
}

export function collected(payments: readonly SummaryPayment[], range: Range) {
  const out = { total: 0, count: 0, orders: 0, direct: 0, filament: 0 }
  for (const p of payments) {
    if (!inRange(p.at, range)) continue
    out.total += p.amount
    out.count++
    if (p.source === 'order') out.orders += p.amount
    else if (p.source === 'direct') out.direct += p.amount
    else out.filament += p.amount
  }
  return out
}

// A snapshot of today. Orders loaded before the cut keep an unconfirmed
// balance (the spreadsheet never said if it was paid): counted apart.
export function receivable(orders: readonly SummaryOrder[], cutoff: Date) {
  const out = { amount: 0, orders: 0, legacyOrders: 0, legacyAmount: 0 }
  for (const o of orders) {
    const balance = o.pending_balance ?? 0
    if (!live(o) || balance <= 0) continue
    if (new Date(o.created_at).getTime() >= cutoff.getTime()) {
      out.amount += balance
      out.orders++
    } else {
      out.legacyAmount += balance
      out.legacyOrders++
    }
  }
  return out
}

// Delivered in the period (by the real delivery event), not "sin apuro".
export function onTimeRate(
  orders: readonly SummaryOrder[],
  deliveredAt: ReadonlyMap<string, string>,
  range: Range,
) {
  let total = 0
  let late = 0
  for (const o of orders) {
    const at = deliveredAt.get(o.id)
    if (!at || !live(o) || o.flexible || !inRange(at, range)) continue
    total++
    if (toISODate(new Date(at)) > o.due_date) late++
  }
  return { total, late, rate: total > 0 ? Math.round(((total - late) / total) * 100) : null }
}

// New = the customer's first (non-cancelled) order falls in the period.
export function newCustomers(orders: readonly SummaryOrder[], range: Range) {
  const first = new Map<string, number>()
  for (const o of orders) {
    if (!live(o)) continue
    const t = new Date(o.created_at).getTime()
    const prev = first.get(o.customer_id)
    if (prev === undefined || t < prev) first.set(o.customer_id, t)
  }
  let fresh = 0
  let total = 0
  for (const t of first.values()) {
    if (t < range.to.getTime()) total++
    if (t >= range.from.getTime() && t < range.to.getTime()) fresh++
  }
  return { fresh, total }
}

export interface WeekBar {
  start: Date
  label: string
  count: number
  partial: boolean
}

function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
}

// `weeks` Monday-to-Sunday weeks ending in the week of the period's last day
// (or today if the period is still open).
export function ordersByWeek(
  orders: readonly SummaryOrder[],
  range: Range,
  now: Date,
  weeks = 8,
): WeekBar[] {
  const lastMoment = new Date(Math.min(range.to.getTime() - 1, now.getTime()))
  const last = mondayOf(lastMoment)
  const bars: WeekBar[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(last.getFullYear(), last.getMonth(), last.getDate() - 7 * i)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
    const count = orders.filter(
      (o) => live(o) && inRange(o.created_at, { from: start, to: end }),
    ).length
    bars.push({
      start,
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      count,
      partial: end.getTime() > now.getTime(),
    })
  }
  return bars
}

export interface ShareRow {
  key: string
  label: string
  value: number
  pct: number
}

function shares(map: Map<string, ShareRow>): ShareRow[] {
  const rows = [...map.values()]
  const total = rows.reduce((s, r) => s + r.value, 0)
  return rows
    .map((r) => ({ ...r, pct: total > 0 ? Math.round((r.value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export function byChannel(orders: readonly SummaryOrder[], range: Range): ShareRow[] {
  const map = new Map<string, ShareRow>()
  for (const o of orders) {
    if (!live(o) || !inRange(o.created_at, range)) continue
    const raw = o.origin_channel
    const key = raw === 'whatsapp' || raw === 'whatsapp_personal' ? 'whatsapp' : (raw ?? 'none')
    const label =
      key === 'whatsapp'
        ? 'WhatsApp'
        : key === 'none'
          ? 'Sin canal'
          : (ORIGIN_CHANNEL_LABELS[key as OriginChannel] ?? 'Otro')
    const row = map.get(key) ?? { key, label, value: 0, pct: 0 }
    row.value++
    map.set(key, row)
  }
  return shares(map)
}

const METHOD_GROUP: Record<string, { key: string; label: string }> = {
  cash: { key: 'cash', label: 'Efectivo' },
  transfer: { key: 'transfer', label: 'Transferencia' },
  mercadopago: { key: 'mercadopago', label: 'Mercado Pago' },
}

export function collectedByMethod(payments: readonly SummaryPayment[], range: Range): ShareRow[] {
  const map = new Map<string, ShareRow>()
  for (const p of payments) {
    if (!inRange(p.at, range)) continue
    const group =
      p.method === null
        ? { key: 'none', label: 'Sin medio' }
        : (METHOD_GROUP[p.method] ?? { key: 'other', label: 'Otros' })
    const row = map.get(group.key) ?? { ...group, value: 0, pct: 0 }
    row.value += p.amount
    map.set(group.key, row)
  }
  return shares(map)
}

export function pointsDiff(curr: number | null, prev: number | null): number | null {
  return curr === null || prev === null ? null : curr - prev
}
```

- [ ] **Step 4: Verificar**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/summary.test.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/summary.ts src/features/stats/summary.test.ts
git commit -m "feat(stats): agregaciones del Resumen (vendido, cobrado, por cobrar, a tiempo, clientes, canales)"
```

---

### Task 4: Carga de datos del Resumen (`summary.api.ts`)

**Files:**
- Modify: `src/features/stats/stats.api.ts` (exportar `deliveredMoments`)
- Create: `src/features/stats/summary.api.ts`
- Test: `src/features/stats/summary.api.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `deliveredMoments(): Promise<Map<string, string>>` de `./stats.api`; `SummaryOrder`, `SummaryPayment` de `./summary`; `Range` de `./stats`.
- Produces:
  - `interface SummaryData { orders: SummaryOrder[]; payments: SummaryPayment[]; deliveredAt: Map<string, string> }`
  - `loadSummary(range: Range, cmp: Range | null): Promise<SummaryData>` — trae **todos** los pedidos (columnas mínimas), los cobros y ventas con fecha entre `min(range.from, cmp.from)` y `range.to`, y los eventos de entrega.

- [ ] **Step 1: Exportar `deliveredMoments`**

En `src/features/stats/stats.api.ts` cambiar `async function deliveredMoments()` por `export async function deliveredMoments()`. No cambia nada más.

- [ ] **Step 2: Escribir el test que falla**

Crear `src/features/stats/summary.api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const calls: { table: string; filters: unknown[][] }[] = []
  const data: Record<string, unknown[]> = {}
  function from(table: string) {
    const entry = { table, filters: [] as unknown[][] }
    calls.push(entry)
    const q = {
      select: () => q,
      in: (...a: unknown[]) => (entry.filters.push(['in', ...a]), q),
      is: (...a: unknown[]) => (entry.filters.push(['is', ...a]), q),
      gte: (...a: unknown[]) => (entry.filters.push(['gte', ...a]), q),
      lt: (...a: unknown[]) => (entry.filters.push(['lt', ...a]), q),
      order: () => q,
      range: () => q,
      then: (resolve: (v: unknown) => void) => resolve({ data: data[table] ?? [], error: null }),
    }
    return q
  }
  return { calls, data, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: h.from } }))
vi.mock('./stats.api', () => ({
  deliveredMoments: vi.fn().mockResolvedValue(new Map([['o1', '2026-10-08T12:00:00Z']])),
}))

import { loadSummary } from './summary.api'

const RANGE = { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) }
const CMP = { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) }

describe('loadSummary', () => {
  beforeEach(() => {
    h.calls.length = 0
    for (const k of Object.keys(h.data)) delete h.data[k]
  })

  it('suma las unidades de los ítems de cada pedido', async () => {
    h.data.orders = [
      {
        id: 'o1', customer_id: 'c1', created_at: '2026-10-02T10:00:00Z', due_date: '2026-10-20',
        status: 'new', total_amount: 5000, pending_balance: 1000, flexible: false,
        origin_channel: 'whatsapp', order_items: [{ quantity: 2 }, { quantity: 3 }],
      },
      {
        id: 'o2', customer_id: 'c2', created_at: '2026-10-03T10:00:00Z', due_date: '2026-10-21',
        status: 'new', total_amount: null, pending_balance: null, flexible: true,
        origin_channel: null, order_items: [],
      },
    ]
    const out = await loadSummary(RANGE, null)
    expect(out.orders.map((o) => [o.id, o.quantity])).toEqual([['o1', 5], ['o2', 0]])
    expect(out.orders[0]).not.toHaveProperty('order_items')
  })

  it('cobros de pedidos, ventas directas y filamento con su origen', async () => {
    h.data.transactions = [
      { id: 't1', type: '3d_service', amount: 3000, method: 'cash', transacted_at: '2026-10-02T10:00:00Z' },
      { id: 't2', type: 'product_sale', amount: 800, method: null, transacted_at: '2026-10-03T10:00:00Z' },
    ]
    h.data.filament_sales = [
      { id: 'f1', total: 12000, payment: 'transfer', created_at: '2026-10-04T10:00:00Z' },
    ]
    const out = await loadSummary(RANGE, null)
    expect(out.payments).toEqual([
      { id: 't1', amount: 3000, method: 'cash', at: '2026-10-02T10:00:00Z', source: 'order' },
      { id: 't2', amount: 800, method: null, at: '2026-10-03T10:00:00Z', source: 'direct' },
      { id: 'f1', amount: 12000, method: 'transfer', at: '2026-10-04T10:00:00Z', source: 'filament' },
    ])
  })

  it('excluye anuladas y pide desde el comienzo del período de comparación', async () => {
    await loadSummary(RANGE, CMP)
    const tx = h.calls.find((c) => c.table === 'transactions')!
    expect(tx.filters).toContainEqual(['is', 'voided_at', null])
    expect(tx.filters).toContainEqual(['gte', 'transacted_at', CMP.from.toISOString()])
    expect(tx.filters).toContainEqual(['lt', 'transacted_at', RANGE.to.toISOString()])
    const fs = h.calls.find((c) => c.table === 'filament_sales')!
    expect(fs.filters).toContainEqual(['is', 'voided_at', null])
    expect(fs.filters).toContainEqual(['gte', 'created_at', CMP.from.toISOString()])
  })

  it('sin comparación pide desde el comienzo del período', async () => {
    await loadSummary(RANGE, null)
    const tx = h.calls.find((c) => c.table === 'transactions')!
    expect(tx.filters).toContainEqual(['gte', 'transacted_at', RANGE.from.toISOString()])
  })

  it('devuelve las entregas reales', async () => {
    const out = await loadSummary(RANGE, null)
    expect(out.deliveredAt.get('o1')).toBe('2026-10-08T12:00:00Z')
  })
})
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/summary.api.test.ts`
Expected: FAIL (`./summary.api` no existe).

- [ ] **Step 4: Implementar**

Crear `src/features/stats/summary.api.ts`:

```ts
import { supabase } from '@/lib/supabase'
import { deliveredMoments } from './stats.api'
import type { Range } from './stats'
import type { SummaryOrder, SummaryPayment } from './summary'

export interface SummaryData {
  orders: SummaryOrder[]
  payments: SummaryPayment[]
  deliveredAt: Map<string, string>
}

const PAGE = 1000

// PostgREST caps a response at 1000 rows: read the orders page by page.
async function allOrders(): Promise<SummaryOrder[]> {
  const out: SummaryOrder[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('orders')
      .select(
        'id, customer_id, created_at, due_date, status, total_amount, pending_balance, flexible, origin_channel, order_items(quantity)',
      )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as (Omit<SummaryOrder, 'quantity'> & {
      order_items: { quantity: number }[] | null
    })[]
    for (const { order_items, ...o } of rows) {
      out.push({ ...o, quantity: (order_items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0) })
    }
    if (rows.length < PAGE) return out
  }
}

// Orders are read whole (tens a month; "Por cobrar" and "clientes nuevos" need
// the history). Payments and sales only from the oldest day any card needs.
export async function loadSummary(range: Range, cmp: Range | null): Promise<SummaryData> {
  const since = (cmp && cmp.from.getTime() < range.from.getTime() ? cmp.from : range.from).toISOString()
  const until = range.to.toISOString()

  const [orders, tx, filament, deliveredAt] = await Promise.all([
    allOrders(),
    supabase
      .from('transactions')
      .select('id, type, amount, method, transacted_at')
      .in('type', ['3d_service', 'product_sale'])
      .is('voided_at', null)
      .gte('transacted_at', since)
      .lt('transacted_at', until)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    supabase
      .from('filament_sales')
      .select('id, total, payment, created_at')
      .is('voided_at', null)
      .gte('created_at', since)
      .lt('created_at', until)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    deliveredMoments(),
  ])

  const payments: SummaryPayment[] = [
    ...tx.map((t): SummaryPayment => ({
      id: t.id,
      amount: t.amount,
      method: t.method,
      at: t.transacted_at,
      source: t.type === '3d_service' ? 'order' : 'direct',
    })),
    ...filament.map((s): SummaryPayment => ({
      id: s.id,
      amount: s.total ?? 0,
      method: s.payment,
      at: s.created_at,
      source: 'filament',
    })),
  ]
  return { orders, payments, deliveredAt }
}
```

- [ ] **Step 5: Verificar y commit**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/summary.api.test.ts src/features/stats/stats.api.test.ts` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores. Si TypeScript se queja de la cadena `.order().order().range()` o del tipo de la selección con la relación, castear el resultado como ya está (`as unknown as ...`); no cambiar la query.

```bash
git add src/features/stats/stats.api.ts src/features/stats/summary.api.ts src/features/stats/summary.api.test.ts
git commit -m "feat(stats): carga de datos del Resumen"
```

---

### Task 5: Gráficos (`charts.tsx`)

**Files:**
- Create: `src/features/stats/charts.tsx`
- Test: `src/features/stats/charts.test.tsx`
- Modify: `src/features/stats/stats.css`

**Interfaces:**
- Consumes: `WeekBar`, `ShareRow` de `./summary`.
- Produces:
  - `WeeklyBars({ bars }: { bars: WeekBar[] })` — SVG con `role="img"`, número sobre cada barra y una `<table>` oculta visualmente con los mismos datos (`aria-label="Pedidos por semana (tabla)"`).
  - `ShareBars({ rows, format, empty, label }: { rows: ShareRow[]; format: (value: number) => string; empty: string; label: string })` — lista `<ol aria-label={label}>` con barra CSS, valor y %.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/features/stats/charts.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareBars, WeeklyBars } from './charts'

const bars = [
  { start: new Date(2026, 9, 5), label: '5/10', count: 9, partial: false },
  { start: new Date(2026, 9, 12), label: '12/10', count: 4, partial: true },
]

describe('WeeklyBars', () => {
  it('dibuja una barra por semana con su número y marca la parcial', () => {
    const { container } = render(<WeeklyBars bars={bars} />)
    const svg = screen.getByRole('img', { name: /Pedidos por semana/ })
    expect(within(svg).getByText('9')).toBeInTheDocument()
    expect(within(svg).getByText('12/10')).toBeInTheDocument()
    expect(container.querySelectorAll('rect.st-bar')).toHaveLength(2)
    expect(container.querySelectorAll('rect.st-bar.is-partial')).toHaveLength(1)
  })

  it('trae una tabla alternativa con los mismos datos', () => {
    render(<WeeklyBars bars={bars} />)
    const table = screen.getByRole('table', { name: 'Pedidos por semana (tabla)' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('sin pedidos en ninguna semana avisa en vez de dibujar ceros', () => {
    render(<WeeklyBars bars={bars.map((b) => ({ ...b, count: 0 }))} />)
    expect(screen.getByText('Sin pedidos en estas semanas.')).toBeInTheDocument()
  })
})

describe('ShareBars', () => {
  const rows = [
    { key: 'whatsapp', label: 'WhatsApp', value: 27, pct: 57 },
    { key: 'instagram', label: 'Instagram', value: 11, pct: 23 },
  ]

  it('lista cada fila con valor formateado y porcentaje', () => {
    render(
      <ShareBars rows={rows} label="Por canal" empty="Sin datos" format={(n) => `${n} ped.`} />,
    )
    const list = screen.getByRole('list', { name: 'Por canal' })
    const first = within(list).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('WhatsApp')
    expect(first).toHaveTextContent('27 ped.')
    expect(first).toHaveTextContent('57%')
  })

  it('sin filas muestra el texto vacío', () => {
    render(<ShareBars rows={[]} label="Por canal" empty="Sin datos en este período." format={String} />)
    expect(screen.getByText('Sin datos en este período.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/charts.test.tsx` → FAIL (`./charts` no existe).

- [ ] **Step 3: Implementar**

Crear `src/features/stats/charts.tsx`:

```tsx
import type { ShareRow, WeekBar } from './summary'

const W = 56 // width of a week slot
const H = 170 // plot height
const TOP = 22 // room for the number above the tallest bar
const BASE = H - 24 // y of the baseline (labels go below)

// Orders per week as SVG bars. A visually hidden table repeats the data.
export function WeeklyBars({ bars }: { bars: WeekBar[] }) {
  const max = Math.max(...bars.map((b) => b.count), 0)
  if (max === 0) return <p className="st-quiet">Sin pedidos en estas semanas.</p>
  const plot = BASE - TOP
  return (
    <>
      <svg
        className="st-chart"
        viewBox={`0 0 ${bars.length * W} ${H}`}
        role="img"
        aria-label="Pedidos por semana"
      >
        <line className="st-axis" x1="0" x2={bars.length * W} y1={BASE} y2={BASE} />
        {bars.map((b, i) => {
          const h = Math.max(b.count > 0 ? 2 : 0, Math.round((b.count / max) * plot))
          const x = i * W + 10
          return (
            <g key={b.label + i}>
              <rect
                className={`st-bar${b.partial ? ' is-partial' : ''}`}
                x={x}
                y={BASE - h}
                width={W - 20}
                height={h}
                rx="3"
              />
              <text className="st-bar__value" x={x + (W - 20) / 2} y={BASE - h - 6} textAnchor="middle">
                {b.count}
              </text>
              <text className="st-bar__label" x={x + (W - 20) / 2} y={H - 6} textAnchor="middle">
                {b.label}
              </text>
            </g>
          )
        })}
      </svg>
      <table className="visually-hidden" aria-label="Pedidos por semana (tabla)">
        <thead>
          <tr>
            <th>Semana desde</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// Share list: label, a CSS bar, the value and its percentage (always written).
export function ShareBars({
  rows,
  format,
  empty,
  label,
}: {
  rows: ShareRow[]
  format: (value: number) => string
  empty: string
  label: string
}) {
  if (rows.length === 0) return <p className="st-quiet">{empty}</p>
  return (
    <ol className="st-shares" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="st-share">
          <span className="st-share__label">{r.label}</span>
          <span className="st-share__track" aria-hidden="true">
            <span className="st-share__fill" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="st-share__value num">
            {format(r.value)} · {r.pct}%
          </span>
        </li>
      ))}
    </ol>
  )
}
```

Agregar al final de `src/features/stats/stats.css`:

```css
/* Resumen */
.st-tabs { display: inline-flex; gap: 0.25rem; padding: 0.25rem; border-radius: var(--radius-lg); background: var(--color-divider); }
.st-tabs button { padding: 0.4rem 0.9rem; border: 0; border-radius: var(--radius-md, 0.5rem); background: transparent; font: inherit; cursor: pointer; }
.st-tabs button[aria-pressed='true'] { background: var(--color-white); box-shadow: var(--shadow-card); font-weight: 600; }
.st-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.st-nav__title { font-weight: 600; min-width: 10rem; text-align: center; }
.st-nav__compare { font-size: 0.85rem; color: var(--color-carbon-muted); }
.st-banner { padding: 0.6rem 0.9rem; border-radius: var(--radius-lg); background: var(--color-white); border-left: 4px solid #c2500e; font-size: 0.9rem; margin: 0; }
.st-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 0.75rem; }
.st-card { display: grid; gap: 0.75rem; align-content: start; padding: 1rem; border-radius: var(--radius-lg); background: var(--color-white); box-shadow: var(--shadow-card); min-width: 0; }
.st-card h2 { font-size: 1.05rem; margin: 0; }
.st-chart { width: 100%; height: auto; max-height: 14rem; }
.st-axis { stroke: var(--color-divider); stroke-width: 1; }
.st-bar { fill: #2f5fd0; }
.st-bar.is-partial { fill: #2f5fd0; opacity: 0.45; }
.st-bar__value { font-size: 12px; font-weight: 600; fill: var(--color-carbon); }
.st-bar__label { font-size: 11px; fill: var(--color-carbon-muted); }
.st-shares { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.st-share { display: grid; grid-template-columns: minmax(6rem, 9rem) 1fr auto; align-items: center; gap: 0.6rem; font-size: 0.9rem; }
.st-share__track { height: 0.6rem; border-radius: 999px; background: var(--color-divider); overflow: hidden; }
.st-share__fill { display: block; height: 100%; background: #2f5fd0; }
.st-share__value { text-align: right; white-space: nowrap; }
.st-link { font-size: 0.85rem; }
@media (max-width: 760px) {
  .st-grid { grid-template-columns: minmax(0, 1fr); }
  .st-share { grid-template-columns: minmax(5rem, 7rem) 1fr auto; }
}
```

- [ ] **Step 4: Verificar y commit**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/charts.test.tsx` → PASS.

```bash
git add src/features/stats/charts.tsx src/features/stats/charts.test.tsx src/features/stats/stats.css
git commit -m "feat(stats): gráficos del Resumen (barras por semana y listas de proporción)"
```

---

### Task 6: Pestaña Resumen (`SummaryTab.tsx`)

**Files:**
- Create: `src/features/stats/SummaryTab.tsx`
- Test: `src/features/stats/SummaryTab.test.tsx`

**Interfaces:**
- Consumes: `parsePeriod`, `periodToParams`, `shiftPeriod`, `rangeOfPeriod`, `comparisonFor`, `containsMigration`, `isCurrentPeriod`, `periodTitle`, `compareLabel`, `COMPARE_CUTOFF`, `SummaryPeriod`, `SummaryKind` de `./period`; todo `./summary`; `loadSummary`, `SummaryData` de `./summary.api`; `WeeklyBars`, `ShareBars` de `./charts`; `money` de `@/features/filaments/filaments`; `useSearchParams` y `Link` de `react-router-dom`.
- Produces: `export default function SummaryTab()` — lee/escribe `p` y `d` en la URL conservando `tab`; renderiza período, banner, tarjetas, gráficos y el aviso de saldos sin confirmar.

Reglas de la UI (spec §4–§5):
- Tarjetas, en este orden: **Vendido**, **Cobrado**, **Por cobrar**, **Ticket promedio**, **Entregados a tiempo**, **Clientes nuevos**.
- Comparación: `pctChange` (Vendido, Cobrado, Ticket), `pointsDiff` en "pt" (A tiempo), diferencia absoluta (Clientes nuevos). Nunca en Por cobrar. Sin período de comparación (`cmp === null`) o `pctChange(...) === null`: no se muestra nada.
- Cada tarjeta lleva `title` y un `<span className="visually-hidden">` con su regla.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/features/stats/SummaryTab.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryTab from './SummaryTab'

const api = vi.hoisted(() => ({ loadSummary: vi.fn() }))
vi.mock('./summary.api', () => api)

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString()

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'o', customer_id: 'c1', created_at: at(2026, 11, 3), due_date: '2026-11-20',
    status: 'in_queue', total_amount: 10000, pending_balance: 0, flexible: false,
    origin_channel: 'whatsapp', quantity: 2, ...over,
  }
}

// Martes 10 de noviembre de 2026: el mes en curso se compara con octubre.
const data = {
  orders: [
    order({ id: 'a', customer_id: 'c1', total_amount: 30000, pending_balance: 5000, quantity: 3 }),
    order({ id: 'b', customer_id: 'c2', total_amount: 10000, origin_channel: 'instagram' }),
    order({ id: 'old', customer_id: 'c3', created_at: at(2026, 10, 5), total_amount: 20000 }),
    order({ id: 'legacy', customer_id: 'c4', created_at: at(2026, 9, 29), pending_balance: 7000, total_amount: 7000 }),
  ],
  payments: [
    { id: 'p1', amount: 20000, method: 'cash', at: at(2026, 11, 4), source: 'order' },
    { id: 'p2', amount: 2000, method: null, at: at(2026, 11, 5), source: 'direct' },
    { id: 'p3', amount: 10000, method: 'cash', at: at(2026, 10, 6), source: 'order' },
  ],
  deliveredAt: new Map([['a', at(2026, 11, 8)]]),
}

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.search}</output>
}

async function renderTab(search = '') {
  render(
    <MemoryRouter initialEntries={[`/admin/estadisticas${search}`]}>
      <SummaryTab />
      <Where />
    </MemoryRouter>,
  )
  await act(async () => {})
}

const tile = (label: string) => screen.getByText(label).closest('.st-tile') as HTMLElement

describe('SummaryTab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10, 12))
    api.loadSummary.mockReset()
    api.loadSummary.mockResolvedValue(data)
  })
  afterEach(() => vi.useRealTimers())

  it('arranca en el mes en curso y pide el rango y la comparación', async () => {
    await renderTab()
    expect(screen.getByText('Noviembre 2026')).toBeInTheDocument()
    expect(screen.getByText('comparado con octubre')).toBeInTheDocument()
    const [range, cmp] = api.loadSummary.mock.calls[0]
    expect(range.from).toEqual(new Date(2026, 10, 1))
    expect(cmp.from).toEqual(new Date(2026, 9, 1))
  })

  it('tarjetas con sus valores y comparaciones', async () => {
    await renderTab()
    const sold = tile('Vendido')
    expect(within(sold).getByText('$40.000')).toBeInTheDocument()
    expect(within(sold).getByText('2 pedidos · 5 unidades')).toBeInTheDocument()
    expect(within(sold).getByText(/100 %/)).toBeInTheDocument() // 40.000 contra 20.000

    const cobrado = tile('Cobrado')
    expect(within(cobrado).getByText('$22.000')).toBeInTheDocument()
    expect(within(cobrado).getByText(/pedidos \$20\.000/)).toBeInTheDocument()

    const porCobrar = tile('Por cobrar')
    expect(within(porCobrar).getByText('$5.000')).toBeInTheDocument()
    expect(within(porCobrar).queryByText(/%/)).not.toBeInTheDocument()

    expect(within(tile('Ticket promedio')).getByText('$20.000')).toBeInTheDocument()
    expect(within(tile('Entregados a tiempo')).getByText('100%')).toBeInTheDocument()
    expect(within(tile('Clientes nuevos')).getByText('2')).toBeInTheDocument()
  })

  it('avisa de los saldos anteriores sin confirmar, sin sumarlos', async () => {
    await renderTab()
    expect(screen.getByText(/1 pedido anterior al 30\/9 con saldo sin confirmar/)).toHaveTextContent(
      '$7.000',
    )
  })

  it('gráficos: canal y medio', async () => {
    await renderTab()
    const canal = screen.getByRole('list', { name: 'Pedidos por canal' })
    expect(within(canal).getByText('WhatsApp')).toBeInTheDocument()
    expect(within(canal).getByText('Instagram')).toBeInTheDocument()
    const medio = screen.getByRole('list', { name: 'Cobrado por medio' })
    expect(within(medio).getByText('Efectivo')).toBeInTheDocument()
    expect(within(medio).getByText('Sin medio')).toBeInTheDocument()
  })

  it('las flechas cambian el ancla en la URL', async () => {
    await renderTab('?tab=resumen')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
    })
    expect(screen.getByTestId('where')).toHaveTextContent('tab=resumen')
    expect(screen.getByTestId('where')).toHaveTextContent('p=mes')
    expect(screen.getByTestId('where')).toHaveTextContent('d=2026-10')
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument()
  })

  it('no se puede avanzar más allá del período en curso', async () => {
    await renderTab()
    expect(screen.getByRole('button', { name: 'Período siguiente' })).toBeDisabled()
  })

  it('cambiar a Año carga el año', async () => {
    await renderTab()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Año' }))
    })
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(api.loadSummary).toHaveBeenCalledTimes(2)
  })

  it('septiembre: banner de planilla y sin comparación', async () => {
    await renderTab('?p=mes&d=2026-09')
    expect(screen.getByText(/Datos de la planilla, incompletos/)).toBeInTheDocument()
    expect(api.loadSummary.mock.calls[0][1]).toBeNull()
    expect(within(tile('Vendido')).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('período vacío: ceros y avisos, sin NaN', async () => {
    api.loadSummary.mockResolvedValue({ orders: [], payments: [], deliveredAt: new Map() })
    await renderTab()
    expect(within(tile('Vendido')).getByText('$0')).toBeInTheDocument()
    expect(within(tile('Ticket promedio')).getByText('—')).toBeInTheDocument()
    expect(within(tile('Entregados a tiempo')).getByText('—')).toBeInTheDocument()
    expect(screen.getAllByText('Sin datos en este período.').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('muestra el error de carga', async () => {
    api.loadSummary.mockRejectedValue(new Error('sin conexión'))
    await renderTab()
    expect(screen.getByRole('alert')).toHaveTextContent('sin conexión')
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/SummaryTab.test.tsx` → FAIL (`./SummaryTab` no existe).

- [ ] **Step 3: Implementar**

Crear `src/features/stats/SummaryTab.tsx`:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { money } from '@/features/filaments/filaments'
import { ShareBars, WeeklyBars } from './charts'
import {
  COMPARE_CUTOFF,
  compareLabel,
  comparisonFor,
  containsMigration,
  isCurrentPeriod,
  parsePeriod,
  periodTitle,
  periodToParams,
  rangeOfPeriod,
  shiftPeriod,
  type SummaryKind,
  type SummaryPeriod,
} from './period'
import {
  byChannel,
  collected,
  collectedByMethod,
  newCustomers,
  onTimeRate,
  ordersByWeek,
  pctChange,
  pointsDiff,
  receivable,
  sold,
  ticketAverage,
} from './summary'
import { loadSummary, type SummaryData } from './summary.api'
import './stats.css'

const KINDS: [SummaryKind, string][] = [
  ['week', 'Semana'],
  ['month', 'Mes'],
  ['year', 'Año'],
]

function Delta({ text, down }: { text: string | null; down?: boolean }) {
  if (!text) return null
  return <span className={`st-change${down ? ' is-down' : ''}`}>{text}</span>
}

function pctText(curr: number | null, prev: number | null): { text: string | null; down: boolean } {
  if (curr === null || prev === null) return { text: null, down: false }
  const pct = pctChange(curr, prev)
  if (pct === null) return { text: null, down: false }
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)} %`, down: pct < 0 }
}

function Tile({
  label,
  value,
  sub,
  help,
  change,
}: {
  label: string
  value: string
  sub?: ReactNode
  help: string
  change?: { text: string | null; down: boolean }
}) {
  return (
    <div className="st-tile" title={help}>
      <span className="st-tile__label">{label}</span>
      <span className="st-tile__value num">{value}</span>
      {sub && <span className="st-tile__sub">{sub}</span>}
      {change && <Delta text={change.text} down={change.down} />}
      <span className="visually-hidden">{help}</span>
    </div>
  )
}

const orderWord = (n: number) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`

// Sold, collected and owed in a period, with where the orders came from.
export default function SummaryTab() {
  const [params, setParams] = useSearchParams()
  const now = new Date()
  const period = useMemo(
    () => parsePeriod(params, now),
    // `now` only matters for the open period; params drive re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  )
  const range = useMemo(() => rangeOfPeriod(period), [period])
  const cmp = useMemo(
    () => comparisonFor(period, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period],
  )
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    loadSummary(range, cmp)
      .then((d) => alive && setData(d))
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.')
      })
    return () => {
      alive = false
    }
  }, [range, cmp])

  function go(next: SummaryPeriod) {
    const out = new URLSearchParams(params)
    out.delete('p')
    out.delete('d')
    for (const [k, v] of Object.entries(periodToParams(next, new Date()))) out.set(k, v)
    setParams(out)
  }

  const current = isCurrentPeriod(period, now)
  return (
    <div className="st">
      <div className="st-nav">
        <div className="chips" role="group" aria-label="Período">
          {KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="chip"
              aria-pressed={period.kind === kind}
              onClick={() =>
                go({ kind, start: rangeOfPeriod({ kind, start: now }).from })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Período anterior"
          onClick={() => go(shiftPeriod(period, -1, now))}
        >
          ‹
        </button>
        <span className="st-nav__title">{periodTitle(period)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Período siguiente"
          disabled={current}
          onClick={() => go(shiftPeriod(period, 1, now))}
        >
          ›
        </button>
        <span className="st-nav__compare">
          {cmp ? compareLabel(period) : 'sin comparación'}
        </span>
      </div>

      {containsMigration(range) && (
        <p className="st-banner">
          Datos de la planilla, incompletos: 50 pedidos se cargaron juntos el 29/9, así que este
          período no se compara.
        </p>
      )}

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}
      {!error && !data && <p className="st-quiet">Cargando…</p>}
      {data && <Body data={data} period={period} range={range} cmp={cmp} now={now} />}
    </div>
  )
}

function Body({
  data,
  range,
  cmp,
  now,
}: {
  data: SummaryData
  period: SummaryPeriod
  range: { from: Date; to: Date }
  cmp: { from: Date; to: Date } | null
  now: Date
}) {
  const { orders, payments, deliveredAt } = data
  const s = sold(orders, range)
  const c = collected(payments, range)
  const due = receivable(orders, COMPARE_CUTOFF)
  const ticket = ticketAverage(s)
  const ontime = onTimeRate(orders, deliveredAt, range)
  const fresh = newCustomers(orders, range)

  const ps = cmp ? sold(orders, cmp) : null
  const pc = cmp ? collected(payments, cmp) : null
  const pTicket = ps ? ticketAverage(ps) : null
  const pOntime = cmp ? onTimeRate(orders, deliveredAt, cmp) : null
  const pFresh = cmp ? newCustomers(orders, cmp) : null

  const soldChange = pctText(s.amount, ps ? ps.amount : null)
  const collectedChange = pctText(c.total, pc ? pc.total : null)
  const ticketChange = pctText(ticket, pTicket)
  const pts = pointsDiff(ontime.rate, pOntime ? pOntime.rate : null)
  const ontimeChange = {
    text: pts === null ? null : `${pts >= 0 ? '▲' : '▼'} ${Math.abs(pts)} pt`,
    down: pts !== null && pts < 0,
  }
  const diff = pFresh ? fresh.fresh - pFresh.fresh : null
  const freshChange = {
    text: diff === null ? null : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}`,
    down: diff !== null && diff < 0,
  }

  const weeks = ordersByWeek(orders, range, now)
  const channels = byChannel(orders, range)
  const methods = collectedByMethod(payments, range)

  return (
    <>
      <div className="st-tiles">
        <Tile
          label="Vendido"
          value={money(s.amount)}
          sub={`${orderWord(s.orders)} · ${s.units} ${s.units === 1 ? 'unidad' : 'unidades'}${
            s.withoutAmount > 0 ? ` · ${s.withoutAmount} sin monto` : ''
          }`}
          help="Pedidos no cancelados dados de alta en el período, por su total."
          change={soldChange}
        />
        <Tile
          label="Cobrado"
          value={money(c.total)}
          sub={`pedidos ${money(c.orders)} · directas ${money(c.direct)} · filamento ${money(c.filament)}`}
          help="Plata que entró en el período, por la fecha de cada cobro."
          change={collectedChange}
        />
        <Tile
          label="Por cobrar"
          value={money(due.amount)}
          sub={`${orderWord(due.orders)} con saldo`}
          help="Saldo pendiente de pedidos no cancelados, a hoy. No cambia con el período."
        />
        <Tile
          label="Ticket promedio"
          value={ticket === null ? '—' : money(Math.round(ticket))}
          sub="por pedido"
          help="Vendido dividido los pedidos que tienen monto."
          change={ticketChange}
        />
        <Tile
          label="Entregados a tiempo"
          value={ontime.rate === null ? '—' : `${ontime.rate}%`}
          sub={
            ontime.total === 0
              ? 'sin entregas con fecha real'
              : `${ontime.late} con atraso · sobre ${ontime.total} con fecha real`
          }
          help="Entregados en el período con la fecha real de entrega igual o anterior a la prometida. No cuenta los pedidos sin apuro."
          change={ontimeChange}
        />
        <Tile
          label="Clientes nuevos"
          value={String(fresh.fresh)}
          sub={`de ${fresh.total} en total`}
          help="Clientes cuyo primer pedido cae en el período."
          change={freshChange}
        />
      </div>

      {due.legacyOrders > 0 && (
        <p className="st-hint">
          {due.legacyOrders === 1
            ? '1 pedido anterior al 30/9 con saldo sin confirmar'
            : `${due.legacyOrders} pedidos anteriores al 30/9 con saldo sin confirmar`}
          : <strong className="num">{money(due.legacyAmount)}</strong>. No se suma a "Por cobrar"
          porque la planilla no decía si se pagó.
        </p>
      )}

      <div className="st-grid">
        <section className="st-card" aria-labelledby="st-weeks">
          <h2 id="st-weeks">Pedidos por semana</h2>
          <WeeklyBars bars={weeks} />
          <p className="st-hint">Pedidos dados de alta por semana · la última puede estar en curso.</p>
        </section>
        <section className="st-card" aria-labelledby="st-channels">
          <h2 id="st-channels">De dónde vienen los pedidos</h2>
          <ShareBars
            rows={channels}
            label="Pedidos por canal"
            empty="Sin datos en este período."
            format={(n) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
          />
        </section>
      </div>

      <section className="st-card" aria-labelledby="st-methods">
        <h2 id="st-methods">Cobrado por medio</h2>
        <ShareBars
          rows={methods}
          label="Cobrado por medio"
          empty="Sin datos en este período."
          format={(n) => money(n)}
        />
      </section>
    </>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/SummaryTab.test.tsx` → PASS.
Si "100 %" del Vendido no aparece: la comparación esperada es 40.000 (Nov) contra 20.000 (Oct) = +100 %. Verificar `comparisonFor` con `now` = 10/nov: octubre empieza el 1/10, que es posterior al corte, así que hay comparación.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/SummaryTab.tsx src/features/stats/SummaryTab.test.tsx
git commit -m "feat(stats): pestaña Resumen con período en la URL, tarjetas y gráficos"
```

---

### Task 7: Contenedor con pestañas y menú "Números"

**Files:**
- Rename: `src/features/stats/StatsPage.tsx` → `src/features/stats/CashTab.tsx`
- Rename: `src/features/stats/StatsPage.test.tsx` → `src/features/stats/CashTab.test.tsx`
- Create: `src/features/stats/StatsPage.tsx`, `src/features/stats/StatsPage.test.tsx`
- Modify: `src/features/admin/AdminLayout.tsx` (etiqueta), `src/features/admin/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: `SummaryTab` (default) de `./SummaryTab`; `CashTab` (default) de `./CashTab`.
- Produces: `StatsPage` (default, sin props): título "Números", pestañas `Resumen | Caja y filamento` en `?tab=resumen|caja`; sin `tab` o valor desconocido = Resumen. `CashTab` es el contenido anterior de `StatsPage` sin su título.

- [ ] **Step 1: Mover los archivos actuales**

```bash
git mv src/features/stats/StatsPage.tsx src/features/stats/CashTab.tsx
git mv src/features/stats/StatsPage.test.tsx src/features/stats/CashTab.test.tsx
```

- [ ] **Step 2: Adaptar `CashTab.tsx`**

En `src/features/stats/CashTab.tsx`:
- Renombrar `export default function StatsPage()` a `export default function CashTab()`.
- En el `<header className="st-head">`, quitar el bloque del título y dejar solo el período. Reemplazar:

```tsx
      <header className="st-head">
        <div>
          <p className="eyebrow">Control</p>
          <h1 className="page-title">Estadísticas</h1>
        </div>
        <div className="st-period">
```

por:

```tsx
      <header className="st-head">
        <div className="st-period">
```

El resto del archivo no cambia.

- [ ] **Step 3: Adaptar `CashTab.test.tsx`**

En `src/features/stats/CashTab.test.tsx` reemplazar `import StatsPage from './StatsPage'` por `import CashTab from './CashTab'`, el `<StatsPage />` por `<CashTab />` y `describe('StatsPage'` por `describe('CashTab'`. No tocar los casos.

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/CashTab.test.tsx` → PASS (8 tests, igual que antes).

- [ ] **Step 4: Escribir el test del contenedor que falla**

Crear `src/features/stats/StatsPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'

vi.mock('./SummaryTab', () => ({ default: () => <div>contenido del resumen</div> }))
vi.mock('./CashTab', () => ({ default: () => <div>contenido de caja</div> }))

function renderAt(search: string) {
  render(
    <MemoryRouter initialEntries={[`/admin/estadisticas${search}`]}>
      <StatsPage />
    </MemoryRouter>,
  )
}

describe('StatsPage', () => {
  it('abre en Resumen por defecto', () => {
    renderAt('')
    expect(screen.getByRole('heading', { name: 'Números' })).toBeInTheDocument()
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resumen' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('?tab=caja abre Caja y filamento', () => {
    renderAt('?tab=caja')
    expect(screen.getByText('contenido de caja')).toBeInTheDocument()
  })

  it('un tab desconocido cae en Resumen', () => {
    renderAt('?tab=otra')
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
  })

  it('cambiar de pestaña muestra la otra', () => {
    renderAt('')
    fireEvent.click(screen.getByRole('button', { name: 'Caja y filamento' }))
    expect(screen.getByText('contenido de caja')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }))
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Correr y ver que falla**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats/StatsPage.test.tsx` → FAIL (`./StatsPage` ya no existe tras el `git mv`).

- [ ] **Step 6: Implementar el contenedor**

Crear `src/features/stats/StatsPage.tsx`:

```tsx
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
```

- [ ] **Step 7: Etiqueta del menú**

En `src/features/admin/AdminLayout.tsx` cambiar `label: 'Estadísticas',` (el ítem con `to: '/admin/estadisticas'`) por `label: 'Números',`.
En `src/features/admin/AdminLayout.test.tsx` reemplazar las dos ocurrencias de `'Estadísticas'` (líneas 88 y 97) por `'Números'`.

- [ ] **Step 8: Verificar todo y commit**

Run: `node node_modules/vitest/vitest.mjs run src/features/stats src/features/admin` → PASS.
Run: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` → sin errores.
Run: `node node_modules/vitest/vitest.mjs run` (suite completa) → sin fallas nuevas. Si `admin.route.test.tsx` o algún otro test referencia el título "Estadísticas", actualizarlo a "Números".

```bash
git add src/features/stats src/features/admin
git commit -m "feat(stats): Números con pestañas Resumen y Caja y filamento"
```

---

### Task 8: Verificación en el navegador, ajuste del spec y PR

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-numeros-resumen-design.md` (§5, gráficos)

**Interfaces:** ninguna.

- [ ] **Step 1: Alinear el spec con lo construido**

En la sección "Gráficos" del spec (§5), reemplazar `### Gráficos (SVG propio; no se agrega librería; con tabla alternativa accesible)` por `### Gráficos (propios, sin librería)` y agregar debajo de la lista numerada: `Pedidos por semana es un SVG con tabla alternativa oculta; las otras dos son listas con barra CSS que siempre escriben el valor y el porcentaje.`

- [ ] **Step 2: Levantar el dev server y mirar la pantalla**

Usar `preview_start` con `{name: "dev"}` (Node 20 de `.claude/launch.json`). El usuario inicia sesión y pone el PIN en el panel; no escribir credenciales. Luego en `/admin/estadisticas`:

1. Resumen abre por defecto, con título "Números" y pestañas `Resumen | Caja y filamento`.
2. Las seis tarjetas muestran valores razonables para el mes en curso; `Por cobrar` no trae porcentaje.
3. Flecha ‹ lleva a septiembre: aparece el banner de planilla y desaparecen los porcentajes; la URL tiene `?p=mes&d=2026-09`.
4. Recargar con esa URL abre el mismo período. La flecha › está deshabilitada en el período en curso.
5. Semana y Año cambian el título y la leyenda "comparado con…".
6. "Caja y filamento" se ve igual que antes.
7. Vista de celular (`resize_window` preset `mobile`): sin scroll horizontal de la página; los gráficos bajan de línea.
8. `read_console_messages` sin errores.

Anotar cualquier diferencia entre un número de pantalla y una consulta SQL de control (por ejemplo `select count(*) from orders where status <> 'cancelled' and created_at >= date_trunc('month', now())` contra "Vendido").

- [ ] **Step 3: Commit del spec y abrir el PR**

```bash
git add docs/superpowers/specs/2026-10-13-numeros-resumen-design.md
git commit -m "docs: alinear el spec de Números con los gráficos construidos"
git push -u origin feature/numeros-resumen
gh pr create --base feature/cobros-canal --head feature/numeros-resumen \
  --title "feat(numeros): pestaña Resumen con ventas, cobros y canales (Estadísticas F2)" \
  --body-file <(cat <<'EOF'
## Qué hace
Agrega la pestaña **Resumen** a `/admin/estadisticas` (el menú pasa a decir **Números**): período Semana / Mes / Año en la URL con flechas, seis tarjetas (Vendido, Cobrado, Por cobrar, Ticket promedio, Entregados a tiempo, Clientes nuevos) y tres gráficos (pedidos por semana, canal, cobrado por medio). La pantalla anterior queda como pestaña **Caja y filamento**, sin cambios de lógica.

## Depende de
PR #27 (cobros y canal, F1). Este PR apunta a `feature/cobros-canal`; al mergear el #27, GitHub lo retarga a `master`. **Mergear en orden.**

## Sin migraciones
Todo se calcula en el cliente con tablas existentes.

## Decisiones a tener presentes
- "Por cobrar" cuenta solo pedidos desde el 30/09; los anteriores con saldo se muestran aparte como "sin confirmar".
- Septiembre 2026 (carga masiva de la planilla) y octubre no se comparan: avisan en un banner.
- Spec: `docs/superpowers/specs/2026-10-13-numeros-resumen-design.md`. Plan: `docs/superpowers/plans/2026-10-13-numeros-resumen.md`.

## Verificación
- Tests de `src/features/stats` y `src/features/admin`; `tsc` limpio.
- Revisado en el dev server contra la base real (período, banner, móvil).
EOF
)
```

(Sin `Co-Authored-By` en el cuerpo del PR; terminar el cuerpo con la línea `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.)

- [ ] **Step 4: Estado del PR**

Con `mcp__ccd_pr__get_status` leer el PR; si no está enlazado, `bind_pr`. No hacer polling de CI ni activar auto-merge.

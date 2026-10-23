# Avisos y tareas: cartelera + tablero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin/avisos` en una cartelera de avisos que vencen solos más un tablero (y tabla) de tareas por sector, con importancia, asignado, fecha, repetición y vínculo, sin cambiar el aspecto de Hoy.

**Architecture:** Se amplía la tabla `notices` con columnas nuevas. Las reglas (vencimiento, orden, filtros, repetición) viven como funciones puras en `notices.ts`. La pantalla se arma con componentes chicos (`NoticeCartelera`, `NoticeBoard`, `NoticeTable`, `TaskPanel`, `NoticePanel`, `TaskBits`). La tarjeta compacta de Hoy (`NoticesCard`) solo se adapta por dentro.

**Tech Stack:** Vite + React 18 + TypeScript, Supabase JS, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-avisos-tablero-design.md`

## Global Constraints

- Sectores fijos: `local` Local, `taller` Taller, `compras` Compras y faltantes, `presupuesto` Presupuesto.
- Importancia: `alta`, `media`, `baja`; por defecto `media`.
- Repetir: `day` cada día, `week` cada semana, `month` cada mes; null = no se repite.
- Colores de aviso: `amarillo` (defecto), `rosa`, `celeste`, `verde`, `lila`.
- Hoy **no cambia a la vista**.
- La migración se aplica por MCP `execute_sql` **solo cuando el usuario lo autorice**. Nunca `supabase db push`.
- Textos de la interfaz en español rioplatense (voseo).
- Node 20 en Bash: `export PATH="$NVM_HOME/v20.19.0:$PATH"`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; usar `git commit -F "$TEMP/msg.txt"`.
- No hacer push ni PR sin autorización del usuario.
- Si algo falla dos veces seguidas: parar y preguntar.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261005100000_notices_board.sql` (nuevo) | Columnas nuevas en `notices` |
| `src/lib/database.types.ts` | Tipos de las columnas nuevas |
| `src/features/notices/notices.ts` | Tipos, etiquetas y reglas puras |
| `src/features/notices/notices.test.ts` (nuevo) | Pruebas de las reglas |
| `src/features/notices/notices.api.ts` | Lectura/escritura en Supabase |
| `src/features/notices/NoticesCard.tsx` (+ test) | Tarjeta de Hoy, adaptada a `priority` |
| `src/components/Icon.tsx` | Ícono `pin` |
| `src/features/notices/TaskBits.tsx` (nuevo) | Piezas chicas compartidas: chip de importancia, círculo, asignado, vínculo |
| `src/features/notices/TaskPanel.tsx` (nuevo) | Panel crear/editar tarea |
| `src/features/notices/NoticePanel.tsx` (nuevo) | Panel crear/editar aviso |
| `src/features/notices/NoticeCartelera.tsx` (nuevo) | Cartelera de avisos |
| `src/features/notices/NoticeBoard.tsx` (nuevo) | Tablero de 4 columnas |
| `src/features/notices/NoticeTable.tsx` (nuevo) | Vista tabla |
| `src/features/notices/NoticesPage.tsx` (+ test nuevo) | Pantalla completa |
| `src/features/notices/notices.css` | Estilos |
| `src/features/admin/AdminLayout.tsx` | Nombre, ícono y número del menú |

---

### Task 1: Migración y tipos

**Files:**
- Create: `supabase/migrations/20261005100000_notices_board.sql`
- Modify: `src/lib/database.types.ts` (bloque `notices`, ~líneas 389-445)

**Interfaces:**
- Produces: columnas `sector`, `priority`, `assignee_id`, `due_on`, `repeat`, `link`, `color`, `pinned`, `expires_on`, `last_done_at`, `last_done_by` en `Notice` (Row/Insert/Update).

- [ ] **Step 1: Escribir la migración**

```sql
-- Avisos y tareas, segunda parte: tablero por sector, importancia, persona
-- asignada, fecha, repetición y vínculo para las tareas; color, chinche y
-- fecha "hasta" para los avisos. Los datos cargados no se pierden: las
-- marcadas como importantes pasan a importancia alta.

alter table public.notices
  add column sector text not null default 'local'
    check (sector in ('local', 'taller', 'compras', 'presupuesto')),
  add column priority text not null default 'media'
    check (priority in ('alta', 'media', 'baja')),
  add column assignee_id uuid references public.operators (id) on delete set null,
  add column due_on date,
  add column repeat text check (repeat in ('day', 'week', 'month')),
  add column link text,
  add column color text not null default 'amarillo'
    check (color in ('amarillo', 'rosa', 'celeste', 'verde', 'lila')),
  add column pinned boolean not null default false,
  add column expires_on date,
  add column last_done_at timestamptz,
  add column last_done_by uuid references public.operators (id) on delete set null;

update public.notices set priority = 'alta' where important;
```

- [ ] **Step 2: Actualizar `database.types.ts`**

En `notices.Row` agregar después de `archived_by: string | null`:

```ts
          sector: string
          priority: string
          assignee_id: string | null
          due_on: string | null
          repeat: string | null
          link: string | null
          color: string
          pinned: boolean
          expires_on: string | null
          last_done_at: string | null
          last_done_by: string | null
```

En `Insert` y en `Update` agregar las mismas claves, todas opcionales (`sector?: string`, `assignee_id?: string | null`, etc.).

En `Relationships` agregar:

```ts
          {
            foreignKeyName: 'notices_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'operators'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notices_last_done_by_fkey'
            columns: ['last_done_by']
            isOneToOne: false
            referencedRelation: 'operators'
            referencedColumns: ['id']
          },
```

- [ ] **Step 3: Arreglar las fábricas de prueba que construyen `Notice`**

En `src/features/notices/NoticesCard.test.tsx`, función `notice()`, agregar al objeto base:

```ts
    sector: 'local',
    priority: 'media',
    assignee_id: null,
    due_on: null,
    repeat: null,
    link: null,
    color: 'amarillo',
    pinned: false,
    expires_on: null,
    last_done_at: null,
    last_done_by: null,
```

- [ ] **Step 4: Verificar tipos**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 5: Pedir autorización y aplicar la migración**

Preguntar al usuario: "¿Aplico la migración `notices_board` en Supabase?". Solo con un sí, ejecutar por MCP `execute_sql` (proyecto `bukjmleercxlxbexekos`):

```sql
begin;
-- contenido completo de 20261005100000_notices_board.sql
insert into supabase_migrations.schema_migrations (version, name)
  values ('20261005100000', 'notices_board');
commit;
```

Luego verificar: `select column_name from information_schema.columns where table_name = 'notices' order by ordinal_position;` → incluye las 11 columnas nuevas.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261005100000_notices_board.sql src/lib/database.types.ts src/features/notices/NoticesCard.test.tsx
git commit -F "$TEMP/msg.txt"   # "feat(avisos): columnas de tablero en notices"
```

---

### Task 2: Reglas puras en `notices.ts`

**Files:**
- Modify: `src/features/notices/notices.ts`
- Create: `src/features/notices/notices.test.ts`

**Interfaces:**
- Consumes: `toISODate(date: Date): string` de `@/features/orders/validation`; `addDaysISO(iso: string, days: number): string` de `@/features/orders/list`.
- Produces (todo exportado desde `notices.ts`):
  - tipos `Sector`, `Priority`, `Repeat`, `NoticeColor`, `TaskFilter`, `TaskSortKey`, `NoticeUpdate`
  - constantes `SECTORS`, `SECTOR_LABEL`, `PRIORITIES`, `PRIORITY_LABEL`, `REPEAT_LABEL`, `COLORS`, `COLOR_LABEL`, `FILTERS`, `FILTER_LABEL`
  - `localDay(stamp: string): string`
  - `isLink(text: string): boolean`
  - `activeNotices(rows, today): Notice[]`
  - `boardTasks(rows, today): Notice[]`
  - `isOverdue(task, today): boolean`
  - `compareTasks(a, b, today): number`
  - `nextDue(due: string | null, repeat: Repeat, today: string): string`
  - `markPatch(task, done, operatorId, now?): NoticeUpdate`
  - `filterTasks(tasks, opts: { filter: TaskFilter; priorities: readonly Priority[]; query: string; me: string | null; today: string }): Notice[]`
  - `taskSummary(tasks, today): { pending: number; alta: number; overdue: number }`
  - `priorityMix(tasks): string`
  - `sortTasksBy(tasks, key: TaskSortKey | null, dir: 1 | -1, nameOf: (id: string | null) => string, today): Notice[]`
  - `dueLabel(due, today): string`, `untilLabel(expires, today): string`
  - `visibleNotices` (oculta avisos vencidos) y `sortNotices` (usa `priority`)

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/features/notices/notices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toISODate } from '@/features/orders/validation'
import {
  activeNotices,
  boardTasks,
  compareTasks,
  dueLabel,
  filterTasks,
  isLink,
  isOverdue,
  markPatch,
  nextDue,
  priorityMix,
  sortNotices,
  sortTasksBy,
  taskSummary,
  untilLabel,
  visibleNotices,
  type Notice,
  type Priority,
  type TaskFilter,
} from './notices'

const TODAY = '2026-10-01'

function row(over: Partial<Notice>): Notice {
  return {
    id: 'n',
    kind: 'task',
    body: 'Tarea',
    important: false,
    created_by: 'op-1',
    created_at: '2026-10-01T10:00:00Z',
    done_at: null,
    done_by: null,
    archived_at: null,
    archived_by: null,
    sector: 'local',
    priority: 'media',
    assignee_id: null,
    due_on: null,
    repeat: null,
    link: null,
    color: 'amarillo',
    pinned: false,
    expires_on: null,
    last_done_at: null,
    last_done_by: null,
    ...over,
  }
}

describe('cartelera', () => {
  it('drops expired and archived notices, pinned first', () => {
    const rows = [
      row({ id: 'old', kind: 'notice', created_at: '2026-09-28T10:00:00Z' }),
      row({ id: 'gone', kind: 'notice', expires_on: '2026-09-30' }),
      row({ id: 'last', kind: 'notice', expires_on: TODAY }),
      row({ id: 'arch', kind: 'notice', archived_at: '2026-10-01T09:00:00Z' }),
      row({
        id: 'pin',
        kind: 'notice',
        pinned: true,
        created_at: '2026-09-20T10:00:00Z',
      }),
      row({ id: 'task' }),
    ]
    expect(activeNotices(rows, TODAY).map((n) => n.id)).toEqual([
      'pin',
      'last',
      'old',
    ])
  })

  it('says until when', () => {
    expect(untilLabel(TODAY, TODAY)).toBe('hasta hoy')
    expect(untilLabel('2026-10-08', TODAY)).toMatch(/^hasta el jue 8$/)
  })
})

describe('tablero', () => {
  it('keeps pending tasks and the ones done today', () => {
    const rows = [
      row({ id: 'open' }),
      row({ id: 'today', done_at: new Date().toISOString() }),
      row({ id: 'yesterday', done_at: '2020-01-01T10:00:00Z' }),
      row({ id: 'notice', kind: 'notice' }),
    ]
    expect(
      boardTasks(rows, toISODate(new Date())).map((n) => n.id),
    ).toEqual(['open', 'today'])
  })

  it('knows what is overdue', () => {
    expect(isOverdue(row({ due_on: '2026-09-30' }), TODAY)).toBe(true)
    expect(isOverdue(row({ due_on: TODAY }), TODAY)).toBe(false)
    expect(
      isOverdue(
        row({ due_on: '2026-09-30', done_at: '2026-10-01T10:00:00Z' }),
        TODAY,
      ),
    ).toBe(false)
  })

  it('orders overdue, then by importance, then by date', () => {
    const rows = [
      row({ id: 'baja', priority: 'baja' }),
      row({ id: 'media-sin', priority: 'media' }),
      row({ id: 'media-fecha', priority: 'media', due_on: '2026-10-05' }),
      row({ id: 'alta', priority: 'alta' }),
      row({ id: 'late', priority: 'baja', due_on: '2026-09-29' }),
    ]
    expect(
      [...rows].sort((a, b) => compareTasks(a, b, TODAY)).map((n) => n.id),
    ).toEqual(['late', 'alta', 'media-fecha', 'media-sin', 'baja'])
  })

  it('moves a repeated task forward', () => {
    expect(nextDue('2026-10-01', 'day', TODAY)).toBe('2026-10-02')
    expect(nextDue('2026-10-03', 'week', TODAY)).toBe('2026-10-10')
    expect(nextDue('2026-09-20', 'week', TODAY)).toBe('2026-10-08')
    expect(nextDue(null, 'week', TODAY)).toBe('2026-10-08')
    expect(nextDue('2027-01-31', 'month', TODAY)).toBe('2027-02-28')
    expect(nextDue('2026-12-15', 'month', TODAY)).toBe('2027-01-15')
  })

  it('builds the patch to tick a task', () => {
    const now = new Date('2026-10-01T15:00:00')
    expect(markPatch(row({}), true, 'op-1', now)).toEqual({
      done_at: now.toISOString(),
      done_by: 'op-1',
    })
    expect(markPatch(row({}), false, 'op-1', now)).toEqual({
      done_at: null,
      done_by: null,
    })
    expect(
      markPatch(row({ repeat: 'week', due_on: TODAY }), true, 'op-1', now),
    ).toEqual({
      last_done_at: now.toISOString(),
      last_done_by: 'op-1',
      due_on: '2026-10-08',
    })
  })

  it('filters by tab, importance and text', () => {
    const rows = [
      row({ id: 'mine', assignee_id: 'op-1', priority: 'alta' }),
      row({ id: 'free', body: 'Comprar Grilon3' }),
      row({ id: 'late', assignee_id: 'op-2', due_on: '2026-09-29' }),
      row({ id: 'link', link: 'https://filamentos.com' }),
    ]
    const base = {
      filter: 'todas' as TaskFilter,
      priorities: [] as Priority[],
      query: '',
      me: 'op-1',
      today: TODAY,
    }
    const ids = (o: Partial<typeof base>) =>
      filterTasks(rows, { ...base, ...o }).map((n) => n.id)
    expect(ids({ filter: 'mias' })).toEqual(['mine'])
    expect(ids({ filter: 'sin' })).toEqual(['free', 'link'])
    expect(ids({ filter: 'vencidas' })).toEqual(['late'])
    expect(ids({ priorities: ['alta'] })).toEqual(['mine'])
    expect(ids({ query: 'grilon' })).toEqual(['free'])
    expect(ids({ query: 'filamentos' })).toEqual(['link'])
  })

  it('sums up and describes the mix', () => {
    const rows = [
      row({ priority: 'alta' }),
      row({ priority: 'alta', due_on: '2026-09-30' }),
      row({ priority: 'baja' }),
      row({ priority: 'alta', done_at: '2026-10-01T10:00:00Z' }),
    ]
    expect(taskSummary(rows, TODAY)).toEqual({
      pending: 3,
      alta: 2,
      overdue: 1,
    })
    expect(priorityMix(rows.slice(0, 3))).toBe('2 alta · 1 baja')
    expect(priorityMix([])).toBe('')
  })

  it('sorts the table by a column, done last', () => {
    const rows = [
      row({ id: 'b', body: 'Bbb', assignee_id: 'op-2' }),
      row({ id: 'a', body: 'aaa' }),
      row({ id: 'done', body: 'Aaa', done_at: '2026-10-01T10:00:00Z' }),
    ]
    const name = (id: string | null) => (id === 'op-2' ? 'sabri' : '')
    expect(
      sortTasksBy(rows, 'body', 1, name, TODAY).map((n) => n.id),
    ).toEqual(['a', 'b', 'done'])
    expect(
      sortTasksBy(rows, 'body', -1, name, TODAY).map((n) => n.id),
    ).toEqual(['b', 'a', 'done'])
    expect(
      sortTasksBy(rows, 'assignee', 1, name, TODAY).map((n) => n.id),
    ).toEqual(['b', 'a', 'done'])
  })

  it('names the due day', () => {
    expect(dueLabel(TODAY, TODAY)).toBe('Hoy')
    expect(dueLabel('2026-09-30', TODAY)).toBe('Ayer')
    expect(dueLabel('2026-10-02', TODAY)).toBe('Mañana')
    expect(dueLabel('2026-10-03', TODAY)).toMatch(/^Sáb 3$/)
  })

  it('tells links from text', () => {
    expect(isLink('https://club.com')).toBe(true)
    expect(isLink('Club Náutico')).toBe(false)
  })
})

describe('Hoy', () => {
  it('hides expired notices on Hoy too', () => {
    const now = new Date('2026-10-01T15:00:00').getTime()
    const rows = [
      row({ id: 'ok', kind: 'notice' }),
      row({ id: 'gone', kind: 'notice', expires_on: '2026-09-30' }),
    ]
    expect(visibleNotices(rows, now).map((n) => n.id)).toEqual(['ok'])
  })

  it('puts high importance first', () => {
    const rows = [
      row({ id: 'm', created_at: '2026-10-01T12:00:00Z' }),
      row({ id: 'a', priority: 'alta', created_at: '2026-09-01T12:00:00Z' }),
    ]
    expect(sortNotices(rows).map((n) => n.id)).toEqual(['a', 'm'])
  })
})
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/notices.test.ts`
Expected: FAIL (exports inexistentes como `activeNotices`).

- [ ] **Step 3: Implementar en `notices.ts`**

Reemplazar el archivo completo por:

```ts
import type { Database } from '@/lib/database.types'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'

export type Notice = Database['public']['Tables']['notices']['Row']
export type NoticeUpdate = Database['public']['Tables']['notices']['Update']
export type NoticeKind = 'notice' | 'task'
export type Sector = 'local' | 'taller' | 'compras' | 'presupuesto'
export type Priority = 'alta' | 'media' | 'baja'
export type Repeat = 'day' | 'week' | 'month'
export type NoticeColor = 'amarillo' | 'rosa' | 'celeste' | 'verde' | 'lila'
export type TaskFilter = 'todas' | 'mias' | 'sin' | 'vencidas'
export type TaskSortKey = 'body' | 'sector' | 'priority' | 'assignee' | 'due'

export const KIND_LABEL: Record<NoticeKind, string> = {
  notice: 'Aviso',
  task: 'Tarea',
}
export const SECTORS: Sector[] = ['local', 'taller', 'compras', 'presupuesto']
export const SECTOR_LABEL: Record<Sector, string> = {
  local: 'Local',
  taller: 'Taller',
  compras: 'Compras y faltantes',
  presupuesto: 'Presupuesto',
}
export const PRIORITIES: Priority[] = ['alta', 'media', 'baja']
export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}
const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 }
export const REPEAT_LABEL: Record<Repeat, string> = {
  day: 'cada día',
  week: 'cada semana',
  month: 'cada mes',
}
export const COLORS: NoticeColor[] = [
  'amarillo',
  'rosa',
  'celeste',
  'verde',
  'lila',
]
export const COLOR_LABEL: Record<NoticeColor, string> = {
  amarillo: 'Amarillo',
  rosa: 'Rosa',
  celeste: 'Celeste',
  verde: 'Verde',
  lila: 'Lila',
}
export const FILTERS: TaskFilter[] = ['todas', 'mias', 'sin', 'vencidas']
export const FILTER_LABEL: Record<TaskFilter, string> = {
  todas: 'Todas',
  mias: 'Mías',
  sin: 'Sin asignar',
  vencidas: 'Vencidas',
}

const DAY = 86_400_000

// Calendar day (local time) of a timestamp.
export function localDay(stamp: string): string {
  return toISODate(new Date(stamp))
}

export function isLink(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

// ---------- Hoy ----------

// What Hoy shows: everything not archived nor expired, and done tasks only
// for a day after they were ticked so the list does not fill up.
export function visibleNotices(rows: readonly Notice[], now = Date.now()) {
  const today = toISODate(new Date(now))
  return rows.filter(
    (n) =>
      !n.archived_at &&
      (!n.expires_on || n.expires_on >= today) &&
      (!n.done_at || now - new Date(n.done_at).getTime() < DAY),
  )
}

// High importance first, then what is still open (newest first), done last.
export function sortNotices(rows: readonly Notice[]): Notice[] {
  const rank = (n: Notice) => (n.done_at ? 2 : n.priority === 'alta' ? 0 : 1)
  return [...rows].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function openTasks(rows: readonly Notice[]): number {
  return rows.filter((n) => n.kind === 'task' && !n.done_at).length
}

// ---------- Cartelera ----------

// Notices still in force: pinned first, then newest.
export function activeNotices(rows: readonly Notice[], today: string) {
  return rows
    .filter(
      (n) =>
        n.kind === 'notice' &&
        !n.archived_at &&
        (!n.expires_on || n.expires_on >= today),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
}

// ---------- Tablero ----------

// Pending tasks plus the ones ticked today ("Hechas hoy").
export function boardTasks(rows: readonly Notice[], today: string) {
  return rows.filter(
    (n) =>
      n.kind === 'task' &&
      !n.archived_at &&
      (!n.done_at || localDay(n.done_at) === today),
  )
}

export function isOverdue(task: Notice, today: string): boolean {
  return !task.done_at && !!task.due_on && task.due_on < today
}

// Overdue first, then alta → media → baja, then by date (none last), then
// newest.
export function compareTasks(a: Notice, b: Notice, today: string): number {
  return (
    Number(isOverdue(b, today)) - Number(isOverdue(a, today)) ||
    PRIORITY_RANK[a.priority as Priority] -
      PRIORITY_RANK[b.priority as Priority] ||
    (a.due_on ?? '9999-12-31').localeCompare(b.due_on ?? '9999-12-31') ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

function addMonthISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(y, m + 1, 0).getDate()
  return toISODate(new Date(y, m, Math.min(d, last)))
}

// Next date of a repeated task: from its date if it is still ahead, from
// today if it was late or had none.
export function nextDue(
  due: string | null,
  repeat: Repeat,
  today: string,
): string {
  const base = due && due >= today ? due : today
  if (repeat === 'day') return addDaysISO(base, 1)
  if (repeat === 'week') return addDaysISO(base, 7)
  return addMonthISO(base)
}

// Ticking a repeated task logs who did it and pushes the date; it stays
// pending. Any other task is simply done or undone.
export function markPatch(
  task: Notice,
  done: boolean,
  operatorId: string | null,
  now = new Date(),
): NoticeUpdate {
  const stamp = now.toISOString()
  if (done && task.repeat)
    return {
      last_done_at: stamp,
      last_done_by: operatorId,
      due_on: nextDue(task.due_on, task.repeat as Repeat, toISODate(now)),
    }
  return { done_at: done ? stamp : null, done_by: done ? operatorId : null }
}

export function filterTasks(
  tasks: readonly Notice[],
  opts: {
    filter: TaskFilter
    priorities: readonly Priority[]
    query: string
    me: string | null
    today: string
  },
): Notice[] {
  const q = opts.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (opts.filter === 'mias' && t.assignee_id !== opts.me) return false
    if (opts.filter === 'sin' && t.assignee_id) return false
    if (opts.filter === 'vencidas' && !isOverdue(t, opts.today)) return false
    if (
      opts.priorities.length &&
      !opts.priorities.includes(t.priority as Priority)
    )
      return false
    if (q && !`${t.body} ${t.link ?? ''}`.toLowerCase().includes(q))
      return false
    return true
  })
}

export function taskSummary(tasks: readonly Notice[], today: string) {
  const pending = tasks.filter((t) => !t.done_at)
  return {
    pending: pending.length,
    alta: pending.filter((t) => t.priority === 'alta').length,
    overdue: pending.filter((t) => isOverdue(t, today)).length,
  }
}

// "1 alta · 1 media · 1 baja", skipping the empty ones.
export function priorityMix(tasks: readonly Notice[]): string {
  return PRIORITIES.map((p) => [p, tasks.filter((t) => t.priority === p).length] as const)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${n} ${p}`)
    .join(' · ')
}

// Table order: done tasks always last; inside, by the chosen column.
export function sortTasksBy(
  tasks: readonly Notice[],
  key: TaskSortKey | null,
  dir: 1 | -1,
  nameOf: (id: string | null) => string,
  today: string,
): Notice[] {
  const val = (t: Notice): string | number => {
    if (key === 'body') return t.body.toLowerCase()
    if (key === 'sector') return SECTORS.indexOf(t.sector as Sector)
    if (key === 'priority') return PRIORITY_RANK[t.priority as Priority]
    if (key === 'assignee') return nameOf(t.assignee_id) || '￿'
    return t.due_on ?? '9999-12-31'
  }
  return [...tasks].sort((a, b) => {
    const done = Number(!!a.done_at) - Number(!!b.done_at)
    if (done) return done
    if (!key) return compareTasks(a, b, today)
    const x = val(a)
    const y = val(b)
    return (x < y ? -1 : x > y ? 1 : 0) * dir || compareTasks(a, b, today)
  })
}

// ---------- Fechas ----------

const WEEKDAY = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })

function dayParts(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return { w: WEEKDAY.format(d).replace('.', ''), n: d.getDate() }
}

// "Hoy", "Ayer", "Mañana", "Sáb 3".
export function dueLabel(due: string, today: string): string {
  if (due === today) return 'Hoy'
  if (due === addDaysISO(today, -1)) return 'Ayer'
  if (due === addDaysISO(today, 1)) return 'Mañana'
  const { w, n } = dayParts(due)
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${n}`
}

// "hasta hoy", "hasta el jue 8".
export function untilLabel(expires: string, today: string): string {
  if (expires === today) return 'hasta hoy'
  const { w, n } = dayParts(expires)
  return `hasta el ${w} ${n}`
}

const TIME = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY_SHORT = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
})

// "recién", "hace 40 min", "hace 3 h", "ayer 18:20", "28 sep".
export function noticeAge(stamp: string, now = new Date()): string {
  const d = new Date(stamp)
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d >= start) return `hace ${Math.floor(mins / 60)} h`
  const days = Math.round(
    (start.getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      DAY,
  )
  if (days === 1) return `ayer ${TIME.format(d)}`
  return DAY_SHORT.format(d).replace('.', '')
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/notices.test.ts`
Expected: PASS. Si `untilLabel`/`dueLabel` fallan solo por el formato del día de la semana (p. ej. Node devuelve otro texto), revisar qué devuelve `Intl` y ajustar `dayParts`, no la prueba.

- [ ] **Step 5: Commit**

```bash
git add src/features/notices/notices.ts src/features/notices/notices.test.ts
git commit -F "$TEMP/msg.txt"   # "feat(avisos): reglas de cartelera, tablero y repetición"
```

---

### Task 3: API y tarjeta de Hoy adaptada

**Files:**
- Modify: `src/features/notices/notices.api.ts`
- Modify: `src/features/notices/NoticesCard.tsx`
- Modify: `src/features/notices/NoticesCard.test.tsx`
- Modify: `src/features/production/TodayPage.test.tsx:32-38`

**Interfaces:**
- Consumes: `markPatch`, `Notice`, `NoticeKind`, `Priority` de Task 2.
- Produces (desde `notices.api.ts`):
  - `type NoticeFields = Partial<Pick<Notice, 'body' | 'sector' | 'priority' | 'assignee_id' | 'due_on' | 'repeat' | 'link' | 'color' | 'pinned' | 'expires_on'>>`
  - `listNotices(): Promise<Notice[]>`
  - `createNotice(kind: NoticeKind, fields: NoticeFields & { body: string }, operatorId: string | null): Promise<Notice>`
  - `updateNotice(id: string, fields: NoticeFields): Promise<Notice>`
  - `markTask(task: Notice, done: boolean, operatorId: string | null): Promise<Notice>`
  - `setPriority(id: string, priority: Priority): Promise<void>`
  - `archiveNotice(id: string, archive: boolean, operatorId: string | null): Promise<void>`
  - `deleteNotice(id: string): Promise<void>`
  - `countOpenTasks(): Promise<number>`
  - Se eliminan `setTaskDone` y `setImportant`.

- [ ] **Step 1: Actualizar las pruebas de la tarjeta (fallan)**

En `NoticesCard.test.tsx`:
- En `mocks`, reemplazar `setTaskDone` por `markTask` y `setImportant` por `setPriority`.
- En `notice()` y en los datos, reemplazar cada `important: true` por `priority: 'alta'` (dejar `important: false` en la fábrica base).
- Prueba "adds a task marked important": la expectativa pasa a

```ts
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'task',
      { body: 'Pedir filamento', priority: 'alta' },
      'op-1',
    )
```

  y el `mockResolvedValue` usa `priority: 'alta'`.
- Prueba "ticks a task": `mocks.markTask.mockResolvedValue(...)` y

```ts
    expect(mocks.markTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' }),
      true,
      'op-1',
    )
```

- Agregar al final del `describe('NoticesCard')`:

```ts
  it('toggles high importance', async () => {
    mocks.setPriority.mockResolvedValue(undefined)
    const card = await renderCard()
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('button', {
          name: 'Marcar como importante: Limpiar la cama',
        }),
      )
    })
    expect(mocks.setPriority).toHaveBeenCalledWith('b', 'alta')
  })
```

- Borrar del `describe('helpers')` la prueba "puts important first and done tasks last" solo si choca; si no, cambiar su `important: true` por `priority: 'alta'`.

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/NoticesCard.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Reescribir `notices.api.ts`**

```ts
import { supabase } from '@/lib/supabase'
import {
  markPatch,
  type Notice,
  type NoticeKind,
  type Priority,
} from './notices'

export type NoticeFields = Partial<
  Pick<
    Notice,
    | 'body'
    | 'sector'
    | 'priority'
    | 'assignee_id'
    | 'due_on'
    | 'repeat'
    | 'link'
    | 'color'
    | 'pinned'
    | 'expires_on'
  >
>

// Not archived; the done-task window is applied on screen.
export async function listNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createNotice(
  kind: NoticeKind,
  fields: NoticeFields & { body: string },
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .insert({ ...fields, kind, body: fields.body.trim(), created_by: operatorId })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateNotice(
  id: string,
  fields: NoticeFields,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .update(fields)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// A repeated task logs who did it and moves its date; others get done.
export async function markTask(
  task: Notice,
  done: boolean,
  operatorId: string | null,
): Promise<Notice> {
  const { data, error } = await supabase
    .from('notices')
    .update(markPatch(task, done, operatorId))
    .eq('id', task.id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setPriority(
  id: string,
  priority: Priority,
): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({ priority })
    .eq('id', id)
  if (error) throw error
}

// Archived rows stay in the table; they just stop showing.
export async function archiveNotice(
  id: string,
  archive: boolean,
  operatorId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? operatorId : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) throw error
}

// For the side menu badge; a failed count just hides it.
export async function countOpenTasks(): Promise<number> {
  const { count, error } = await supabase
    .from('notices')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'task')
    .is('done_at', null)
    .is('archived_at', null)
  if (error) return 0
  return count ?? 0
}
```

- [ ] **Step 3: Adaptar `NoticesCard.tsx`**

- Imports de la API: `archiveNotice, createNotice, listNotices, markTask, setPriority`.
- `add()`: reemplazar la llamada por

```ts
      const created = await createNotice(
        kind,
        { body: text, priority: important ? 'alta' : 'media' },
        operatorId,
      )
```

- `toggleDone(n)`: `replace(await markTask(n, !n.done_at, operatorId))`.
- `toggleImportant(n)`:

```ts
  async function toggleImportant(n: Notice) {
    const next = n.priority === 'alta' ? 'media' : 'alta'
    replace({ ...n, priority: next })
    try {
      await setPriority(n.id, next)
    } catch {
      replace(n)
      showToast('No se pudo cambiar.')
    }
  }
```

- En el render, reemplazar cada `n.important` por `n.priority === 'alta'` (clase `is-important`, la etiqueta " · Importante", `aria-pressed`, `aria-label`, clase `is-on`).

- [ ] **Step 4: Actualizar el mock de Hoy**

En `src/features/production/TodayPage.test.tsx` reemplazar el `vi.mock('@/features/notices/notices.api', ...)` por:

```ts
vi.mock('@/features/notices/notices.api', () => ({
  listNotices: vi.fn().mockResolvedValue([]),
  createNotice: vi.fn(),
  markTask: vi.fn(),
  setPriority: vi.fn(),
  archiveNotice: vi.fn(),
}))
```

- [ ] **Step 5: Correr pruebas y tipos**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx tsc -b --noEmit && npx vitest run src/features/notices src/features/production`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/notices/notices.api.ts src/features/notices/NoticesCard.tsx src/features/notices/NoticesCard.test.tsx src/features/production/TodayPage.test.tsx
git commit -F "$TEMP/msg.txt"   # "feat(avisos): api del tablero; Hoy usa importancia"
```

---

### Task 4: Paneles de tarea y de aviso

**Files:**
- Modify: `src/components/Icon.tsx` (agregar `pin`)
- Create: `src/features/notices/TaskBits.tsx`
- Create: `src/features/notices/TaskPanel.tsx`
- Create: `src/features/notices/NoticePanel.tsx`
- Create: `src/features/notices/panels.test.tsx`

**Interfaces:**
- Consumes: `createNotice`, `updateNotice`, `deleteNotice` (Task 3); etiquetas y tipos (Task 2); `Operator` de `@/features/operators/operators.api` (tiene `id`, `name`, `initials`, `color`, `active`).
- Produces:
  - `TaskBits.tsx`: `PriorityChip({ priority })`, `TaskCheck({ task, onToggle })`, `Assignee({ person })`, `LinkText({ link })`
  - `TaskPanel` props: `{ task: Notice | null; sector: Sector; operators: readonly Operator[]; operatorId: string | null; onClose(): void; onSaved(n: Notice): void; onArchive(n: Notice): void; onDeleted(id: string): void }`
  - `NoticePanel` props: `{ notice: Notice | null; operatorId: string | null; onClose(): void; onSaved(n: Notice): void; onArchive(n: Notice): void }`

- [ ] **Step 1: Ícono `pin`**

En `PATHS` de `src/components/Icon.tsx`, después de `flag`:

```ts
  pin: 'M9 3h6l-1 6 4 4H6l4-4zM12 13v8',
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`src/features/notices/panels.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskPanel from './TaskPanel'
import NoticePanel from './NoticePanel'
import type { Notice } from './notices'

const mocks = vi.hoisted(() => ({
  createNotice: vi.fn(),
  updateNotice: vi.fn(),
  deleteNotice: vi.fn(),
}))
vi.mock('./notices.api', () => mocks)

const people = [
  { id: 'op-1', name: 'nicolas', initials: 'NI', color: '#f37021', active: true },
  { id: 'op-2', name: 'sabri', initials: 'SA', color: '#888', active: true },
] as never

const task = {
  id: 't1',
  kind: 'task',
  body: 'Calibrar la impresora 1',
  sector: 'taller',
  priority: 'alta',
  assignee_id: null,
  due_on: null,
  repeat: null,
  link: null,
} as Notice

describe('TaskPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a task with every field', async () => {
    mocks.createNotice.mockResolvedValue({ id: 'new' })
    const onSaved = vi.fn()
    render(
      <TaskPanel
        task={null}
        sector="compras"
        operators={people}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={onSaved}
        onArchive={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Tarea'), {
      target: { value: 'Comprar Grilon3 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    fireEvent.change(screen.getByLabelText('Asignada a'), {
      target: { value: 'op-2' },
    })
    fireEvent.change(screen.getByLabelText('Fecha'), {
      target: { value: '2026-10-05' },
    })
    fireEvent.change(screen.getByLabelText('Repetir'), {
      target: { value: 'week' },
    })
    fireEvent.change(screen.getByLabelText('Vínculo'), {
      target: { value: 'Filamentos' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'task',
      {
        body: 'Comprar Grilon3',
        sector: 'compras',
        priority: 'alta',
        assignee_id: 'op-2',
        due_on: '2026-10-05',
        repeat: 'week',
        link: 'Filamentos',
      },
      'op-1',
    )
    expect(onSaved).toHaveBeenCalledWith({ id: 'new' })
  })

  it('asks inside the panel before deleting', async () => {
    mocks.deleteNotice.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    render(
      <TaskPanel
        task={task}
        sector="taller"
        operators={people}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onArchive={vi.fn()}
        onDeleted={onDeleted}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(mocks.deleteNotice).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    })
    expect(mocks.deleteNotice).toHaveBeenCalledWith('t1')
    expect(onDeleted).toHaveBeenCalledWith('t1')
  })
})

describe('NoticePanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a pinned notice with color and date', async () => {
    mocks.createNotice.mockResolvedValue({ id: 'a' })
    render(
      <NoticePanel
        notice={null}
        operatorId="op-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onArchive={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Aviso'), {
      target: { value: 'El jueves cerramos a las 18' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rosa' }))
    fireEvent.click(screen.getByLabelText('Fijar adelante'))
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-10-08' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'notice',
      {
        body: 'El jueves cerramos a las 18',
        color: 'rosa',
        pinned: true,
        expires_on: '2026-10-08',
      },
      'op-1',
    )
  })
})
```

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/panels.test.tsx`
Expected: FAIL (módulos no existen).

- [ ] **Step 3: Crear `TaskBits.tsx`**

```tsx
import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import { isLink, PRIORITY_LABEL, type Notice, type Priority } from './notices'

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={`ntb-prio ntb-prio--${priority}`}>
      <span className="ntb-prio__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

export function TaskCheck({
  task,
  onToggle,
}: {
  task: Notice
  onToggle: (task: Notice) => void
}) {
  const done = !!task.done_at
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${done ? 'Desmarcar' : 'Marcar como hecha'}: ${task.body}`}
      className="nt__box"
      onClick={() => onToggle(task)}
    >
      {done && <Icon name="check" size={14} />}
    </button>
  )
}

export function Assignee({ person }: { person: Operator | undefined }) {
  if (!person)
    return (
      <span className="ntb-who is-none">
        <span className="ntb-who__empty" aria-hidden="true" />
        Sin asignar
      </span>
    )
  return (
    <span className="ntb-who">
      <span className="avatar avatar--sm" style={{ background: person.color }}>
        {person.initials}
      </span>
      {person.name}
    </span>
  )
}

export function LinkText({ link }: { link: string }) {
  if (!isLink(link))
    return (
      <span className="ntb-link">
        <Icon name="link" size={13} />
        {link}
      </span>
    )
  return (
    <a className="ntb-link" href={link} target="_blank" rel="noreferrer">
      <Icon name="link" size={13} />
      {link.replace(/^https?:\/\//i, '')}
    </a>
  )
}
```

- [ ] **Step 4: Crear `TaskPanel.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import {
  PRIORITIES,
  PRIORITY_LABEL,
  REPEAT_LABEL,
  SECTORS,
  SECTOR_LABEL,
  type Notice,
  type Priority,
  type Repeat,
  type Sector,
} from './notices'
import { createNotice, deleteNotice, updateNotice } from './notices.api'

const REPEATS: Repeat[] = ['day', 'week', 'month']

// Side panel to add or edit a task. Delete asks here, not in a browser box.
export default function TaskPanel({
  task,
  sector,
  operators,
  operatorId,
  onClose,
  onSaved,
  onArchive,
  onDeleted,
}: {
  task: Notice | null
  sector: Sector
  operators: readonly Operator[]
  operatorId: string | null
  onClose: () => void
  onSaved: (task: Notice) => void
  onArchive: (task: Notice) => void
  onDeleted: (id: string) => void
}) {
  const [body, setBody] = useState(task?.body ?? '')
  const [sec, setSec] = useState<Sector>((task?.sector as Sector) ?? sector)
  const [priority, setPriority] = useState<Priority>(
    (task?.priority as Priority) ?? 'media',
  )
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '')
  const [due, setDue] = useState(task?.due_on ?? '')
  const [repeat, setRepeat] = useState(task?.repeat ?? '')
  const [link, setLink] = useState(task?.link ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    const fields = {
      body: text,
      sector: sec,
      priority,
      assignee_id: assignee || null,
      due_on: due || null,
      repeat: repeat || null,
      link: link.trim() || null,
    }
    try {
      onSaved(
        task
          ? await updateNotice(task.id, fields)
          : await createNotice('task', fields, operatorId),
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  async function remove() {
    if (!task) return
    setBusy(true)
    try {
      await deleteNotice(task.id)
      onDeleted(task.id)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  const title = task ? 'Editar tarea' : 'Nueva tarea'
  return (
    <div className="ntp" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="ntp__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <form className="ntp__panel" onSubmit={save}>
        <header className="ntp__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <label className="field-label" htmlFor="ntp-body">
          Tarea
        </label>
        <textarea
          id="ntp-body"
          className="input ntp__text"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        <p className="field-label">Sector</p>
        <div className="ntp__chips" role="group" aria-label="Sector">
          {SECTORS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sec === s}
              onClick={() => setSec(s)}
            >
              {SECTOR_LABEL[s]}
            </button>
          ))}
        </div>

        <p className="field-label">Importancia</p>
        <div className="ntp__chips" role="group" aria-label="Importancia">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="ntp__row">
          <div>
            <label className="field-label" htmlFor="ntp-who">
              Asignada a
            </label>
            <select
              id="ntp-who"
              className="input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {operators
                .filter((o) => o.active || o.id === assignee)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ntp-due">
              Fecha
            </label>
            <input
              id="ntp-due"
              type="date"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ntp-repeat">
              Repetir
            </label>
            <select
              id="ntp-repeat"
              className="input"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            >
              <option value="">No se repite</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r].replace(/^c/, 'C')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="field-label" htmlFor="ntp-link">
          Vínculo
        </label>
        <input
          id="ntp-link"
          className="input"
          placeholder="Texto o link (opcional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        <footer className="ntp__foot">
          {task &&
            (confirming ? (
              <span className="ntp__confirm">
                ¿Borrar para siempre?
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setConfirming(false)}
                >
                  No
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => onArchive(task)}
                >
                  Archivar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost ntp__del"
                  onClick={() => setConfirming(true)}
                >
                  Borrar
                </button>
              </>
            ))}
          <span className="ntp__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !body.trim()}
          >
            <Icon name="check" size={16} />
            Guardar
          </button>
        </footer>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Crear `NoticePanel.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { COLORS, COLOR_LABEL, type Notice, type NoticeColor } from './notices'
import { createNotice, updateNotice } from './notices.api'

// Side panel to add or edit a notice of the board.
export default function NoticePanel({
  notice,
  operatorId,
  onClose,
  onSaved,
  onArchive,
}: {
  notice: Notice | null
  operatorId: string | null
  onClose: () => void
  onSaved: (notice: Notice) => void
  onArchive: (notice: Notice) => void
}) {
  const [body, setBody] = useState(notice?.body ?? '')
  const [color, setColor] = useState<NoticeColor>(
    (notice?.color as NoticeColor) ?? 'amarillo',
  )
  const [pinned, setPinned] = useState(notice?.pinned ?? false)
  const [expires, setExpires] = useState(notice?.expires_on ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    const fields = { body: text, color, pinned, expires_on: expires || null }
    try {
      onSaved(
        notice
          ? await updateNotice(notice.id, fields)
          : await createNotice('notice', fields, operatorId),
      )
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  const title = notice ? 'Editar aviso' : 'Nuevo aviso'
  return (
    <div className="ntp" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="ntp__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <form className="ntp__panel" onSubmit={save}>
        <header className="ntp__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <label className="field-label" htmlFor="ntp-notice">
          Aviso
        </label>
        <textarea
          id="ntp-notice"
          className="input ntp__text"
          rows={2}
          placeholder="Ej: el jueves cerramos a las 18"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />

        <p className="field-label">Color</p>
        <div className="ntp__swatches" role="group" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ntp__swatch ntc__card--${c}`}
              aria-pressed={color === c}
              aria-label={COLOR_LABEL[c]}
              title={COLOR_LABEL[c]}
              onClick={() => setColor(c)}
            >
              {color === c && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>

        <div className="ntp__row">
          <label className="ntp__check">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Fijar adelante
          </label>
          <div>
            <label className="field-label" htmlFor="ntp-until">
              Hasta
            </label>
            <input
              id="ntp-until"
              type="date"
              className="input"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        </div>
        <p className="muted ntp__hint">
          Sin fecha, queda hasta que alguien lo archive.
        </p>

        <footer className="ntp__foot">
          {notice && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onArchive(notice)}
            >
              Archivar
            </button>
          )}
          <span className="ntp__spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !body.trim()}
          >
            <Icon name="check" size={16} />
            Guardar
          </button>
        </footer>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Correr pruebas**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/panels.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/Icon.tsx src/features/notices/TaskBits.tsx src/features/notices/TaskPanel.tsx src/features/notices/NoticePanel.tsx src/features/notices/panels.test.tsx
git commit -F "$TEMP/msg.txt"   # "feat(avisos): paneles de tarea y de aviso"
```

---

### Task 5: Cartelera, tablero, tabla y pantalla

**Files:**
- Create: `src/features/notices/NoticeCartelera.tsx`
- Create: `src/features/notices/NoticeBoard.tsx`
- Create: `src/features/notices/NoticeTable.tsx`
- Modify (reescribir): `src/features/notices/NoticesPage.tsx`
- Create: `src/features/notices/NoticesPage.test.tsx`
- Modify: `src/features/notices/notices.css` (agregar al final)

**Interfaces:**
- Consumes: todo lo de Tasks 2–4; `useOperator()` → `{ current, byId, operators }`; `useToast()` de `@/components/useToast` → `[toast, showToast(text, action?)]`; `toISODate`.
- Produces: `NoticesPage` (default export, ruta ya registrada en `admin.route.tsx`).

- [ ] **Step 1: Escribir la prueba de la pantalla (falla)**

`src/features/notices/NoticesPage.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toISODate } from '@/features/orders/validation'
import { addDaysISO } from '@/features/orders/list'
import NoticesPage from './NoticesPage'
import type { Notice } from './notices'

const mocks = vi.hoisted(() => ({
  listNotices: vi.fn(),
  createNotice: vi.fn(),
  updateNotice: vi.fn(),
  markTask: vi.fn(),
  setPriority: vi.fn(),
  archiveNotice: vi.fn(),
  deleteNotice: vi.fn(),
  countOpenTasks: vi.fn(),
}))
vi.mock('./notices.api', () => mocks)

const people = [
  { id: 'op-1', name: 'nicolas', initials: 'NI', color: '#f37021', active: true },
  { id: 'op-2', name: 'sabri', initials: 'SA', color: '#888', active: true },
]
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: people[0],
    operators: people,
    byId: (id: string | null) => people.find((p) => p.id === id),
  }),
}))

const today = toISODate(new Date())

function row(over: Partial<Notice>): Notice {
  return {
    id: 'n',
    kind: 'task',
    body: 'Tarea',
    important: false,
    created_by: 'op-1',
    created_at: new Date().toISOString(),
    done_at: null,
    done_by: null,
    archived_at: null,
    archived_by: null,
    sector: 'local',
    priority: 'media',
    assignee_id: null,
    due_on: null,
    repeat: null,
    link: null,
    color: 'amarillo',
    pinned: false,
    expires_on: null,
    last_done_at: null,
    last_done_by: null,
    ...over,
  }
}

describe('NoticesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listNotices.mockResolvedValue([
      row({ id: 'a1', kind: 'notice', body: 'El jueves cerramos a las 18' }),
      row({
        id: 'a2',
        kind: 'notice',
        body: 'Aviso viejo',
        expires_on: addDaysISO(today, -1),
      }),
      row({
        id: 't1',
        body: 'Limpiar la cama de la impresora 2',
        sector: 'taller',
        repeat: 'week',
        due_on: today,
        assignee_id: 'op-2',
      }),
      row({
        id: 't2',
        body: 'Arreglar la luz de la vidriera',
        priority: 'alta',
        assignee_id: 'op-1',
      }),
    ])
  })

  async function renderPage() {
    render(
      <MemoryRouter>
        <NoticesPage />
      </MemoryRouter>,
    )
    await act(async () => {})
  }

  it('shows the board and the active notices only', async () => {
    await renderPage()
    const board = screen.getByRole('region', { name: 'Cartelera' })
    expect(
      within(board).getByText('El jueves cerramos a las 18'),
    ).toBeInTheDocument()
    expect(within(board).queryByText('Aviso viejo')).toBeNull()
    for (const name of ['Local', 'Taller', 'Compras y faltantes', 'Presupuesto'])
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    expect(screen.getByText(/2 pendientes/)).toBeInTheDocument()
    expect(screen.getByText('1 de importancia alta')).toBeInTheDocument()
  })

  it('ticks a weekly task', async () => {
    mocks.markTask.mockResolvedValue(
      row({
        id: 't1',
        body: 'Limpiar la cama de la impresora 2',
        sector: 'taller',
        repeat: 'week',
        due_on: addDaysISO(today, 7),
        last_done_at: new Date().toISOString(),
        last_done_by: 'op-1',
      }),
    )
    await renderPage()
    await act(async () => {
      fireEvent.click(
        screen.getByRole('checkbox', {
          name: 'Marcar como hecha: Limpiar la cama de la impresora 2',
        }),
      )
    })
    expect(mocks.markTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      true,
      'op-1',
    )
    expect(screen.getByText(/hecha por nicolas hoy/)).toBeInTheDocument()
  })

  it('adds a task straight into a column', async () => {
    mocks.createNotice.mockResolvedValue(
      row({ id: 't3', body: 'Calibrar la impresora 1', sector: 'taller' }),
    )
    await renderPage()
    const taller = screen.getByRole('region', { name: 'Taller' })
    const input = within(taller).getByLabelText('Agregar en Taller')
    fireEvent.change(input, { target: { value: 'Calibrar la impresora 1' } })
    await act(async () => {
      fireEvent.submit(input)
    })
    expect(mocks.createNotice).toHaveBeenCalledWith(
      'task',
      { body: 'Calibrar la impresora 1', sector: 'taller' },
      'op-1',
    )
    expect(
      within(taller).getByText('Calibrar la impresora 1'),
    ).toBeInTheDocument()
  })

  it('filters my tasks', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^Mías/ }))
    expect(screen.getByText('Arreglar la luz de la vidriera')).toBeInTheDocument()
    expect(screen.queryByText('Limpiar la cama de la impresora 2')).toBeNull()
  })

  it('switches to the table', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tabla/ }))
    const table = screen.getByRole('table')
    expect(
      within(table).getByText('Arreglar la luz de la vidriera'),
    ).toBeInTheDocument()
    expect(within(table).getAllByText('Taller').length).toBeGreaterThan(0)
  })
})
```

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx vitest run src/features/notices/NoticesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Crear `NoticeCartelera.tsx`**

```tsx
import Icon from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import { noticeAge, untilLabel, type Notice } from './notices'

// Notices to read, in the colour whoever wrote them chose. Pinned go first.
export default function NoticeCartelera({
  notices,
  today,
  byId,
  hidden,
  onToggleHidden,
  onNew,
  onOpen,
}: {
  notices: readonly Notice[]
  today: string
  byId: (id: string | null) => Operator | undefined
  hidden: boolean
  onToggleHidden: () => void
  onNew: () => void
  onOpen: (notice: Notice) => void
}) {
  const n = notices.length
  return (
    <section className="ntc" aria-label="Cartelera">
      <header className="ntc__head">
        <Icon name="pin" className="ntc__icon" />
        <h2>Cartelera</h2>
        <span className="ntc__hint">
          {n} {n === 1 ? 'aviso activo' : 'avisos activos'} · se van solos
          cuando vencen
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onNew}>
          <Icon name="plus" size={16} />
          Nuevo aviso
        </button>
        <button
          type="button"
          className="ntc__hide"
          aria-expanded={!hidden}
          onClick={onToggleHidden}
        >
          {hidden ? 'Mostrar' : 'Ocultar'}
        </button>
      </header>
      {!hidden &&
        (n === 0 ? (
          <p className="td-empty">No hay avisos. Cargá uno con “Nuevo aviso”.</p>
        ) : (
          <ul className="ntc__grid">
            {notices.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`ntc__card ntc__card--${a.color}`}
                  onClick={() => onOpen(a)}
                >
                  <strong>
                    {a.pinned && (
                      <Icon name="pin" size={15} className="ntc__pin" />
                    )}
                    {a.body}
                  </strong>
                  <span className="ntc__meta">
                    <span>
                      {[byId(a.created_by)?.name, noticeAge(a.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {a.expires_on && (
                      <span>{untilLabel(a.expires_on, today)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  )
}
```

- [ ] **Step 3: Crear `NoticeBoard.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import Icon, { type IconName } from '@/components/Icon'
import type { Operator } from '@/features/operators/operators.api'
import {
  compareTasks,
  dueLabel,
  isOverdue,
  localDay,
  priorityMix,
  REPEAT_LABEL,
  SECTORS,
  SECTOR_LABEL,
  type Notice,
  type Priority,
  type Repeat,
  type Sector,
} from './notices'
import { Assignee, LinkText, PriorityChip, TaskCheck } from './TaskBits'

const SECTOR_ICON: Record<Sector, IconName> = {
  local: 'home',
  taller: 'printer',
  compras: 'cart',
  presupuesto: 'receipt',
}

type ById = (id: string | null) => Operator | undefined

// Four fixed columns. Each one adds tasks inline and keeps today's done ones
// at the bottom, crossed out.
export default function NoticeBoard({
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
  onQuickAdd,
}: {
  tasks: readonly Notice[]
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
  onQuickAdd: (sector: Sector, body: string) => Promise<void>
}) {
  return (
    <div className="ntb-board">
      {SECTORS.map((s) => (
        <BoardColumn
          key={s}
          sector={s}
          tasks={tasks.filter((t) => t.sector === s)}
          today={today}
          byId={byId}
          onToggle={onToggle}
          onOpen={onOpen}
          onQuickAdd={onQuickAdd}
        />
      ))}
    </div>
  )
}

function BoardColumn({
  sector,
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
  onQuickAdd,
}: {
  sector: Sector
  tasks: readonly Notice[]
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
  onQuickAdd: (sector: Sector, body: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const pending = tasks
    .filter((t) => !t.done_at)
    .sort((a, b) => compareTasks(a, b, today))
  const done = tasks.filter((t) => t.done_at)
  const label = SECTOR_LABEL[sector]

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || adding) return
    setAdding(true)
    try {
      await onQuickAdd(sector, body)
      setText('')
    } catch {
      // The page already said it failed; keep the text to retry.
    } finally {
      setAdding(false)
    }
  }

  const card = (t: Notice) => (
    <li key={t.id}>
      <TaskCard
        task={t}
        today={today}
        byId={byId}
        onToggle={onToggle}
        onOpen={onOpen}
      />
    </li>
  )

  return (
    <section className={`ntb-col ntb-col--${sector}`} aria-label={label}>
      <header className="ntb-col__head">
        <Icon name={SECTOR_ICON[sector]} size={18} />
        <h2>{label}</h2>
        <span className="ntb-col__n">{pending.length}</span>
        <p className="ntb-col__mix">{priorityMix(pending)}</p>
      </header>
      <ul className="ntb-list">{pending.map(card)}</ul>
      <form className="ntb-add" onSubmit={submit}>
        <Icon name="plus" size={16} />
        <input
          aria-label={`Agregar en ${label}`}
          placeholder={`Agregar en ${label}…`}
          value={text}
          disabled={adding}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
      {done.length > 0 && (
        <>
          <p className="ntb-done-title">Hechas hoy · {done.length}</p>
          <ul className="ntb-list">{done.map(card)}</ul>
        </>
      )}
    </section>
  )
}

function TaskCard({
  task,
  today,
  byId,
  onToggle,
  onOpen,
}: {
  task: Notice
  today: string
  byId: ById
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
}) {
  const late = isOverdue(task, today)
  const done = !!task.done_at
  const lastToday =
    !!task.last_done_at && localDay(task.last_done_at) === today
  const lastBy = byId(task.last_done_by)?.name
  return (
    <article
      className={`ntb-card${late ? ' is-late' : ''}${done ? ' is-done' : ''}`}
    >
      <div className="ntb-card__top">
        <PriorityChip priority={task.priority as Priority} />
        {task.due_on && (
          <span className={`ntb-due${late ? ' is-late' : ''}`}>
            <Icon name="calendar" size={13} />
            {dueLabel(task.due_on, today)}
          </span>
        )}
      </div>
      <div className="ntb-card__main">
        <TaskCheck task={task} onToggle={onToggle} />
        <button
          type="button"
          className="ntb-card__body"
          onClick={() => onOpen(task)}
        >
          {task.body}
        </button>
      </div>
      {task.link && <LinkText link={task.link} />}
      <div className="ntb-card__foot">
        {task.repeat && (
          <span className="ntb-repeat">
            <Icon name="auto" size={13} />
            {REPEAT_LABEL[task.repeat as Repeat]}
          </span>
        )}
        {lastToday && (
          <span className="ntb-last">
            hecha{lastBy ? ` por ${lastBy}` : ''} hoy
          </span>
        )}
        <Assignee person={byId(task.assignee_id)} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Crear `NoticeTable.tsx`**

```tsx
import { useState } from 'react'
import type { Operator } from '@/features/operators/operators.api'
import {
  dueLabel,
  isOverdue,
  SECTOR_LABEL,
  sortTasksBy,
  type Notice,
  type Priority,
  type Sector,
  type TaskSortKey,
} from './notices'
import { Assignee, LinkText, PriorityChip, TaskCheck } from './TaskBits'

const COLS: { key: TaskSortKey; label: string }[] = [
  { key: 'body', label: 'Tarea' },
  { key: 'sector', label: 'Sector' },
  { key: 'priority', label: 'Importancia' },
  { key: 'assignee', label: 'Asignado' },
  { key: 'due', label: 'Fecha' },
]

// Same tasks as the board, as rows; any column sorts.
export default function NoticeTable({
  tasks,
  today,
  byId,
  onToggle,
  onOpen,
}: {
  tasks: readonly Notice[]
  today: string
  byId: (id: string | null) => Operator | undefined
  onToggle: (task: Notice) => void
  onOpen: (task: Notice) => void
}) {
  const [sort, setSort] = useState<{ key: TaskSortKey | null; dir: 1 | -1 }>({
    key: null,
    dir: 1,
  })
  const rows = sortTasksBy(
    tasks,
    sort.key,
    sort.dir,
    (id) => byId(id)?.name ?? '',
    today,
  )

  function by(key: TaskSortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 },
    )
  }

  if (rows.length === 0)
    return <p className="td-empty">No hay tareas con este filtro.</p>

  return (
    <div className="ntt-wrap">
      <table className="ntt">
        <thead>
          <tr>
            <th aria-label="Hecha" />
            {COLS.map((c) => (
              <th
                key={c.key}
                aria-sort={
                  sort.key === c.key
                    ? sort.dir === 1
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => by(c.key)}>
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? ' ↑' : ' ↓')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const late = isOverdue(t, today)
            return (
              <tr
                key={t.id}
                className={`${late ? 'is-late' : ''}${t.done_at ? ' is-done' : ''}`}
              >
                <td>
                  <TaskCheck task={t} onToggle={onToggle} />
                </td>
                <td className="ntt__task">
                  <button
                    type="button"
                    className="ntb-card__body"
                    onClick={() => onOpen(t)}
                  >
                    {t.body}
                  </button>
                  {t.link && <LinkText link={t.link} />}
                </td>
                <td>{SECTOR_LABEL[t.sector as Sector]}</td>
                <td>
                  <PriorityChip priority={t.priority as Priority} />
                </td>
                <td>
                  <Assignee person={byId(t.assignee_id)} />
                </td>
                <td className={late ? 'ntt__late' : undefined}>
                  {t.due_on ? dueLabel(t.due_on, today) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Reescribir `NoticesPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import { toISODate } from '@/features/orders/validation'
import NoticeBoard from './NoticeBoard'
import NoticeCartelera from './NoticeCartelera'
import NoticePanel from './NoticePanel'
import NoticeTable from './NoticeTable'
import TaskPanel from './TaskPanel'
import { PriorityChip } from './TaskBits'
import {
  activeNotices,
  boardTasks,
  filterTasks,
  FILTERS,
  FILTER_LABEL,
  KIND_LABEL,
  PRIORITIES,
  taskSummary,
  type Notice,
  type NoticeKind,
  type Priority,
  type Sector,
  type TaskFilter,
} from './notices'
import {
  archiveNotice,
  createNotice,
  listNotices,
  markTask,
} from './notices.api'
import './notices.css'

type View = 'tablero' | 'tabla'
const HIDE_KEY = 'nt-cartelera-hidden'

function initialView(): View {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 700px)').matches
    ? 'tabla'
    : 'tablero'
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

// The team's screen: notices to read on top, tasks by sector below.
export default function NoticesPage() {
  const { current, byId, operators } = useOperator()
  const me = current?.id ?? null
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState<Notice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>(initialView)
  const [filter, setFilter] = useState<TaskFilter>('todas')
  const [prios, setPrios] = useState<Priority[]>([])
  const [query, setQuery] = useState('')
  const [hidden, setHidden] = useState(readHidden)
  const [taskPanel, setTaskPanel] = useState<{
    task: Notice | null
    sector: Sector
  } | null>(null)
  const [noticePanel, setNoticePanel] = useState<{
    notice: Notice | null
  } | null>(null)
  const today = toISODate(new Date())

  const load = useCallback(async () => {
    try {
      setRows(await listNotices())
      setError(null)
    } catch (err) {
      setRows([])
      setError(
        err instanceof Error ? err.message : 'No se pudieron cargar los avisos.',
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const all = rows ?? []
  const notices = activeNotices(all, today)
  const tasks = boardTasks(all, today)
  const pending = tasks.filter((t) => !t.done_at)
  const opts = { filter, priorities: prios, query, me, today }
  const shown = filterTasks(tasks, opts)
  const sum = taskSummary(tasks, today)

  function upsert(n: Notice) {
    setRows((prev) => {
      const list = prev ?? []
      return list.some((x) => x.id === n.id)
        ? list.map((x) => (x.id === n.id ? n : x))
        : [n, ...list]
    })
  }

  function drop(id: string) {
    setRows((prev) => (prev ?? []).filter((x) => x.id !== id))
  }

  async function toggle(t: Notice) {
    try {
      upsert(await markTask(t, !t.done_at, me))
    } catch {
      showToast('No se pudo marcar la tarea.')
    }
  }

  async function quickAdd(sector: Sector, body: string) {
    try {
      upsert(await createNotice('task', { body, sector }, me))
    } catch (err) {
      showToast('No se pudo agregar.')
      throw err
    }
  }

  async function archive(n: Notice) {
    setTaskPanel(null)
    setNoticePanel(null)
    drop(n.id)
    try {
      await archiveNotice(n.id, true, me)
      showToast(`${KIND_LABEL[n.kind as NoticeKind]} archivado`, {
        label: 'Deshacer',
        onClick: () => {
          void archiveNotice(n.id, false, me).then(load)
        },
      })
    } catch {
      upsert(n)
      showToast('No se pudo archivar.')
    }
  }

  function toggleHidden() {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1')
      } catch {
        // Only a convenience.
      }
      return !h
    })
  }

  function togglePrio(p: Priority) {
    setPrios((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
    )
  }

  return (
    <main className="td ntpage">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Equipo</p>
          <h1 className="page-title">Avisos y tareas</h1>
          <p className="ntpage__sum">
            {sum.pending} {sum.pending === 1 ? 'pendiente' : 'pendientes'}
            {sum.alta > 0 && (
              <>
                {' · '}
                <strong className="ntpage__alta">
                  {sum.alta} de importancia alta
                </strong>
              </>
            )}
            {sum.overdue > 0 &&
              ` · ${sum.overdue} ${sum.overdue === 1 ? 'vencida' : 'vencidas'}`}
          </p>
        </div>
        <div className="page-head__actions">
          <div className="segmented" role="group" aria-label="Vista">
            <button
              type="button"
              aria-pressed={view === 'tabla'}
              onClick={() => setView('tabla')}
            >
              <Icon name="list" size={16} />
              Tabla
            </button>
            <button
              type="button"
              aria-pressed={view === 'tablero'}
              onClick={() => setView('tablero')}
            >
              <Icon name="kanban" size={16} />
              Tablero
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setTaskPanel({ task: null, sector: 'local' })}
          >
            <Icon name="plus" size={18} />
            Nueva tarea
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      <NoticeCartelera
        notices={notices}
        today={today}
        byId={byId}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        onNew={() => setNoticePanel({ notice: null })}
        onOpen={(notice) => setNoticePanel({ notice })}
      />

      <div className="ntf">
        <div className="segmented ntf__tabs" role="group" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABEL[f]}
              <span className="ntf__n">
                {filterTasks(pending, { ...opts, filter: f, priorities: [] }).length}
              </span>
            </button>
          ))}
        </div>
        <div className="ntf__prio" role="group" aria-label="Importancia">
          <span className="ntf__label">Importancia</span>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className="ntf__chip"
              aria-pressed={prios.includes(p)}
              onClick={() => togglePrio(p)}
            >
              <PriorityChip priority={p} />
              <span className="ntf__n">
                {pending.filter((t) => t.priority === p).length}
              </span>
            </button>
          ))}
        </div>
        <label className="ntf__search">
          <Icon name="search" size={16} />
          <input
            aria-label="Buscar tarea"
            placeholder="Buscar tarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {rows == null ? (
        <p className="td-empty">Cargando…</p>
      ) : view === 'tablero' ? (
        <NoticeBoard
          tasks={shown}
          today={today}
          byId={byId}
          onToggle={(t) => void toggle(t)}
          onOpen={(task) =>
            setTaskPanel({ task, sector: task.sector as Sector })
          }
          onQuickAdd={quickAdd}
        />
      ) : (
        <NoticeTable
          tasks={shown}
          today={today}
          byId={byId}
          onToggle={(t) => void toggle(t)}
          onOpen={(task) =>
            setTaskPanel({ task, sector: task.sector as Sector })
          }
        />
      )}

      {taskPanel && (
        <TaskPanel
          task={taskPanel.task}
          sector={taskPanel.sector}
          operators={operators}
          operatorId={me}
          onClose={() => setTaskPanel(null)}
          onSaved={(n) => {
            upsert(n)
            setTaskPanel(null)
          }}
          onArchive={(n) => void archive(n)}
          onDeleted={(id) => {
            drop(id)
            setTaskPanel(null)
            showToast('Tarea borrada')
          }}
        />
      )}
      {noticePanel && (
        <NoticePanel
          notice={noticePanel.notice}
          operatorId={me}
          onClose={() => setNoticePanel(null)}
          onSaved={(n) => {
            upsert(n)
            setNoticePanel(null)
          }}
          onArchive={(n) => void archive(n)}
        />
      )}
      {toast}
    </main>
  )
}
```

- [ ] **Step 6: Estilos — agregar al final de `notices.css`**

```css
/* ---------- Pantalla Avisos y tareas ---------- */
.ntpage {
  --sec-local: #fbf1e4;
  --sec-taller: #e9eefb;
  --sec-compras: #e6f2ea;
  --sec-presupuesto: #efe9fb;
  --nc-amarillo: #fdf3c4;
  --nc-rosa: #fbe0d8;
  --nc-celeste: #dde9fb;
  --nc-verde: #dcf0e2;
  --nc-lila: #ebe2fb;
}
.ntpage__sum {
  margin-top: 4px;
  font-weight: 600;
  color: var(--text-2);
}
.ntpage__alta {
  color: var(--late);
}
.page-head__actions .segmented button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Cartelera */
.ntc {
  margin-bottom: 18px;
}
.ntc__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.ntc__head h2 {
  font-size: 1.0625rem;
  font-weight: 800;
}
.ntc__icon {
  color: var(--accent-strong);
}
.ntc__hint {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-2);
}
.ntc__hide {
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: var(--text-2);
  cursor: pointer;
}
.ntc__grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.ntc__card {
  display: grid;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: 14px;
  font: inherit;
  text-align: left;
  color: var(--color-carbon);
  cursor: pointer;
}
.ntc__card strong {
  display: flex;
  gap: 6px;
  font-weight: 800;
  overflow-wrap: anywhere;
}
.ntc__pin {
  flex: none;
  margin-top: 2px;
  color: var(--accent-strong);
}
.ntc__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-2);
}
.ntc__card--amarillo { background: var(--nc-amarillo, #fdf3c4); }
.ntc__card--rosa { background: var(--nc-rosa, #fbe0d8); }
.ntc__card--celeste { background: var(--nc-celeste, #dde9fb); }
.ntc__card--verde { background: var(--nc-verde, #dcf0e2); }
.ntc__card--lila { background: var(--nc-lila, #ebe2fb); }
.ntc__card:focus-visible,
.ntb-card__body:focus-visible,
.ntf__chip:focus-visible,
.ntp__swatch:focus-visible {
  outline: 2px solid var(--color-orange);
  outline-offset: 2px;
}

/* Filtros */
.ntf {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.ntf__n {
  margin-left: 6px;
  font-weight: 700;
  color: var(--text-3);
}
.ntf__prio {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ntf__label {
  font-weight: 700;
  color: var(--text-2);
}
.ntf__chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px 4px 4px;
  border: 1px solid var(--line);
  border-radius: 99px;
  background: var(--color-white);
  font: inherit;
  cursor: pointer;
}
.ntf__chip[aria-pressed='true'] {
  border-color: var(--color-carbon);
  box-shadow: 0 0 0 1px var(--color-carbon) inset;
}
.ntf__search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 0 12px;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--color-white);
  color: var(--text-3);
}
.ntf__search input {
  border: 0;
  outline: 0;
  font: inherit;
  min-width: 0;
  width: 180px;
}

/* Importancia */
.ntb-prio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 800;
}
.ntb-prio__bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 11px;
}
.ntb-prio__bars i {
  width: 3px;
  border-radius: 1px;
  background: currentColor;
  opacity: 0.3;
}
.ntb-prio__bars i:nth-child(1) { height: 5px; }
.ntb-prio__bars i:nth-child(2) { height: 8px; }
.ntb-prio__bars i:nth-child(3) { height: 11px; }
.ntb-prio--alta { background: #fdecea; color: var(--late); }
.ntb-prio--alta i { opacity: 1; }
.ntb-prio--media { background: #fff4e0; color: #8a5a00; }
.ntb-prio--media i:nth-child(-n + 2) { opacity: 1; }
.ntb-prio--baja { background: #f1ece6; color: var(--text-2); }
.ntb-prio--baja i:nth-child(1) { opacity: 1; }

/* Tablero */
.ntb-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}
.ntb-col {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
}
.ntb-col--local { background: var(--sec-local); }
.ntb-col--taller { background: var(--sec-taller); }
.ntb-col--compras { background: var(--sec-compras); }
.ntb-col--presupuesto { background: var(--sec-presupuesto); }
.ntb-col__head {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  column-gap: 8px;
}
.ntb-col__head h2 {
  font-size: 1.0625rem;
  font-weight: 800;
}
.ntb-col__n {
  font-weight: 800;
  color: var(--accent-strong);
}
.ntb-col__mix {
  grid-column: 1 / -1;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-2);
}
.ntb-list {
  list-style: none;
  display: grid;
  gap: 10px;
}
.ntb-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: var(--color-white);
}
.ntb-card.is-late {
  border-color: #f0a9a0;
}
.ntb-card.is-done {
  opacity: 0.65;
}
.ntb-card.is-done .ntb-card__body {
  text-decoration: line-through;
  color: var(--text-3);
}
.ntb-card__top,
.ntb-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.ntb-card__foot {
  justify-content: flex-end;
}
.ntb-card__foot .ntb-repeat,
.ntb-card__foot .ntb-last {
  margin-right: auto;
}
.ntb-card__main {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.ntb-card__body {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 800;
  text-align: left;
  color: var(--color-carbon);
  overflow-wrap: anywhere;
  cursor: pointer;
}
.ntb-card__body:hover {
  color: var(--accent-strong);
}
.ntb-due {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  font-weight: 800;
  color: #a0520c;
}
.ntb-due.is-late {
  color: var(--late);
}
.ntb-repeat,
.ntb-last {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-2);
}
.ntb-who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
}
.ntb-who.is-none {
  color: var(--text-3);
}
.ntb-who__empty {
  width: 24px;
  height: 24px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 50%;
}
.ntb-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
a.ntb-link:hover {
  color: var(--accent-strong);
}
.ntb-add {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px dashed var(--line-strong);
  border-radius: 12px;
  color: var(--text-3);
}
.ntb-add input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
}
.ntb-done-title {
  margin-top: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
}
@media (max-width: 1200px) {
  .ntb-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ntc__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .ntb-board,
  .ntc__grid { grid-template-columns: minmax(0, 1fr); }
  .ntf__search { margin-left: 0; width: 100%; }
  .ntf__search input { width: 100%; }
}

/* Tabla */
.ntt-wrap {
  overflow-x: auto;
  border-radius: 16px;
  background: var(--color-white);
}
.ntt {
  width: 100%;
  border-collapse: collapse;
}
.ntt th,
.ntt td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}
.ntt th button {
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
}
.ntt__task {
  display: grid;
  gap: 4px;
  min-width: 220px;
}
.ntt tr.is-late td:first-child {
  box-shadow: inset 3px 0 0 var(--late);
}
.ntt tr.is-done .ntb-card__body {
  text-decoration: line-through;
  color: var(--text-3);
}
.ntt__late {
  font-weight: 800;
  color: var(--late);
}

/* Paneles */
.ntp {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
}
.ntp__scrim {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(20, 20, 20, 0.45);
}
.ntp__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(460px, 100%);
  height: 100%;
  padding: calc(20px + env(safe-area-inset-top, 0px)) 22px
    calc(20px + env(safe-area-inset-bottom, 0px));
  background: var(--color-white);
  overflow-y: auto;
}
.ntp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.ntp__head h2 {
  font-size: 1.25rem;
  font-weight: 800;
}
.ntp__text {
  resize: vertical;
}
.ntp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ntp__chips button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 99px;
  background: var(--color-white);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ntp__chips button[aria-pressed='true'] {
  border-color: var(--color-carbon);
  background: var(--color-carbon);
  color: var(--color-white);
}
.ntp__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  align-items: end;
}
.ntp__swatches {
  display: flex;
  gap: 8px;
}
.ntp__swatch {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}
.ntp__swatch[aria-pressed='true'] {
  border-color: var(--color-carbon);
}
.ntp__check {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-weight: 700;
}
.ntp__hint {
  font-size: 0.8125rem;
}
.ntp__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.ntp__spacer {
  flex: 1;
}
.ntp__del {
  color: var(--late);
}
.ntp__confirm {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
```

Nota: el panel de aviso usa la clase `ntc__card--{color}` en las muestras, y las variables `--nc-*` están definidas en `.ntpage`; por eso cada regla `ntc__card--*` trae el color de respaldo, así se ven bien también dentro del panel.

- [ ] **Step 7: Correr pruebas y tipos**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx tsc -b --noEmit && npx vitest run src/features/notices`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/notices/
git commit -F "$TEMP/msg.txt"   # "feat(avisos): cartelera, tablero y tabla de tareas"
```

---

### Task 6: Menú lateral

**Files:**
- Modify: `src/features/admin/AdminLayout.tsx:6,40,83-93`

**Interfaces:**
- Consumes: `countOpenTasks(): Promise<number>` (Task 3).

- [ ] **Step 1: Cambiar el ítem y el número**

- Import: `import { countOpenTasks } from '@/features/notices/notices.api'`.
- En `MAIN`: `{ to: '/admin/avisos', label: 'Avisos y tareas', icon: 'check', sideOnly: true }`.
- Reemplazar el estado y `badge`:

```tsx
  const [openIdeas, setOpenIdeas] = useState(0)
  const [pendingTasks, setPendingTasks] = useState(0)

  useEffect(() => setMoreOpen(false), [location.pathname])
  useEffect(() => {
    void countOpenIdeas().then(setOpenIdeas)
    void countOpenTasks().then(setPendingTasks)
  }, [location.pathname])

  const counts: Record<string, number> = {
    '/admin/ideas': openIdeas,
    '/admin/avisos': pendingTasks,
  }
  const badge = (item: NavItem) =>
    counts[item.to] > 0 ? (
      <span className="shell-nav__badge">{counts[item.to]}</span>
    ) : null
```

- [ ] **Step 2: Correr toda la suite y tipos**

Run: `export PATH="$NVM_HOME/v20.19.0:$PATH" && npx tsc -b --noEmit && npx vitest run`
Expected: PASS (todas). Si `AdminLayout.test.tsx` busca el texto "Avisos" exacto, actualizar a "Avisos y tareas".

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/AdminLayout.tsx src/features/admin/AdminLayout.test.tsx
git commit -F "$TEMP/msg.txt"   # "feat(avisos): menú 'Avisos y tareas' con tareas pendientes"
```

---

### Task 7: Verificación en el navegador

Requiere la migración aplicada (Task 1, Step 5).

- [ ] **Step 1:** `preview_start` con `{ name: "dev" }` (o reusar el server en 5173) y navegar a `http://localhost:5173/admin/avisos`.
- [ ] **Step 2:** `read_console_messages` con `onlyErrors: true` → sin errores.
- [ ] **Step 3:** Crear un aviso rosa fijado con fecha, una tarea en Taller "cada semana" con fecha hoy, y marcarla: la fecha pasa a dentro de 7 días y aparece "hecha por … hoy".
- [ ] **Step 4:** Cambiar a Tabla, ordenar por Importancia; filtro Mías; buscar texto.
- [ ] **Step 5:** `resize_window` preset `mobile`, recargar: arranca en Tabla, la cartelera en una columna, sin scroll horizontal del cuerpo. Volver a `desktop`.
- [ ] **Step 6:** Ir a `/admin/hoy`: la tarjeta de Avisos se ve igual que antes.
- [ ] **Step 7:** Screenshot de escritorio para el usuario. Borrar los datos de prueba creados **solo si el usuario lo pide**.

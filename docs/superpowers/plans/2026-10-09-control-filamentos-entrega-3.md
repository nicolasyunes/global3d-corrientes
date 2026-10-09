# Control de filamentos — Entrega 3: Conteo de stock a ciegas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquiera del taller cuente los rollos del estante sin ver el número del sistema, y que el admin revise las diferencias y las apruebe (generando ajustes `kind = 'count'`). Aviso si pasan más de 7 días sin contar.

**Architecture:** Dos tablas (`stock_counts`, `stock_count_items`) que solo se escriben por RPC (`submit_stock_count`, `resolve_stock_count`), igual que las ventas. Lógica pura en `src/features/filaments/count.ts` (filas a contar, parseo, diferencias, recordatorio) con tests; `stockCount.api.ts` llama a las RPC; `CountPage.tsx` (todos) tiene el formulario a ciegas y, solo para el admin, el panel de revisión (`CountReview.tsx`). Un aviso chico (`CountReminder.tsx`) se muestra en Filamentos y en Conteo.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library, Supabase (Postgres RPC).

**Spec:** `docs/superpowers/specs/2026-10-08-control-filamentos-design.md` (sección "Entrega 3"). Desvío menor de la spec, decidido al planear: `stock_counts` guarda solo el momento de cierre (`created_at`), no el inicio, porque el conteo se carga de una vez; y se agrega el estado `discarded` para poder descartar un conteo mal hecho sin tocar el stock.

## Global Constraints

- Proyecto Supabase: `bukjmleercxlxbexekos` (base **real**). Migraciones: prueba en seco con `DO ... raise exception 'DRYRUN_OK'` en una sola llamada `execute_sql`; **aplicar pide confirmación del dueño en el chat** y lo hace el controlador, no el implementador.
- Funciones SQL: `security definer`, `set search_path = ''`, `revoke ... from public, anon`, `grant ... to authenticated`. Mensajes de error en español rioplatense (se muestran en pantalla).
- Node: el PATH del sistema tiene Node 16 (rompe vitest). Siempre `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH"` antes de `npx`/`npm`.
- `vi.mock` con constantes de nivel superior: usar `vi.hoisted`.
- Copy de la UI en español rioplatense. El conteo es **a ciegas**: la pantalla de contar nunca muestra `stock`/`stock_refill` ni valores del sistema; solo el panel de revisión (admin) muestra "esperado".
- Un color se cuenta como "Spool" (`refill = false`); si la línea es `presentation === 'both'`, además una fila "Recarga" (`refill = true`). En líneas que no son `both` no hay fila de recarga.
- Umbral de aviso: más de 7 días desde el último conteo no descartado (`COUNT_WARN_DAYS = 7`).
- Seguridad (nivel acordado): ocultar por rol en la UI; la base impide escribir stock fuera de las funciones. Solo `resolve_stock_count` mueve stock y exige admin activo.
- No commitear: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `*.xlsx`.
- Comentarios en inglés, breves (SQL en español).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261009120000_stock_counts.sql` (crear) | Tablas, RLS, RPC `submit_stock_count` y `resolve_stock_count` |
| `src/lib/database.types.ts` (modificar) | Tipos de las tablas y RPC nuevas |
| `src/features/filaments/count.ts` (crear) | Lógica pura: filas a contar, parseo, diferencias, recordatorio |
| `src/features/filaments/count.test.ts` (crear) | Tests de unidad |
| `src/features/filaments/stockCount.api.ts` (crear) | Llamadas a la base |
| `src/features/filaments/stockCount.api.test.ts` (crear) | Tests de las llamadas |
| `src/features/filaments/CountReminder.tsx` (crear) | Aviso "hace N días que no se cuenta" |
| `src/features/filaments/CountPage.tsx` (crear) | Pantalla Conteo (formulario a ciegas + revisión admin) |
| `src/features/filaments/CountReview.tsx` (crear) | Panel de revisión (solo admin) |
| `src/features/filaments/CountPage.test.tsx` (crear) | Tests de la pantalla |
| `src/features/filaments/count.css` (crear) | Estilos |
| `src/features/filaments/FilamentsPage.tsx` (modificar) | Muestra `CountReminder` |
| `src/features/admin/admin.route.tsx` (modificar) | Ruta `conteo` (todos) |
| `src/features/admin/AdminLayout.tsx` (modificar) | Ítem de menú "Conteo" (todos) |
| `src/features/admin/AdminLayout.test.tsx` (modificar) | El operador sí ve "Conteo" |

---

### Task 1: Migración — tablas y RPC del conteo

**Files:**
- Create: `supabase/migrations/20261009120000_stock_counts.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces (base):
  - tabla `public.stock_counts(id uuid, created_at timestamptz, operator_id uuid, status text, resolved_at timestamptz, resolved_by uuid)`; `status in ('pending','approved','discarded')`.
  - tabla `public.stock_count_items(id uuid, count_id uuid, color_id uuid, line_label text, color_label text, refill boolean, counted integer, expected integer)`.
  - `submit_stock_count(p_operator uuid, p_items jsonb) returns public.stock_counts`; `p_items` = `[{ "color_id": uuid, "refill": boolean, "counted": integer }]`.
  - `resolve_stock_count(p_count uuid, p_operator uuid, p_approve boolean) returns public.stock_counts`.
- Produces (tipos TS): `Tables['stock_counts']`, `Tables['stock_count_items']` y `Functions['submit_stock_count' | 'resolve_stock_count']` en `database.types.ts`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Control de filamentos (entrega 3): conteo semanal del estante, a ciegas.
-- Quien cuenta manda solo lo que contó; la base guarda lo que el sistema
-- esperaba en ese momento. El admin aprueba o descarta; aprobar genera
-- ajustes 'count' solo en las filas con diferencia.

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  -- Momento en que se cerró el conteo.
  created_at timestamptz not null default now(),
  operator_id uuid references public.operators (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'discarded')),
  resolved_at timestamptz,
  resolved_by uuid references public.operators (id) on delete set null,
  check ((status = 'pending') = (resolved_at is null))
);
create index stock_counts_created_at_idx on public.stock_counts (created_at desc);

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id) on delete cascade,
  color_id uuid references public.filament_colors (id) on delete set null,
  -- Nombres como texto, igual que filament_log: se leen aunque se borre el color.
  line_label text not null,
  color_label text not null,
  refill boolean not null default false,
  counted integer not null check (counted >= 0),
  expected integer not null check (expected >= 0)
);
create index stock_count_items_count_idx on public.stock_count_items (count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
create policy stock_counts_read
  on public.stock_counts for select to authenticated using (true);
create policy stock_count_items_read
  on public.stock_count_items for select to authenticated using (true);
-- Sin insert/update/delete por API: se cuenta y se resuelve solo por RPC.
revoke all on public.stock_counts, public.stock_count_items from anon, authenticated;
grant select on public.stock_counts, public.stock_count_items to authenticated;

-- ---------------------------------------------------------------------------
-- Cerrar un conteo: guarda lo contado y lo que el sistema esperaba.
-- ---------------------------------------------------------------------------
create or replace function public.submit_stock_count(
  p_operator uuid,
  p_items jsonb
)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts;
  v_total integer;
  v_inserted integer;
begin
  if not exists (
    select 1 from public.operators where id = p_operator and active
  ) then
    raise exception 'No se reconoce a la persona que cuenta';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Contá al menos un color';
  end if;
  v_total := jsonb_array_length(p_items);

  -- Valores válidos y sin repetidos.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
    where i.color_id is null or i.counted is null or i.counted < 0
  ) then
    raise exception 'Hay cantidades inválidas';
  end if;
  if (
    select count(distinct (i.color_id, coalesce(i.refill, false)))
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
  ) <> v_total then
    raise exception 'Hay colores repetidos en el conteo';
  end if;
  -- Recarga solo donde la línea tiene stock de recarga.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
    join public.filament_colors c on c.id = i.color_id
    where coalesce(i.refill, false) and c.stock_refill is null
  ) then
    raise exception 'Ese color no tiene recarga';
  end if;

  insert into public.stock_counts (operator_id) values (p_operator)
    returning * into v_count;

  insert into public.stock_count_items
    (count_id, color_id, line_label, color_label, refill, counted, expected)
  select v_count.id, c.id, l.brand || ' ' || l.name, c.name,
         coalesce(i.refill, false), i.counted,
         case when coalesce(i.refill, false) then coalesce(c.stock_refill, 0)
              else c.stock end
  from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
  join public.filament_colors c on c.id = i.color_id
  join public.filament_lines l on l.id = c.line_id;

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_total then
    raise exception 'Hay colores que ya no existen; recargá la pantalla';
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aprobar o descartar un conteo: solo admin. Aprobar ajusta el stock en la
-- diferencia contado − esperado (no a un valor absoluto), así no pisa ventas
-- hechas entre el conteo y la revisión.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_stock_count(
  p_count uuid,
  p_operator uuid,
  p_approve boolean
)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts;
  v_who text;
  v_item public.stock_count_items;
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede revisar conteos';
  end if;

  select * into v_count from public.stock_counts where id = p_count for update;
  if not found then
    raise exception 'No se encontró el conteo';
  end if;
  if v_count.status <> 'pending' then
    raise exception 'Este conteo ya se resolvió';
  end if;

  if p_approve then
    select coalesce(name, 'alguien') into v_who
      from public.operators where id = v_count.operator_id;
    v_who := coalesce(v_who, 'alguien');

    for v_item in
      select * from public.stock_count_items
      where count_id = p_count and color_id is not null and counted <> expected
      order by line_label, color_label
    loop
      perform public.move_filament(
        v_item.color_id, v_item.refill, v_item.counted - v_item.expected,
        'count', p_operator,
        'Conteo de ' || v_who || ' ('
          || to_char(v_count.created_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
          || '): contó ' || v_item.counted || ', esperado ' || v_item.expected
      );
    end loop;
  end if;

  update public.stock_counts
    set status = case when p_approve then 'approved' else 'discarded' end,
        resolved_at = now(), resolved_by = p_operator
    where id = p_count
    returning * into v_count;

  return v_count;
end;
$$;

revoke execute on function public.submit_stock_count(uuid, jsonb) from public, anon;
revoke execute on function public.resolve_stock_count(uuid, uuid, boolean) from public, anon;
grant execute on function public.submit_stock_count(uuid, jsonb) to authenticated;
grant execute on function public.resolve_stock_count(uuid, uuid, boolean) to authenticated;
```

- [ ] **Step 2: Verificar el nombre de la columna del operador**

Run: `grep -n "operators" -A12 src/lib/database.types.ts | head -30`
Expected: la tabla `operators` tiene `name`, `role`, `active`. Si el nombre se llama distinto, ajustar `resolve_stock_count`.

- [ ] **Step 3: Prueba en seco (NO aplicar)**

Una sola llamada `execute_sql` (proyecto `bukjmleercxlxbexekos`) con la migración completa seguida de un bloque `DO $$ ... $$` que: elige un color con stock ≥ 1 y un admin activo; llama `submit_stock_count` con un ítem `counted = stock + 2`; verifica `expected = stock`; luego (a) `resolve_stock_count` con un operador no admin falla, (b) con admin y `p_approve = true` el stock sube 2 y hay una fila `filament_movements.kind = 'count'` con delta 2, (c) resolver de nuevo falla con "ya se resolvió", (d) un conteo vacío `'[]'` falla, (e) un ítem repetido falla, (f) un `counted` negativo falla. Termina con `raise exception 'DRYRUN_OK'`. Esperado: el error final es exactamente `DRYRUN_OK` (todo se revierte).

- [ ] **Step 4: Tipos**

Agregar a `src/lib/database.types.ts`, a mano y en el mismo estilo que `filament_sales`, las tablas `stock_counts` y `stock_count_items` (Row/Insert/Update/Relationships) y las funciones:

```ts
submit_stock_count: {
  Args: { p_operator: string; p_items: Json }
  Returns: Database['public']['Tables']['stock_counts']['Row']
}
resolve_stock_count: {
  Args: { p_count: string; p_operator: string; p_approve: boolean }
  Returns: Database['public']['Tables']['stock_counts']['Row']
}
```

(Si `Json` no está importado en el archivo, usar el tipo que ya usan otras funciones con jsonb.)

- [ ] **Step 5: Typecheck y commit**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npm run typecheck`
Expected: sin errores.

```bash
git add supabase/migrations/20261009120000_stock_counts.sql src/lib/database.types.ts
git commit -m "feat(conteo): tablas y funciones del conteo de stock"
```

La migración **no se aplica** en esta tarea: el controlador la aplica con el OK del dueño.

---

### Task 2: Lógica pura del conteo

**Files:**
- Create: `src/features/filaments/count.ts`
- Test: `src/features/filaments/count.test.ts`

**Interfaces:**
- Consumes: `FilamentLine` de `./filaments`; `designLines()` de `./fixtures` (en tests); `Database` de `@/lib/database.types`.
- Produces:
  - `type StockCountRow`, `type StockCountItem`, `interface StockCount extends StockCountRow { items: StockCountItem[] }`
  - `const COUNT_WARN_DAYS = 7`
  - `countKey(colorId: string, refill: boolean): string` → `"<id>:s"` o `"<id>:r"`
  - `interface CountRowSpec { key: string; colorId: string; refill: boolean; colorLabel: string; swatch: string; suffix: string }` (`suffix` = `''`, `'Spool'` o `'Recarga'`)
  - `interface CountGroup { lineId: string; label: string; rows: CountRowSpec[] }`
  - `countGroups(lines: readonly FilamentLine[]): CountGroup[]`
  - `parseCounted(text: string): number | null | 'invalid'`
  - `draftToItems(draft: Readonly<Record<string, string>>): { items: { color_id: string; refill: boolean; counted: number }[]; invalid: string[] }`
  - `countDiff(item: Pick<StockCountItem, 'counted' | 'expected'>): number`
  - `summarizeCount(items: readonly StockCountItem[]): { total: number; same: number; over: number; short: number; net: number }`
  - `interface CountReminderInfo { days: number | null; overdue: boolean; pending: number }`
  - `countReminder(counts: readonly Pick<StockCountRow, 'created_at' | 'status'>[], now: Date): CountReminderInfo`
  - `reminderText(info: CountReminderInfo, isAdmin: boolean): string | null`

- [ ] **Step 1: Escribir los tests que fallan** (`count.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import {
  COUNT_WARN_DAYS,
  countDiff,
  countGroups,
  countKey,
  countReminder,
  draftToItems,
  parseCounted,
  reminderText,
  summarizeCount,
} from './count'
import { designLines } from './fixtures'

describe('countGroups', () => {
  it('una fila por color, y recarga solo en líneas con ambas presentaciones', () => {
    const lines = designLines()
    const groups = countGroups(lines)
    expect(groups).toHaveLength(lines.length)
    const totalColors = lines.reduce((n, l) => n + l.colors.length, 0)
    const bothExtra = lines
      .filter((l) => l.presentation === 'both')
      .reduce((n, l) => n + l.colors.length, 0)
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(
      totalColors + bothExtra,
    )
    const bothLine = lines.find((l) => l.presentation === 'both')!
    const g = groups.find((x) => x.lineId === bothLine.id)!
    expect(g.rows[0].suffix).toBe('Spool')
    expect(g.rows.some((r) => r.refill && r.suffix === 'Recarga')).toBe(true)
    const plain = groups.find(
      (x) => lines.find((l) => l.id === x.lineId)!.presentation !== 'both',
    )!
    expect(plain.rows.every((r) => !r.refill && r.suffix === '')).toBe(true)
  })

  it('la clave distingue spool de recarga y no expone el stock', () => {
    expect(countKey('c1', false)).toBe('c1:s')
    expect(countKey('c1', true)).toBe('c1:r')
    const row = countGroups(designLines())[0].rows[0]
    expect(Object.keys(row).sort()).toEqual(
      ['colorId', 'colorLabel', 'key', 'refill', 'suffix', 'swatch'].sort(),
    )
  })
})

describe('parseCounted', () => {
  it('vacío es sin contar, número entero es válido, el resto es inválido', () => {
    expect(parseCounted('')).toBeNull()
    expect(parseCounted('  ')).toBeNull()
    expect(parseCounted('0')).toBe(0)
    expect(parseCounted(' 12 ')).toBe(12)
    expect(parseCounted('-1')).toBe('invalid')
    expect(parseCounted('2,5')).toBe('invalid')
    expect(parseCounted('abc')).toBe('invalid')
  })
})

describe('draftToItems', () => {
  it('manda solo lo contado y avisa de lo inválido', () => {
    const r = draftToItems({ 'a:s': '3', 'b:r': '0', 'c:s': '', 'd:s': 'x' })
    expect(r.items).toEqual([
      { color_id: 'a', refill: false, counted: 3 },
      { color_id: 'b', refill: true, counted: 0 },
    ])
    expect(r.invalid).toEqual(['d:s'])
  })
})

describe('diferencias', () => {
  const item = (counted: number, expected: number) =>
    ({ counted, expected }) as never
  it('countDiff es contado menos esperado', () => {
    expect(countDiff({ counted: 3, expected: 5 })).toBe(-2)
    expect(countDiff({ counted: 5, expected: 5 })).toBe(0)
  })
  it('summarizeCount cuenta iguales, sobrantes y faltantes', () => {
    const s = summarizeCount([item(3, 5), item(5, 5), item(6, 4), item(0, 1)])
    expect(s).toEqual({ total: 4, same: 1, over: 1, short: 2, net: -1 })
  })
})

describe('countReminder', () => {
  const now = new Date('2026-10-20T12:00:00Z')
  it('sin conteos: vencido, sin días', () => {
    expect(countReminder([], now)).toEqual({ days: null, overdue: true, pending: 0 })
  })
  it('usa el último no descartado y cuenta los pendientes', () => {
    const r = countReminder(
      [
        { created_at: '2026-10-19T12:00:00Z', status: 'discarded' },
        { created_at: '2026-10-15T12:00:00Z', status: 'pending' },
        { created_at: '2026-10-01T12:00:00Z', status: 'approved' },
      ],
      now,
    )
    expect(r).toEqual({ days: 5, overdue: false, pending: 1 })
  })
  it('más de 7 días es vencido; justo 7 no', () => {
    const at = (d: number) =>
      countReminder(
        [{ created_at: new Date(now.getTime() - d * 86_400_000).toISOString(), status: 'approved' }],
        now,
      )
    expect(COUNT_WARN_DAYS).toBe(7)
    expect(at(7).overdue).toBe(false)
    expect(at(8).overdue).toBe(true)
  })
})

describe('reminderText', () => {
  it('textos para cada caso', () => {
    expect(reminderText({ days: null, overdue: true, pending: 0 }, false)).toBe(
      'Todavía no se hizo ningún conteo del estante.',
    )
    expect(reminderText({ days: 9, overdue: true, pending: 0 }, false)).toBe(
      'Hace 9 días que no se cuenta el estante.',
    )
    expect(reminderText({ days: 2, overdue: false, pending: 0 }, false)).toBeNull()
    expect(reminderText({ days: 2, overdue: false, pending: 2 }, true)).toBe(
      '2 conteos esperan tu revisión.',
    )
    expect(reminderText({ days: 2, overdue: false, pending: 1 }, true)).toBe(
      '1 conteo espera tu revisión.',
    )
    expect(reminderText({ days: 2, overdue: false, pending: 1 }, false)).toBeNull()
    expect(reminderText({ days: 9, overdue: true, pending: 1 }, true)).toBe(
      'Hace 9 días que no se cuenta el estante. 1 conteo espera tu revisión.',
    )
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run src/features/filaments/count.test.ts`
Expected: FAIL (no existe `./count`).

- [ ] **Step 3: Implementar `count.ts`**

```ts
import type { Database } from '@/lib/database.types'
import type { FilamentLine } from './filaments'

type Tables = Database['public']['Tables']
export type StockCountRow = Tables['stock_counts']['Row']
export type StockCountItem = Tables['stock_count_items']['Row']
export interface StockCount extends StockCountRow {
  items: StockCountItem[]
}

export const COUNT_WARN_DAYS = 7

export function countKey(colorId: string, refill: boolean): string {
  return `${colorId}:${refill ? 'r' : 's'}`
}

// What a person counts: never carries the system's stock (the count is blind).
export interface CountRowSpec {
  key: string
  colorId: string
  refill: boolean
  colorLabel: string
  swatch: string
  suffix: string
}
export interface CountGroup {
  lineId: string
  label: string
  rows: CountRowSpec[]
}

export function countGroups(lines: readonly FilamentLine[]): CountGroup[] {
  return lines.map((line) => {
    const both = line.presentation === 'both'
    const rows: CountRowSpec[] = []
    for (const c of line.colors) {
      rows.push({
        key: countKey(c.id, false),
        colorId: c.id,
        refill: false,
        colorLabel: c.name,
        swatch: c.swatch,
        suffix: both ? 'Spool' : '',
      })
      if (both)
        rows.push({
          key: countKey(c.id, true),
          colorId: c.id,
          refill: true,
          colorLabel: c.name,
          swatch: c.swatch,
          suffix: 'Recarga',
        })
    }
    return { lineId: line.id, label: `${line.brand} ${line.name}`, rows }
  })
}

// '' → not counted; whole number → counted; anything else is a typo.
export function parseCounted(text: string): number | null | 'invalid' {
  const t = text.trim()
  if (t === '') return null
  return /^\d{1,4}$/.test(t) ? Number(t) : 'invalid'
}

export function draftToItems(draft: Readonly<Record<string, string>>): {
  items: { color_id: string; refill: boolean; counted: number }[]
  invalid: string[]
} {
  const items: { color_id: string; refill: boolean; counted: number }[] = []
  const invalid: string[] = []
  for (const [key, text] of Object.entries(draft)) {
    const n = parseCounted(text)
    if (n === null) continue
    if (n === 'invalid') {
      invalid.push(key)
      continue
    }
    const [color_id, kind] = key.split(':')
    items.push({ color_id, refill: kind === 'r', counted: n })
  }
  return { items, invalid }
}

export function countDiff(
  item: Pick<StockCountItem, 'counted' | 'expected'>,
): number {
  return item.counted - item.expected
}

export function summarizeCount(items: readonly StockCountItem[]) {
  const s = { total: items.length, same: 0, over: 0, short: 0, net: 0 }
  for (const it of items) {
    const d = countDiff(it)
    s.net += d
    if (d === 0) s.same += 1
    else if (d > 0) s.over += 1
    else s.short += 1
  }
  return s
}

export interface CountReminderInfo {
  days: number | null
  overdue: boolean
  pending: number
}

// Days since the last count that was not discarded, and how many wait for review.
export function countReminder(
  counts: readonly Pick<StockCountRow, 'created_at' | 'status'>[],
  now: Date,
): CountReminderInfo {
  const kept = counts.filter((c) => c.status !== 'discarded')
  const pending = counts.filter((c) => c.status === 'pending').length
  if (kept.length === 0) return { days: null, overdue: true, pending }
  const last = Math.max(...kept.map((c) => new Date(c.created_at).getTime()))
  const days = Math.floor((now.getTime() - last) / 86_400_000)
  return { days, overdue: days > COUNT_WARN_DAYS, pending }
}

export function reminderText(
  info: CountReminderInfo,
  isAdmin: boolean,
): string | null {
  const parts: string[] = []
  if (info.days === null) parts.push('Todavía no se hizo ningún conteo del estante.')
  else if (info.overdue)
    parts.push(`Hace ${info.days} días que no se cuenta el estante.`)
  if (isAdmin && info.pending > 0)
    parts.push(
      info.pending === 1
        ? '1 conteo espera tu revisión.'
        : `${info.pending} conteos esperan tu revisión.`,
    )
  return parts.length ? parts.join(' ') : null
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run src/features/filaments/count.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck y commit**

Run: `npm run typecheck` → sin errores.

```bash
git add src/features/filaments/count.ts src/features/filaments/count.test.ts
git commit -m "feat(conteo): lógica pura del conteo de stock"
```

---

### Task 3: Llamadas a la base

**Files:**
- Create: `src/features/filaments/stockCount.api.ts`
- Test: `src/features/filaments/stockCount.api.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `StockCount`, `StockCountRow` de `./count`.
- Produces:
  - `submitStockCount(operatorId: string | null, items: { color_id: string; refill: boolean; counted: number }[]): Promise<StockCountRow>`
  - `resolveStockCount(countId: string, operatorId: string | null, approve: boolean): Promise<StockCountRow>`
  - `listStockCounts(limit?: number): Promise<StockCount[]>` (más nuevo primero; cada conteo con sus `items`)
  - `listCountStatus(): Promise<Pick<StockCountRow, 'created_at' | 'status'>[]>` (últimos 60, más nuevo primero)

- [ ] **Step 1: Test que falla** (`stockCount.api.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import {
  listCountStatus,
  listStockCounts,
  resolveStockCount,
  submitStockCount,
} from './stockCount.api'

describe('stock count API', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    rpc.mockResolvedValue({ data: { id: 'k1' }, error: null })
  })

  it('submitStockCount manda persona e ítems', async () => {
    const items = [{ color_id: 'c1', refill: false, counted: 3 }]
    await submitStockCount('op1', items)
    expect(rpc).toHaveBeenCalledWith('submit_stock_count', {
      p_operator: 'op1',
      p_items: items,
    })
  })

  it('resolveStockCount manda conteo, persona y decisión', async () => {
    await resolveStockCount('k1', 'op1', true)
    expect(rpc).toHaveBeenCalledWith('resolve_stock_count', {
      p_count: 'k1',
      p_operator: 'op1',
      p_approve: true,
    })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Este conteo ya se resolvió' } })
    await expect(resolveStockCount('k1', 'op1', false)).rejects.toThrow(
      'Este conteo ya se resolvió',
    )
  })

  it('listStockCounts pide los conteos con sus ítems, el más nuevo primero', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'k1', items: [] }], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    from.mockReturnValue({ select })
    const r = await listStockCounts(5)
    expect(from).toHaveBeenCalledWith('stock_counts')
    expect(select).toHaveBeenCalledWith('*, items:stock_count_items(*)')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(5)
    expect(r).toEqual([{ id: 'k1', items: [] }])
  })

  it('listCountStatus pide solo fecha y estado', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const select = vi.fn().mockReturnValue({ order })
    from.mockReturnValue({ select })
    await listCountStatus()
    expect(select).toHaveBeenCalledWith('created_at, status')
    expect(limit).toHaveBeenCalledWith(60)
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run src/features/filaments/stockCount.api.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `stockCount.api.ts`**

```ts
import { supabase } from '@/lib/supabase'
import type { StockCount, StockCountRow } from './count'

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// Closes a count: the database stores what was counted and what the system
// expected at that moment.
export async function submitStockCount(
  operatorId: string | null,
  items: { color_id: string; refill: boolean; counted: number }[],
): Promise<StockCountRow> {
  const { data, error } = await supabase.rpc('submit_stock_count', {
    p_operator: operatorId as string, // the database rejects null with a message
    p_items: items,
  })
  if (error) fail(error)
  return data as StockCountRow
}

// Admin only (checked in the database). Approving adjusts the stock by the
// difference of each counted row; discarding leaves it untouched.
export async function resolveStockCount(
  countId: string,
  operatorId: string | null,
  approve: boolean,
): Promise<StockCountRow> {
  const { data, error } = await supabase.rpc('resolve_stock_count', {
    p_count: countId,
    p_operator: operatorId as string, // the database rejects null with a message
    p_approve: approve,
  })
  if (error) fail(error)
  return data as StockCountRow
}

export async function listStockCounts(limit = 20): Promise<StockCount[]> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*, items:stock_count_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail(error)
  return (data ?? []) as unknown as StockCount[]
}

// Just enough to know when the shelf was last counted and what awaits review.
export async function listCountStatus(): Promise<
  Pick<StockCountRow, 'created_at' | 'status'>[]
> {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('created_at, status')
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) fail(error)
  return (data ?? []) as Pick<StockCountRow, 'created_at' | 'status'>[]
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments/stockCount.api.test.ts` → PASS. `npm run typecheck` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments/stockCount.api.ts src/features/filaments/stockCount.api.test.ts
git commit -m "feat(conteo): llamadas a la base del conteo"
```

---

### Task 4: Pantalla Conteo (a ciegas) y revisión del admin

**Files:**
- Create: `src/features/filaments/CountReminder.tsx`, `CountPage.tsx`, `CountReview.tsx`, `count.css`
- Test: `src/features/filaments/CountPage.test.tsx`

**Interfaces:**
- Consumes: `listLines` de `./filaments.api`; todo `./count` (Task 2); `submitStockCount`, `resolveStockCount`, `listStockCounts`, `listCountStatus` de `./stockCount.api` (Task 3); `useOperator()` → `{ current, isAdmin, byId }`; `useToast` de `@/components/useToast`; clases `fl-btn`, `fl-btn--primary`, `fl-error`, `fl-quiet`, `fl-search` de `filaments.css`; `logStamp`/`moveWhen` de `./filaments` para fechas; `signed` de `./filaments`.
- Produces:
  - `CountReminder({ reloadKey?: number })` (default export): carga `listCountStatus`, calcula `countReminder` y muestra `reminderText(info, isAdmin)` en un `<p role="status" className="ct-reminder">` con un `<Link to="/admin/conteo">` "Ir al conteo" (no se muestra el link dentro de la propia pantalla Conteo: prop `showLink?: boolean`, por defecto `true`). Si no hay texto no renderiza nada; si falla la carga no renderiza nada.
  - `CountPage` (default export).
  - `CountReview({ reloadKey, onResolved })` (default export), solo se monta si `isAdmin`.

**Comportamiento de `CountPage`** (todos):
- Título "Conteo de stock", subtítulo "Contá los rollos cerrados que hay en el estante. No se muestra cuánto debería haber."
- Carga `listLines()`; mientras carga `Cargando filamentos…`; si falla muestra `role="alert"` con el mensaje.
- `<CountReminder showLink={false} reloadKey={…} />` arriba.
- Un buscador (`aria-label="Buscar color o marca"`) que filtra por texto (sin tildes ni mayúsculas) sobre `label de línea` y `colorLabel`; no cambia el borrador.
- Por cada `CountGroup`: `<section aria-label={group.label}>` con título y filas: muestra el nombre del color, el suffix si hay, y un `<input inputMode="numeric" aria-label={\`Contados de ${colorLabel}${suffix ? ' ' + suffix : ''} — ${group.label}\`}>` (nunca muestra el stock del sistema).
- Borrador `Record<key, string>` guardado en `localStorage` bajo `g3d.countDraft` (envolver en try/catch); se borra al cerrar el conteo.
- Pie fijo con "Contados: N de M" (N = filas con número válido) y el botón **"Cerrar conteo"** (deshabilitado si N = 0 o está guardando). Al tocar: si hay inválidos → error "Revisá las cantidades: solo números enteros."; si faltan filas (N < M) pide `window.confirm("Faltan X filas sin contar. ¿Cerrar igual?")` y cancela si responde que no.
- Al guardar: `submitStockCount(current?.id ?? null, items)`; éxito → borra el borrador, vacía el formulario, `showToast('Conteo enviado. Gracias.')`, sube `reloadKey` (recarga el recordatorio y el panel); error → muestra el mensaje en `role="alert"` y conserva el borrador.
- Si `isAdmin`: debajo, `<CountReview reloadKey={…} onResolved={…} />`.

**Comportamiento de `CountReview`** (admin):
- Carga `listStockCounts()`. Estado vacío: "Todavía no hay conteos."
- Pendientes primero (`status === 'pending'`), luego resueltos (últimos 5). Cada conteo es `<article>` con: "Conteo de {byId(operator_id).name} · {logStamp o moveWhen(created_at)}", resumen `summarizeCount` ("12 colores: 9 iguales, 1 de más, 2 de menos · neto −3"), y la lista **solo de las filas con diferencia** (línea, color + suffix `Recarga` si `refill`, `esperado X → contó Y`, diferencia con `signed()`); si no hay diferencias, "Sin diferencias."
- Pendiente: botones "Aprobar ajustes" (texto de ayuda: "Corrige el stock en las diferencias y queda en Actividad") y "Descartar". Descartar pide `window.confirm('¿Descartar este conteo? No se toca el stock.')`. Ambos llaman `resolveStockCount(count.id, current?.id ?? null, approve)`, muestran errores en `role="alert"`, y al terminar llaman `onResolved()` (recarga lista y recordatorio).
- Resuelto: etiqueta "Aprobado" / "Descartado" con quién y cuándo (`resolved_by`, `resolved_at`).

- [ ] **Step 1: Test que falla** (`CountPage.test.tsx`)

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CountPage from './CountPage'
import { designLines } from './fixtures'

const mocks = vi.hoisted(() => ({
  listLines: vi.fn(),
  submitStockCount: vi.fn(),
  resolveStockCount: vi.fn(),
  listStockCounts: vi.fn(),
  listCountStatus: vi.fn(),
}))
const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('./filaments.api', () => ({ listLines: mocks.listLines }))
vi.mock('./stockCount.api', () => ({
  submitStockCount: mocks.submitStockCount,
  resolveStockCount: mocks.resolveStockCount,
  listStockCounts: mocks.listStockCounts,
  listCountStatus: mocks.listCountStatus,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'sabri' },
    isAdmin: operator.isAdmin,
    byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }),
  }),
}))

const pendingCount = {
  id: 'k1',
  created_at: new Date().toISOString(),
  operator_id: 'op-2',
  status: 'pending',
  resolved_at: null,
  resolved_by: null,
  items: [
    { id: 'i1', count_id: 'k1', color_id: 'c1', line_label: '3N3 PLA', color_label: 'Rojo', refill: false, counted: 3, expected: 5 },
    { id: 'i2', count_id: 'k1', color_id: 'c2', line_label: '3N3 PLA', color_label: 'Azul', refill: false, counted: 4, expected: 4 },
  ],
}

async function renderPage() {
  render(
    <MemoryRouter>
      <CountPage />
    </MemoryRouter>,
  )
  await act(async () => {})
}

function firstInput() {
  return screen.getAllByRole('textbox', { name: /^Contados de / })[0]
}

describe('CountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    operator.isAdmin = false
    mocks.listLines.mockResolvedValue(designLines())
    mocks.listCountStatus.mockResolvedValue([])
    mocks.listStockCounts.mockResolvedValue([])
    mocks.submitStockCount.mockResolvedValue({ id: 'k9' })
  })

  it('es a ciegas: no muestra el stock del sistema ni "esperado"', async () => {
    await renderPage()
    expect(screen.queryByText(/esperado/i)).toBeNull()
    expect(screen.queryByText(/Valor del stock/)).toBeNull()
    expect(
      screen.getByText(/No se muestra cuánto debería haber/),
    ).toBeInTheDocument()
  })

  it('cierra el conteo mandando solo lo contado', async () => {
    window.confirm = vi.fn(() => true)
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '3' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(window.confirm).toHaveBeenCalled() // faltan filas
    expect(mocks.submitStockCount).toHaveBeenCalledWith('op-1', [
      expect.objectContaining({ refill: false, counted: 3 }),
    ])
    expect(screen.getByText('Conteo enviado. Gracias.')).toBeInTheDocument()
  })

  it('no cierra con cantidades inválidas', async () => {
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '2,5' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(mocks.submitStockCount).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('solo números enteros')
  })

  it('el botón queda apagado sin nada contado y el borrador sobrevive', async () => {
    const first = await (async () => {
      await renderPage()
      return screen.getByRole('button', { name: 'Cerrar conteo' })
    })()
    expect(first).toBeDisabled()
    fireEvent.change(firstInput(), { target: { value: '4' } })
    expect(JSON.parse(localStorage.getItem('g3d.countDraft')!)).toMatchObject({})
    expect(Object.values(JSON.parse(localStorage.getItem('g3d.countDraft')!))).toContain('4')
  })

  it('un error de la base se muestra y se conserva lo cargado', async () => {
    window.confirm = vi.fn(() => true)
    mocks.submitStockCount.mockRejectedValue(new Error('Hay colores que ya no existen; recargá la pantalla'))
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '1' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('ya no existen')
    expect(firstInput()).toHaveValue('1')
  })

  it('el operador no ve la revisión', async () => {
    mocks.listStockCounts.mockResolvedValue([pendingCount])
    await renderPage()
    expect(screen.queryByRole('button', { name: /Aprobar ajustes/ })).toBeNull()
    expect(mocks.listStockCounts).not.toHaveBeenCalled()
  })
})

describe('CountPage como admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    operator.isAdmin = true
    mocks.listLines.mockResolvedValue(designLines())
    mocks.listCountStatus.mockResolvedValue([])
    mocks.listStockCounts.mockResolvedValue([pendingCount])
    mocks.resolveStockCount.mockResolvedValue({ id: 'k1', status: 'approved' })
  })

  it('muestra solo las diferencias, con quién contó', async () => {
    await renderPage()
    const card = screen.getByRole('article', { name: /Conteo de nicolas|Conteo de sabri/ })
    expect(within(card).getByText(/esperado 5/)).toBeInTheDocument()
    expect(within(card).queryByText('Azul')).toBeNull() // sin diferencia
    expect(within(card).getByText(/−2/)).toBeInTheDocument()
  })

  it('aprueba los ajustes', async () => {
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar ajustes/ }))
    })
    expect(mocks.resolveStockCount).toHaveBeenCalledWith('k1', 'op-1', true)
  })

  it('descartar pide confirmación y no mueve stock', async () => {
    window.confirm = vi.fn(() => true)
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    })
    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.resolveStockCount).toHaveBeenCalledWith('k1', 'op-1', false)
  })

  it('no resuelve si no confirma el descarte', async () => {
    window.confirm = vi.fn(() => false)
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    })
    expect(mocks.resolveStockCount).not.toHaveBeenCalled()
  })
})
```

Notas para el implementador: el `<article>` del conteo lleva `aria-label` con "Conteo de {nombre} · {cuándo}" para que `getByRole('article', { name })` funcione; la línea de diferencia contiene el texto `esperado 5 → contó 3` y la diferencia `−2` (formato `signed()`); el test del borrador puede ajustarse si la estructura exacta del JSON guardado difiere, pero debe seguir verificando que el valor `'4'` quedó en `localStorage` bajo `g3d.countDraft`.

- [ ] **Step 2: Correr y ver que falla**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run src/features/filaments/CountPage.test.tsx`
Expected: FAIL (no existen los componentes).

- [ ] **Step 3: Implementar** `CountReminder.tsx`, `CountReview.tsx`, `CountPage.tsx` y `count.css` según el comportamiento de arriba. Seguir el estilo de `SalesPanel.tsx` (carga con `alive`, errores en `role="alert"` con `fl-error`) y `StatsPage.tsx` (secciones). `count.css` define las clases `ct-*` (`ct`, `ct-group`, `ct-row`, `ct-input`, `ct-foot`, `ct-reminder`, `ct-review`, `ct-diff`), usa los tokens `var(--color-white)`, `var(--radius-lg)`, `var(--shadow-card)`, `var(--color-carbon-muted)`, `var(--color-divider)`; el pie del formulario es `position: sticky; bottom: 0` con fondo blanco; todo debe funcionar a 375 px de ancho sin scroll horizontal (inputs de 4.5rem, `min-width: 0` en los contenedores). Importar `@/features/orders/taller.css`, `./filaments.css` y `./count.css`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments/CountPage.test.tsx` → PASS. `npm run typecheck` y `npm run lint` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments/CountReminder.tsx src/features/filaments/CountPage.tsx src/features/filaments/CountReview.tsx src/features/filaments/count.css src/features/filaments/CountPage.test.tsx
git commit -m "feat(conteo): pantalla de conteo a ciegas y revisión del admin"
```

---

### Task 5: Ruta, menú y aviso en Filamentos

**Files:**
- Modify: `src/features/admin/admin.route.tsx`, `src/features/admin/AdminLayout.tsx`, `src/features/admin/AdminLayout.test.tsx`, `src/features/filaments/FilamentsPage.tsx`, `src/features/filaments/FilamentsPage.test.tsx`

**Interfaces:**
- Consumes: `CountPage` (default), `CountReminder` (default, prop `reloadKey?`, `showLink?`) de Task 4.
- Produces: ruta `/admin/conteo` abierta a todos los perfiles; ítem de menú "Conteo" (ícono `list`) en `SECONDARY` **sin** `adminOnly`.

- [ ] **Step 1: Tests que fallan**

En `AdminLayout.test.tsx`, junto al test existente que verifica los ítems del operador (el que comprueba que el operador no ve "Estadísticas"), agregar la aserción de que **sí** ve `Conteo`; y en el del admin, que ve `Conteo`. Seguir el estilo exacto de esas aserciones (mirar cómo ya buscan "Estadísticas"/"Personas").

En `FilamentsPage.test.tsx`: agregar `vi.mock('./stockCount.api', ...)` con `listCountStatus: vi.fn().mockResolvedValue([])` (hoisted) y un test en el `describe` del operador:

```tsx
it('avisa que no se hizo ningún conteo', async () => {
  await renderPage()
  expect(
    screen.getByText('Todavía no se hizo ningún conteo del estante.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ir al conteo' })).toHaveAttribute(
    'href',
    '/admin/conteo',
  )
})
```

`FilamentsPage` hoy se renderiza sin router: envolver `render(<FilamentsPage />)` de `renderPage()` en `<MemoryRouter>` (importar de `react-router-dom`) para todos los tests de ese archivo.

- [ ] **Step 2: Correr y ver que fallan**

Run: `export PATH="/c/Users/nyunes/AppData/Local/nvm/v20.19.0:$PATH" && npx vitest run src/features/admin/AdminLayout.test.tsx src/features/filaments/FilamentsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `admin.route.tsx`: importar `CountPage from '@/features/filaments/CountPage'` y agregar `<Route path="conteo" element={<CountPage />} />` junto a `filamentos` (sin `OperatorAdminOnly`).
- `AdminLayout.tsx`: en `SECONDARY`, después de "Calculadora", agregar `{ to: '/admin/conteo', label: 'Conteo', icon: 'list' }`.
- `FilamentsPage.tsx`: importar `CountReminder` y renderizarlo justo debajo del `<header className="fl-head">` (antes del bloque de error), con `reloadKey={changes}`.

- [ ] **Step 4: Correr todo**

Run: `npm test` → todo en verde; `npm run typecheck`; `npm run lint` (0 errores); `npm run build` (OK).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin src/features/filaments/FilamentsPage.tsx src/features/filaments/FilamentsPage.test.tsx
git commit -m "feat(conteo): ruta, menú y aviso en Filamentos"
```

---

## Self-Review

- **Spec (Entrega 3):** tablas `stock_counts`/`stock_count_items` → Task 1; pantalla Conteo para todos sin mostrar stock del sistema, esperado guardado al cerrar → Tasks 1 y 4; revisión solo admin con diferencias, quién contó y cuándo; aprobar genera ajustes `kind = 'count'` solo en filas con diferencia → Tasks 1 y 4; aviso "hace N días" si pasan más de 7 → Tasks 2, 4 y 5; menú con la ruta → Task 5.
- **Sin placeholders:** el SQL, la lógica pura, la capa de datos y los tests están completos; la UI está especificada por comportamiento más tests concretos (los componentes siguen el patrón de `SalesPanel`/`StatsPage`).
- **Consistencia de tipos:** `countKey`/`draftToItems` usan `"<id>:s|r"`; `submitStockCount` recibe el mismo `{ color_id, refill, counted }` que `draftToItems` produce; `countReminder` usa `Pick<StockCountRow,'created_at'|'status'>`, igual que `listCountStatus`.

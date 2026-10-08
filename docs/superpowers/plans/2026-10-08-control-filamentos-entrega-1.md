# Control de filamentos — Entrega 1: Movimientos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda salida de filamento quede registrada con motivo (venta, a producción, a la otra sede, uso personal, ajuste), quién y cuándo; ventas a precio de lista con forma de cobro, anulables solo por el admin; y que el stock no se pueda tocar sin dejar registro.

**Architecture:** La lógica que importa vive en Postgres: funciones `security definer` (`sell_filament`, `take_filament`, `adjust_filament`, `void_filament_sale`) que validan, mueven stock vía `move_filament` y escriben `filament_sales`/`filament_log` en una transacción. El cliente pierde el permiso de escribir `stock`/`stock_refill`. En React, el "−" de cada color abre una hoja "Sacar" (`TakeSheet`) con validación pura en `take.ts`; las acciones de admin se ocultan por `isAdmin`.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + Testing Library, Supabase (Postgres, PostgREST RPC), conector MCP de Supabase.

**Spec:** `docs/superpowers/specs/2026-10-08-control-filamentos-design.md` (sección "Entrega 1").

## Global Constraints

- Proyecto Supabase: `bukjmleercxlxbexekos`. Es la base **real** del taller; no hay proyecto de pruebas (`.env.integration` no existe).
- Las migraciones se prueban primero en seco: el SQL completo + asserts dentro de un `DO` que termina con `raise exception 'DRYRUN_OK'`, así todo se revierte. Solo si el error devuelto es exactamente `DRYRUN_OK` se aplica de verdad, y **aplicar pide confirmación del dueño en el chat**.
- Funciones nuevas: `language plpgsql`, `security definer`, `set search_path = ''`, nombres calificados `public.`; `revoke execute ... from public, anon` y `grant execute ... to authenticated`.
- Mensajes de error de las funciones: en español rioplatense, pensados para mostrarse tal cual en la UI.
- Copy de la UI: español rioplatense. Formas de cobro: "Efectivo" y "Transferencia MP".
- No commitear: `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `*.xlsx`.
- Comentarios en el código: en inglés, breves, como el código que rodea (los de SQL en español, como las migraciones existentes).
- Si algo falla varias veces seguidas: parar y preguntar.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261008120000_filament_sales.sql` (crear) | Tipos de movimiento, `filament_sales`, bloqueo de columnas de stock, funciones RPC |
| `src/lib/database.types.ts` (regenerar) | Tipos de la DB |
| `src/features/filaments/filaments.ts` (modificar) | `MovementKind`, `LOG_TEXT`, tipo `FilamentSale` |
| `src/features/filaments/take.ts` (crear) | Motivos, validación y texto del toast de una salida (puro) |
| `src/features/filaments/take.test.ts` (crear) | Tests de `take.ts` |
| `src/features/filaments/filaments.api.ts` (modificar) | `sellFilament`, `takeFilament`, `adjustFilament`, `voidFilamentSale`, `listFilamentSales` |
| `src/features/filaments/filaments.api.test.ts` (crear) | Que cada función llame a la RPC correcta |
| `src/features/filaments/TakeSheet.tsx` (crear) | Hoja "Sacar"/"Sumar" de un color |
| `src/features/filaments/TakeSheet.test.tsx` (crear) | Tests de la hoja |
| `src/features/filaments/FilamentsPage.tsx` (modificar) | Abre la hoja; oculta acciones de admin |
| `src/features/filaments/FilamentsPage.test.tsx` (modificar) | Tests de operador vs admin |
| `src/features/filaments/LineDrawer.tsx` (modificar) | Ajustes con nota fija vía `adjustFilament` |
| `src/features/filaments/SalesPanel.tsx` (crear) | Ventas recientes + anular (admin, dentro de Actividad) |
| `src/features/filaments/SalesPanel.test.tsx` (crear) | Tests del panel |
| `src/features/filaments/ActivityView.tsx` (modificar) | Monta `SalesPanel` arriba del registro |
| `src/features/orders/DeliveredOrdersList.tsx` (modificar) | Oculta montos para operadores |
| `src/features/orders/DeliveredOrdersList.test.tsx` (crear) | Test operador sin montos |

---

### Task 1: Migración — ventas, motivos y stock blindado

**Files:**
- Create: `supabase/migrations/20261008120000_filament_sales.sql`
- Regenerate: `src/lib/database.types.ts`

**Interfaces:**
- Produces (RPC, todas devuelven la fila indicada):
  - `sell_filament(p_color uuid, p_refill boolean, p_qty integer, p_payment text, p_operator uuid, p_customer text default null) → filament_sales`
  - `take_filament(p_color uuid, p_refill boolean, p_qty integer, p_kind text, p_operator uuid, p_note text default null) → filament_colors` (`p_kind` ∈ `used`,`transfer`,`personal`)
  - `adjust_filament(p_color uuid, p_refill boolean, p_delta integer, p_operator uuid, p_note text) → filament_colors`
  - `void_filament_sale(p_sale uuid, p_operator uuid, p_reason text) → filament_sales`
  - Tabla `filament_sales` (columnas en el SQL de abajo), `select` para `authenticated`, sin insert/update/delete por API.

- [ ] **Step 1: Escribir la migración**

```sql
-- Control de filamentos (entrega 1): cada salida del estante lleva motivo
-- (venta, a producción, a la otra sede, uso personal, ajuste), las ventas
-- guardan precio de lista y forma de cobro, y el stock deja de poder
-- escribirse directo: solo cambia por funciones que dejan registro.

-- ---------------------------------------------------------------------------
-- Motivos
-- ---------------------------------------------------------------------------
alter table public.filament_movements drop constraint filament_movements_kind_check;
alter table public.filament_movements add constraint filament_movements_kind_check
  check (kind in ('purchase', 'used', 'sale', 'transfer', 'personal',
                  'adjust', 'sale_void', 'count'));

alter table public.filament_log drop constraint filament_log_kind_check;
alter table public.filament_log add constraint filament_log_kind_check
  check (kind in ('purchase', 'used', 'sale', 'transfer', 'personal',
                  'adjust', 'sale_void', 'count',
                  'color_added', 'color_removed', 'line_added', 'line_removed'));

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------
create table public.filament_sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operator_id uuid references public.operators (id) on delete set null,
  color_id uuid references public.filament_colors (id) on delete set null,
  -- Nombres como texto, igual que filament_log: se leen aunque se borre el color.
  line_label text not null,
  color_label text not null,
  refill boolean not null default false,
  quantity integer not null check (quantity > 0),
  -- Precio de lista al momento de vender; lo pone la base, no el cliente.
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total numeric(12, 2) generated always as (quantity * unit_price) stored,
  payment text not null check (payment in ('cash', 'transfer')),
  customer text,
  voided_at timestamptz,
  voided_by uuid references public.operators (id) on delete set null,
  void_reason text,
  check ((voided_at is null) = (void_reason is null))
);
create index filament_sales_created_at_idx on public.filament_sales (created_at desc);

alter table public.filament_sales enable row level security;
create policy filament_sales_read
  on public.filament_sales for select to authenticated using (true);
-- Sin insert/update/delete por API: se vende y se anula solo por RPC.
revoke all on public.filament_sales from anon, authenticated;
grant select on public.filament_sales to authenticated;

-- ---------------------------------------------------------------------------
-- Stock blindado: la app puede crear y editar colores, pero no escribir el stock.
-- ---------------------------------------------------------------------------
revoke insert, update on public.filament_colors from anon, authenticated;
-- El alta todavía manda stock/stock_refill; el trigger de abajo los fuerza.
grant insert (line_id, name, swatch, finish, price, stock, stock_refill,
              spool_available, min_stock, position)
  on public.filament_colors to authenticated;
grant update (line_id, name, swatch, finish, price, spool_available,
              min_stock, position)
  on public.filament_colors to authenticated;

create or replace function public.filament_colors_start_empty()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un color nuevo arranca vacío; el stock entra con una compra o un ajuste.
  new.stock := 0;
  if new.stock_refill is not null then
    new.stock_refill := 0;
  end if;
  return new;
end;
$$;

create trigger trg_filament_colors_start_empty
  before insert on public.filament_colors
  for each row execute function public.filament_colors_start_empty();

-- move_filament escribe el stock, que la app ya no puede: corre como dueño.
alter function public.move_filament(uuid, boolean, integer, text, uuid, text)
  security definer;

-- ---------------------------------------------------------------------------
-- Sacar del estante (a producción, a la otra sede, uso personal)
-- ---------------------------------------------------------------------------
create or replace function public.take_filament(
  p_color uuid,
  p_refill boolean,
  p_qty integer,
  p_kind text,
  p_operator uuid,
  p_note text default null
)
returns public.filament_colors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_have integer;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'La cantidad tiene que ser 1 o más';
  end if;
  if p_kind is null or p_kind not in ('used', 'transfer', 'personal') then
    raise exception 'Motivo de salida inválido';
  end if;
  if p_kind = 'personal' and coalesce(trim(p_note), '') = '' then
    raise exception 'Escribí el motivo';
  end if;

  select case when p_refill then coalesce(stock_refill, 0) else stock end
    into v_have
    from public.filament_colors where id = p_color for update;
  if not found then
    raise exception 'No se encontró el color';
  end if;
  if v_have < p_qty then
    raise exception 'No hay stock suficiente (quedan %)', v_have;
  end if;

  return public.move_filament(p_color, p_refill, -p_qty, p_kind, p_operator,
                              nullif(trim(p_note), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste (solo admin desde la app): motivo obligatorio, nunca bajo cero
-- ---------------------------------------------------------------------------
create or replace function public.adjust_filament(
  p_color uuid,
  p_refill boolean,
  p_delta integer,
  p_operator uuid,
  p_note text
)
returns public.filament_colors
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_have integer;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'El ajuste no puede ser cero';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Escribí el motivo';
  end if;

  select case when p_refill then coalesce(stock_refill, 0) else stock end
    into v_have
    from public.filament_colors where id = p_color for update;
  if not found then
    raise exception 'No se encontró el color';
  end if;
  if v_have + p_delta < 0 then
    raise exception 'No hay stock suficiente (quedan %)', v_have;
  end if;

  return public.move_filament(p_color, p_refill, p_delta, 'adjust', p_operator,
                              trim(p_note));
end;
$$;

-- ---------------------------------------------------------------------------
-- Venta: precio de lista, forma de cobro, stock y registro en un solo paso
-- ---------------------------------------------------------------------------
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
    p_qty || ' × $' || v_price || ' · '
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

-- ---------------------------------------------------------------------------
-- Anular una venta: solo admin, con motivo; devuelve el stock
-- ---------------------------------------------------------------------------
create or replace function public.void_filament_sale(
  p_sale uuid,
  p_operator uuid,
  p_reason text
)
returns public.filament_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.filament_sales;
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede anular ventas';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribí el motivo de la anulación';
  end if;

  select * into v_sale from public.filament_sales where id = p_sale for update;
  if not found then
    raise exception 'No se encontró la venta';
  end if;
  if v_sale.voided_at is not null then
    raise exception 'La venta ya está anulada';
  end if;

  update public.filament_sales
    set voided_at = now(), voided_by = p_operator, void_reason = trim(p_reason)
    where id = p_sale
    returning * into v_sale;

  if v_sale.color_id is not null then
    perform public.move_filament(v_sale.color_id, v_sale.refill, v_sale.quantity,
                                 'sale_void', p_operator,
                                 'Anulación: ' || trim(p_reason));
  end if;

  return v_sale;
end;
$$;

revoke execute on function public.take_filament(uuid, boolean, integer, text, uuid, text) from public, anon;
revoke execute on function public.adjust_filament(uuid, boolean, integer, uuid, text) from public, anon;
revoke execute on function public.sell_filament(uuid, boolean, integer, text, uuid, text) from public, anon;
revoke execute on function public.void_filament_sale(uuid, uuid, text) from public, anon;
grant execute on function public.take_filament(uuid, boolean, integer, text, uuid, text) to authenticated;
grant execute on function public.adjust_filament(uuid, boolean, integer, uuid, text) to authenticated;
grant execute on function public.sell_filament(uuid, boolean, integer, text, uuid, text) to authenticated;
grant execute on function public.void_filament_sale(uuid, uuid, text) to authenticated;
```

- [ ] **Step 2: Prueba en seco (todo se revierte)**

Con `execute_sql` (proyecto `bukjmleercxlxbexekos`), mandar en **una sola** llamada el contenido completo de la migración seguido de este bloque. Usa datos propios con prefijo `dryrun`; nada persiste porque el bloque termina en excepción.

```sql
do $$
declare
  v_admin uuid; v_op uuid; v_line uuid; v_color uuid;
  v_sale public.filament_sales; v_c public.filament_colors;
  v_msg text;
begin
  insert into public.operators (name, initials, role, pin_hash)
    values ('dryrun admin', 'DA', 'admin', 'x') returning id into v_admin;
  insert into public.operators (name, initials, role, pin_hash)
    values ('dryrun op', 'DO', 'operator', 'x') returning id into v_op;
  insert into public.filament_lines (brand, name, price)
    values ('dryrun', 'PLA', 1000) returning id into v_line;
  insert into public.filament_colors (line_id, name, stock)
    values (v_line, 'Rojo', 99) returning id into v_color;

  -- Un color nuevo arranca en 0 aunque se mande stock.
  select * into v_c from public.filament_colors where id = v_color;
  assert v_c.stock = 0, 'alta: stock debería ser 0';

  perform public.move_filament(v_color, false, 3, 'purchase', v_admin, null);

  -- Venta: precio de lista, descuenta, guarda total.
  v_sale := public.sell_filament(v_color, false, 2, 'cash', v_op, ' Juan ');
  assert v_sale.unit_price = 1000 and v_sale.total = 2000, 'venta: precio/total';
  assert v_sale.customer = 'Juan', 'venta: cliente recortado';
  select * into v_c from public.filament_colors where id = v_color;
  assert v_c.stock = 1, 'venta: stock 3-2=1';
  assert exists (select 1 from public.filament_log
                 where kind = 'sale' and line_label = 'dryrun PLA' and delta = -2),
    'venta: falta el registro';

  -- Venta sin stock: falla y no deja fila.
  begin
    perform public.sell_filament(v_color, false, 5, 'cash', v_op, null);
    assert false, 'venta sin stock debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg like 'No hay stock suficiente%', 'venta sin stock: ' || v_msg;
  end;
  assert (select count(*) from public.filament_sales where line_label = 'dryrun PLA') = 1,
    'venta fallida dejó fila';

  -- Anular: operador no puede, admin sí y devuelve stock; no dos veces.
  begin
    perform public.void_filament_sale(v_sale.id, v_op, 'error');
    assert false, 'anular como operador debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Solo un administrador puede anular ventas', 'anular op: ' || v_msg;
  end;
  v_sale := public.void_filament_sale(v_sale.id, v_admin, 'cargada de más');
  assert v_sale.voided_at is not null, 'anulación: falta voided_at';
  select * into v_c from public.filament_colors where id = v_color;
  assert v_c.stock = 3, 'anulación: devuelve stock';
  begin
    perform public.void_filament_sale(v_sale.id, v_admin, 'otra vez');
    assert false, 'doble anulación debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'La venta ya está anulada', 'doble anulación: ' || v_msg;
  end;

  -- Salidas.
  v_c := public.take_filament(v_color, false, 1, 'transfer', v_op, null);
  assert v_c.stock = 2, 'a la otra sede: 3-1';
  begin
    perform public.take_filament(v_color, false, 1, 'personal', v_op, '  ');
    assert false, 'personal sin nota debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Escribí el motivo', 'personal sin nota: ' || v_msg;
  end;
  begin
    perform public.take_filament(v_color, false, 9, 'used', v_op, null);
    assert false, 'salida sin stock debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg like 'No hay stock suficiente%', 'salida sin stock: ' || v_msg;
  end;

  -- Ajuste.
  v_c := public.adjust_filament(v_color, false, -2, v_admin, 'rollo fallado');
  assert v_c.stock = 0, 'ajuste: 2-2';
  begin
    perform public.adjust_filament(v_color, false, 1, v_admin, '');
    assert false, 'ajuste sin motivo debió fallar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    assert v_msg = 'Escribí el motivo', 'ajuste sin motivo: ' || v_msg;
  end;

  -- Permisos: authenticated no puede escribir stock directo.
  assert not has_column_privilege('authenticated', 'public.filament_colors', 'stock', 'UPDATE'),
    'authenticated todavía puede escribir stock';
  assert has_column_privilege('authenticated', 'public.filament_colors', 'price', 'UPDATE'),
    'authenticated perdió update de price';
  assert not has_table_privilege('authenticated', 'public.filament_sales', 'INSERT'),
    'authenticated puede insertar ventas directo';

  raise exception 'DRYRUN_OK';
end;
$$;
```

Expected: error con mensaje exactamente `DRYRUN_OK`. Cualquier otro mensaje = falla: corregir la migración y repetir (si falla 2 veces seguidas, parar y preguntar).

- [ ] **Step 3: Confirmar y aplicar**

Pedir confirmación al dueño en el chat ("La prueba en seco pasó. ¿Aplico la migración en la base real?"). Con un sí, aplicar con `apply_migration` (nombre `filament_sales`, contenido = el archivo, sin el bloque de prueba). Verificar:

```sql
select proname from pg_proc
where proname in ('sell_filament','take_filament','adjust_filament','void_filament_sale')
order by 1;
```
Expected: 4 filas.

- [ ] **Step 4: Regenerar tipos**

Run: `npm run gen:types` (lee la conexión de `DATABASE_URL`/`SUPABASE_DB_URL`; si no está, armarla en el entorno del comando a partir de `SUPABASE_DB_PASSWORD` de `.env` sin imprimirla). Si no se puede, usar `generate_typescript_types` del MCP y copiar solo los bloques nuevos (`filament_sales` y las 4 funciones) en `src/lib/database.types.ts`, luego `npx prettier --write src/lib/database.types.ts`.
Expected: `git diff --stat src/lib/database.types.ts` muestra `filament_sales` y las 4 funciones.

- [ ] **Step 5: Typecheck y commit**

Run: `npm run typecheck` → Expected: sin errores.

```bash
git add supabase/migrations/20261008120000_filament_sales.sql src/lib/database.types.ts
git commit -m "feat(filamentos): ventas, motivos de salida y stock blindado en la base"
```

---

### Task 2: Dominio — motivos y validación de una salida

**Files:**
- Modify: `src/features/filaments/filaments.ts` (tipos al inicio, `LOG_TEXT` ~línea 358)
- Create: `src/features/filaments/take.ts`
- Test: `src/features/filaments/take.test.ts`

**Interfaces:**
- Produces:
  - `filaments.ts`: `MovementKind = 'purchase' | 'used' | 'sale' | 'transfer' | 'personal' | 'adjust' | 'sale_void' | 'count'`; `type FilamentSale = Tables['filament_sales']['Row']`; `LOG_TEXT` con todas las claves.
  - `take.ts`: `TakeReason`, `Payment`, `TakeDraft`, `TAKE_REASONS`, `PAYMENT_LABEL`, `emptyTake(reason)`, `takeError(draft, available, price)`, `takeToast(draft, colorLabel, price)`.

- [ ] **Step 1: Test que falla**

```ts
// src/features/filaments/take.test.ts
import { describe, expect, it } from 'vitest'
import { emptyTake, takeError, takeToast, type TakeDraft } from './take'

const d = (over: Partial<TakeDraft>): TakeDraft => ({ ...emptyTake('sale'), ...over })

describe('takeError', () => {
  it('pide cantidad válida', () => {
    expect(takeError(d({ qty: 0, payment: 'cash' }), 3, 1000)).toBe(
      'La cantidad tiene que ser 1 o más.',
    )
  })
  it('no deja sacar más de lo que hay', () => {
    expect(takeError(d({ qty: 4, payment: 'cash' }), 3, 1000)).toBe('Solo quedan 3.')
    expect(takeError(d({ qty: 1, payment: 'cash' }), 0, 1000)).toBe(
      'No hay stock de este color.',
    )
  })
  it('venta: exige precio de lista y forma de cobro', () => {
    expect(takeError(d({ payment: 'cash' }), 3, null)).toMatch(/precio de lista/)
    expect(takeError(d({ payment: null }), 3, 1000)).toBe('Elegí cómo te pagaron.')
    expect(takeError(d({ payment: 'transfer' }), 3, 1000)).toBeNull()
  })
  it('uso personal y ajuste exigen motivo', () => {
    expect(takeError({ ...emptyTake('personal'), note: ' ' }, 3, null)).toBe(
      'Escribí el motivo.',
    )
    expect(takeError({ ...emptyTake('adjust'), note: 'rollo fallado' }, 3, null)).toBeNull()
  })
  it('a producción no pide nada más', () => {
    expect(takeError(emptyTake('used'), 1, null)).toBeNull()
  })
  it('sumar (available = Infinity) no se limita por stock', () => {
    expect(takeError({ ...emptyTake('adjust'), qty: 50, note: 'conteo' }, Infinity, null)).toBeNull()
  })
})

describe('takeToast', () => {
  it('venta muestra total y forma de cobro', () => {
    expect(takeToast(d({ qty: 2, payment: 'cash' }), 'Rojo · 3N3 PLA', 12000)).toBe(
      'Venta · 2 × Rojo · 3N3 PLA · $24.000 efectivo',
    )
  })
  it('otras salidas muestran el motivo', () => {
    expect(takeToast(emptyTake('transfer'), 'Rojo · 3N3 PLA', null)).toBe(
      'A la otra sede · 1 × Rojo · 3N3 PLA',
    )
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/filaments/take.test.ts`
Expected: FAIL (`Cannot find module './take'`).

- [ ] **Step 3: Implementar**

En `filaments.ts`, reemplazar la línea de `MovementKind` y agregar el tipo de venta debajo de `FilamentLogRow`:

```ts
export type MovementKind =
  | 'purchase'
  | 'used'
  | 'sale'
  | 'transfer'
  | 'personal'
  | 'adjust'
  | 'sale_void'
  | 'count'
```

```ts
export type FilamentSale = Tables['filament_sales']['Row']
```

Y `LOG_TEXT`:

```ts
export const LOG_TEXT: Record<LogKind, string> = {
  purchase: 'Compra',
  used: 'A producción',
  sale: 'Venta',
  transfer: 'A la otra sede',
  personal: 'Uso personal',
  adjust: 'Ajuste de stock',
  sale_void: 'Venta anulada',
  count: 'Ajuste por conteo',
  color_added: 'Color agregado',
  color_removed: 'Color borrado',
  line_added: 'Línea nueva',
  line_removed: 'Línea borrada',
}
```

Crear `take.ts`:

```ts
import { money } from './filaments'

// Why a spool leaves (or, for an admin adjust, enters) the shelf.
export type TakeReason = 'sale' | 'used' | 'transfer' | 'personal' | 'adjust'
export type Payment = 'cash' | 'transfer'

export const TAKE_REASONS: {
  value: TakeReason
  label: string
  adminOnly?: boolean
}[] = [
  { value: 'sale', label: 'Venta' },
  { value: 'used', label: 'A producción' },
  { value: 'transfer', label: 'A la otra sede' },
  { value: 'personal', label: 'Uso personal' },
  { value: 'adjust', label: 'Ajuste', adminOnly: true },
]

export const PAYMENT_LABEL: Record<Payment, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia MP',
}

export interface TakeDraft {
  reason: TakeReason
  qty: number
  payment: Payment | null
  customer: string
  note: string
}

export function emptyTake(reason: TakeReason): TakeDraft {
  return { reason, qty: 1, payment: null, customer: '', note: '' }
}

// `available` is Infinity when adding stock; `price` is the list price.
export function takeError(
  d: TakeDraft,
  available: number,
  price: number | null,
): string | null {
  if (!Number.isInteger(d.qty) || d.qty < 1)
    return 'La cantidad tiene que ser 1 o más.'
  if (d.qty > available)
    return available === 0
      ? 'No hay stock de este color.'
      : `Solo quedan ${available}.`
  if (d.reason === 'sale') {
    if (price == null)
      return 'Este filamento no tiene precio de lista. Pedile al admin que lo cargue.'
    if (!d.payment) return 'Elegí cómo te pagaron.'
  }
  if ((d.reason === 'personal' || d.reason === 'adjust') && d.note.trim() === '')
    return 'Escribí el motivo.'
  return null
}

const LABEL = Object.fromEntries(TAKE_REASONS.map((r) => [r.value, r.label]))

export function takeToast(
  d: TakeDraft,
  colorLabel: string,
  price: number | null,
): string {
  const base = `${LABEL[d.reason]} · ${d.qty} × ${colorLabel}`
  if (d.reason !== 'sale' || price == null || !d.payment) return base
  const how = d.payment === 'cash' ? 'efectivo' : 'transferencia MP'
  return `${base} · ${money(price * d.qty)} ${how}`
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments`
Expected: PASS. Si un test existente esperaba el texto viejo "Se terminó en el taller", actualizarlo a "A producción".

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments/filaments.ts src/features/filaments/take.ts src/features/filaments/take.test.ts src/features/filaments/*.test.ts*
git commit -m "feat(filamentos): motivos de salida y validación de la hoja Sacar"
```

---

### Task 3: API — llamadas a las RPC

**Files:**
- Modify: `src/features/filaments/filaments.api.ts` (después de `moveFilament`)
- Test: `src/features/filaments/filaments.api.test.ts`

**Interfaces:**
- Consumes: RPC de la Task 1; `FilamentSale`, `FilamentColor` de `filaments.ts`; `Payment` de `take.ts`.
- Produces:
  - `sellFilament(colorId: string, refill: boolean, qty: number, payment: Payment, operatorId: string | null, customer: string): Promise<FilamentSale>`
  - `takeFilament(colorId: string, refill: boolean, qty: number, kind: 'used' | 'transfer' | 'personal', operatorId: string | null, note: string): Promise<FilamentColor>`
  - `adjustFilament(colorId: string, refill: boolean, delta: number, operatorId: string | null, note: string): Promise<FilamentColor>`
  - `voidFilamentSale(saleId: string, operatorId: string | null, reason: string): Promise<FilamentSale>`
  - `listFilamentSales(limit?: number): Promise<FilamentSale[]>`
  - Los errores de Postgres se relanzan como `Error(message)` con el mensaje en español de la función.

- [ ] **Step 1: Test que falla**

```ts
// src/features/filaments/filaments.api.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from: vi.fn() } }))

import {
  adjustFilament,
  sellFilament,
  takeFilament,
  voidFilamentSale,
} from './filaments.api'

describe('filament RPCs', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { id: 'x' }, error: null })
  })

  it('sellFilament manda cantidad, cobro y cliente', async () => {
    await sellFilament('c1', false, 2, 'cash', 'op1', 'Juan')
    expect(rpc).toHaveBeenCalledWith('sell_filament', {
      p_color: 'c1',
      p_refill: false,
      p_qty: 2,
      p_payment: 'cash',
      p_operator: 'op1',
      p_customer: 'Juan',
    })
  })

  it('takeFilament manda el motivo y la nota', async () => {
    await takeFilament('c1', true, 1, 'personal', 'op1', 'para muestra')
    expect(rpc).toHaveBeenCalledWith('take_filament', {
      p_color: 'c1',
      p_refill: true,
      p_qty: 1,
      p_kind: 'personal',
      p_operator: 'op1',
      p_note: 'para muestra',
    })
  })

  it('adjustFilament y voidFilamentSale usan sus RPC', async () => {
    await adjustFilament('c1', false, -1, 'op1', 'rollo fallado')
    await voidFilamentSale('s1', 'op1', 'error')
    expect(rpc).toHaveBeenNthCalledWith(1, 'adjust_filament', {
      p_color: 'c1',
      p_refill: false,
      p_delta: -1,
      p_operator: 'op1',
      p_note: 'rollo fallado',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'void_filament_sale', {
      p_sale: 's1',
      p_operator: 'op1',
      p_reason: 'error',
    })
  })

  it('relanza el mensaje de la base', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'No hay stock suficiente (quedan 0)' },
    })
    await expect(sellFilament('c1', false, 1, 'cash', 'op1', '')).rejects.toThrow(
      'No hay stock suficiente (quedan 0)',
    )
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/filaments/filaments.api.test.ts`
Expected: FAIL (`sellFilament is not a function` / export inexistente).

- [ ] **Step 3: Implementar**

Agregar `FilamentSale` al import de tipos de `./filaments`, `import type { Payment } from './take'`, y debajo de `moveFilament`:

```ts
// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// A sale at list price: the database sets the price, takes the stock and
// writes the sale and the log in one step.
export async function sellFilament(
  colorId: string,
  refill: boolean,
  qty: number,
  payment: Payment,
  operatorId: string | null,
  customer: string,
): Promise<FilamentSale> {
  const { data, error } = await supabase.rpc('sell_filament', {
    p_color: colorId,
    p_refill: refill,
    p_qty: qty,
    p_payment: payment,
    p_operator: operatorId,
    p_customer: customer,
  })
  if (error) fail(error)
  return data as FilamentSale
}

// Spools leaving the shelf for a non-sale reason; fails if there aren't enough.
export async function takeFilament(
  colorId: string,
  refill: boolean,
  qty: number,
  kind: 'used' | 'transfer' | 'personal',
  operatorId: string | null,
  note: string,
): Promise<FilamentColor> {
  const { data, error } = await supabase.rpc('take_filament', {
    p_color: colorId,
    p_refill: refill,
    p_qty: qty,
    p_kind: kind,
    p_operator: operatorId,
    p_note: note,
  })
  if (error) fail(error)
  return data as FilamentColor
}

export async function adjustFilament(
  colorId: string,
  refill: boolean,
  delta: number,
  operatorId: string | null,
  note: string,
): Promise<FilamentColor> {
  const { data, error } = await supabase.rpc('adjust_filament', {
    p_color: colorId,
    p_refill: refill,
    p_delta: delta,
    p_operator: operatorId,
    p_note: note,
  })
  if (error) fail(error)
  return data as FilamentColor
}

// Admin only (checked in the database); puts the stock back.
export async function voidFilamentSale(
  saleId: string,
  operatorId: string | null,
  reason: string,
): Promise<FilamentSale> {
  const { data, error } = await supabase.rpc('void_filament_sale', {
    p_sale: saleId,
    p_operator: operatorId,
    p_reason: reason,
  })
  if (error) fail(error)
  return data as FilamentSale
}

export async function listFilamentSales(limit = 50): Promise<FilamentSale[]> {
  const { data, error } = await supabase
    .from('filament_sales')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail(error)
  return data ?? []
}
```

Si los tipos generados declaran `p_operator`/`p_customer`/`p_note` como `string` (no nullable), pasar `operatorId ?? undefined` no sirve para uuid null: en ese caso castear el objeto de parámetros con `as never` igual que hace `moveFilament` si ya lo hace; si no, dejarlo como está y que `npm run typecheck` decida.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments/filaments.api.test.ts && npm run typecheck`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments/filaments.api.ts src/features/filaments/filaments.api.test.ts
git commit -m "feat(filamentos): API de venta, salida, ajuste y anulación"
```

---

### Task 4: Hoja "Sacar" / "Sumar"

**Files:**
- Create: `src/features/filaments/TakeSheet.tsx`
- Test: `src/features/filaments/TakeSheet.test.tsx`
- Modify: `src/features/filaments/filaments.css` (al final)

**Interfaces:**
- Consumes: `take.ts` (Task 2), `sellFilament`/`takeFilament`/`adjustFilament` (Task 3), `colorPrice`, `money`, `FilamentLine`, `FilamentColor` de `filaments.ts`, `useOperator` (`current`, `isAdmin`).
- Produces: `export default function TakeSheet(props: { line: FilamentLine; color: FilamentColor; refill: boolean; direction: 'out' | 'in'; onClose: () => void; onDone: (message: string) => void })`.
  - `direction: 'out'`: motivos de `TAKE_REASONS` (sin `adjust` si no es admin).
  - `direction: 'in'`: solo admin; motivo fijo "Ajuste" (suma).

- [ ] **Step 1: Test que falla**

```tsx
// src/features/filaments/TakeSheet.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TakeSheet from './TakeSheet'
import { designLines } from './fixtures'

const api = vi.hoisted(() => ({
  sellFilament: vi.fn(),
  takeFilament: vi.fn(),
  adjustFilament: vi.fn(),
}))
vi.mock('./filaments.api', () => api)

const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: operator.isAdmin }),
}))

function setup(direction: 'out' | 'in' = 'out') {
  const line = designLines().find((l) => l.presentation !== 'both' && l.price != null)!
  const color = { ...line.colors[0], stock: 3, price: null }
  const onDone = vi.fn()
  render(
    <TakeSheet
      line={line}
      color={color}
      refill={false}
      direction={direction}
      onClose={vi.fn()}
      onDone={onDone}
    />,
  )
  return { line, color, onDone }
}

describe('TakeSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    operator.isAdmin = false
    api.sellFilament.mockResolvedValue({})
    api.takeFilament.mockResolvedValue({})
  })

  it('venta: exige forma de cobro y vende al precio de lista', async () => {
    const { color, onDone } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí cómo te pagaron.')
    expect(api.sellFilament).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.sellFilament).toHaveBeenCalledWith(color.id, false, 1, 'cash', 'op-1', ''),
    )
    expect(onDone).toHaveBeenCalledWith(expect.stringMatching(/^Venta · 1 ×/))
  })

  it('el precio no se puede editar', () => {
    setup()
    expect(screen.queryByLabelText(/precio/i)).toBeNull()
  })

  it('a la otra sede usa takeFilament', async () => {
    const { color } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'A la otra sede' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.takeFilament).toHaveBeenCalledWith(color.id, false, 1, 'transfer', 'op-1', ''),
    )
  })

  it('un operador no ve "Ajuste"', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Ajuste' })).toBeNull()
  })

  it('no deja sacar más que el stock', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Solo quedan 3.')
  })

  it('admin suma con ajuste y motivo', async () => {
    operator.isAdmin = true
    api.adjustFilament.mockResolvedValue({})
    const { color } = setup('in')
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'conteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.adjustFilament).toHaveBeenCalledWith(color.id, false, 1, 'op-1', 'conteo'),
    )
  })

  it('muestra el error de la base', async () => {
    api.sellFilament.mockRejectedValue(new Error('No hay stock suficiente (quedan 0)'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia MP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay stock suficiente')
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/filaments/TakeSheet.test.tsx`
Expected: FAIL (`Cannot find module './TakeSheet'`).

- [ ] **Step 3: Implementar**

```tsx
// src/features/filaments/TakeSheet.tsx
import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import {
  colorPrice,
  money,
  type FilamentColor,
  type FilamentLine,
} from './filaments'
import { adjustFilament, sellFilament, takeFilament } from './filaments.api'
import {
  emptyTake,
  PAYMENT_LABEL,
  TAKE_REASONS,
  takeError,
  takeToast,
  type Payment,
  type TakeDraft,
} from './take'

// One color leaving the shelf (or, for an admin, an upward adjust): why, how
// many, and for a sale how it was paid. The price comes from the list.
export default function TakeSheet({
  line,
  color,
  refill,
  direction,
  onClose,
  onDone,
}: {
  line: FilamentLine
  color: FilamentColor
  refill: boolean
  direction: 'out' | 'in'
  onClose: () => void
  onDone: (message: string) => void
}) {
  const { current, isAdmin } = useOperator()
  const adding = direction === 'in'
  const [draft, setDraft] = useState<TakeDraft>(
    emptyTake(adding ? 'adjust' : 'sale'),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const price = colorPrice(line, color, refill)
  const stock = refill ? (color.stock_refill ?? 0) : color.stock
  const available = adding ? Infinity : stock
  const label = `${color.name} · ${line.brand} ${line.name}${refill ? ' (recarga)' : ''}`
  const reasons = TAKE_REASONS.filter((r) => !r.adminOnly || isAdmin)
  const set = <K extends keyof TakeDraft>(k: K, v: TakeDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function confirm() {
    const problem = takeError(draft, available, price)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    const op = current?.id ?? null
    try {
      if (draft.reason === 'sale')
        await sellFilament(color.id, refill, draft.qty, draft.payment as Payment, op, draft.customer.trim())
      else if (draft.reason === 'adjust')
        await adjustFilament(color.id, refill, adding ? draft.qty : -draft.qty, op, draft.note.trim())
      else
        await takeFilament(color.id, refill, draft.qty, draft.reason, op, draft.note.trim())
      onDone(adding ? `Ajuste · +${draft.qty} × ${label}` : takeToast(draft, label, price))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  return (
    <div className="fl-modal" role="dialog" aria-modal="true" aria-label={adding ? 'Sumar' : 'Sacar'}>
      <button
        type="button"
        className="fl-modal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={() => !busy && onClose()}
      />
      <div className="fl-modal__panel">
        <header className="fl-drawer__head">
          <div>
            <p className="eyebrow">{adding ? 'Sumar al estante' : 'Sacar del estante'}</p>
            <h2>{label}</h2>
          </div>
          <button type="button" className="fl-icon fl-icon--lg" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="fl-drawer__body">
          {error && (
            <p className="fl-error" role="alert">
              {error}
            </p>
          )}
          {!adding && (
            <div className="fl-seg fl-take__reasons" role="group" aria-label="Motivo de salida">
              {reasons.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={draft.reason === r.value}
                  onClick={() => set('reason', r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <label className="fl-field">
            Cantidad
            <input
              className="fl-input fl-mono"
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.qty}
              onChange={(e) => set('qty', Number(e.target.value))}
            />
          </label>
          {!adding && <p className="fl-hint">Hay {stock} en el estante.</p>}

          {draft.reason === 'sale' && (
            <>
              <p className="fl-take__price">
                {price == null
                  ? 'Sin precio de lista'
                  : `${money(price)} c/u · Total ${money(price * (draft.qty || 0))}`}
              </p>
              <div className="fl-seg" role="group" aria-label="Forma de cobro">
                {(Object.keys(PAYMENT_LABEL) as Payment[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={draft.payment === p}
                    onClick={() => set('payment', p)}
                  >
                    {PAYMENT_LABEL[p]}
                  </button>
                ))}
              </div>
              <label className="fl-field">
                Cliente (opcional)
                <input
                  className="fl-input"
                  value={draft.customer}
                  onChange={(e) => set('customer', e.target.value)}
                />
              </label>
            </>
          )}

          {draft.reason !== 'sale' && (
            <label className="fl-field">
              {draft.reason === 'personal' || draft.reason === 'adjust' ? 'Motivo' : 'Nota (opcional)'}
              <input
                className="fl-input"
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </label>
          )}
        </div>
        <footer className="fl-drawer__foot">
          <button type="button" className="fl-btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="fl-btn fl-btn--primary" onClick={confirm} disabled={busy}>
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  )
}
```

Antes de escribir, abrir `PurchaseModal.tsx` y copiar los nombres de clase reales del pie (`fl-drawer__foot` u otro) y del scrim, para que la hoja se vea igual. Si difieren, usar los de `PurchaseModal`.

CSS al final de `filaments.css`:

```css
/* Sacar / Sumar */
.fl-take__reasons {
  flex-wrap: wrap;
}
.fl-take__price {
  font-weight: 600;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments/TakeSheet.test.tsx`
Expected: PASS. Si el fixture no tiene una línea no-`both` con precio, ajustar `setup()` para fijar `price: 12000` en la línea copiada.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments/TakeSheet.tsx src/features/filaments/TakeSheet.test.tsx src/features/filaments/filaments.css
git commit -m "feat(filamentos): hoja Sacar con venta, salidas y ajuste"
```

---

### Task 5: Pantalla Filamentos — hoja al restar y acciones de admin

**Files:**
- Modify: `src/features/filaments/FilamentsPage.tsx` (`move` ~líneas 80-123, header ~133-158, tab Actividad ~248-258, modales ~280-320)
- Modify: `src/features/filaments/LineCard.tsx` (prop `canAdd`)
- Modify: `src/features/filaments/parts.tsx` (`Stepper`: prop `canAdd`)
- Modify: `src/features/filaments/LineDrawer.tsx:212-215`
- Test: `src/features/filaments/FilamentsPage.test.tsx`

**Interfaces:**
- Consumes: `TakeSheet` (Task 4), `adjustFilament` (Task 3), `useOperator().isAdmin`.
- Produces: `Stepper` acepta `canAdd?: boolean` (default `true`); `LineCard` acepta `canAdd: boolean` y lo pasa a cada `Stepper`; `LineCard` oculta el botón "Editar" si `onEdit` es `undefined`.

- [ ] **Step 1: Tests que fallan**

En `FilamentsPage.test.tsx`, cambiar el mock de operador para que `isAdmin` sea controlable y agregar los casos:

```tsx
const operator = vi.hoisted(() => ({ isAdmin: true }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    isAdmin: operator.isAdmin,
    operators: [
      { id: 'op-1', name: 'nicolas' },
      { id: 'op-2', name: 'sabri' },
    ],
    byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }),
  }),
}))
```

Agregar al objeto `mocks`: `sellFilament: vi.fn(), takeFilament: vi.fn(), adjustFilament: vi.fn(), listFilamentSales: vi.fn()`; en `beforeEach`: `operator.isAdmin = true` y `mocks.listFilamentSales.mockResolvedValue([])`.

```tsx
describe('FilamentsPage como operador', () => {
  beforeEach(() => {
    operator.isAdmin = false
  })

  it('restar abre la hoja Sacar en vez de mover el stock', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /^Restar bobina de/ })[0])
    expect(screen.getByRole('dialog', { name: 'Sacar' })).toBeInTheDocument()
    expect(mocks.moveFilament).not.toHaveBeenCalled()
  })

  it('no ve sumar, compra, nueva línea, editar ni actividad', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: /^Sumar bobina de/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Registrar compra/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nueva línea/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull()
    expect(screen.queryByRole('button', { name: /Actividad/ })).toBeNull()
  })

  it('si tenía guardada la vista Actividad, vuelve a Por marca', async () => {
    localStorage.setItem('g3d.filaments.view', 'activity')
    await renderPage()
    expect(screen.queryByText(/Registro de control/)).toBeNull()
  })
})

describe('FilamentsPage como admin', () => {
  it('sumar abre la hoja Sumar', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /^Sumar bobina de/ })[0])
    expect(screen.getByRole('dialog', { name: 'Sumar' })).toBeInTheDocument()
  })
})
```

Antes de escribirlo, leer `readView()` en `FilamentsPage.tsx` y usar la clave de `localStorage` real en lugar de `'g3d.filaments.view'`. Borrar o adaptar cualquier test existente que esperaba que "−" llamara a `moveFilament` directo.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/filaments/FilamentsPage.test.tsx`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implementar**

`parts.tsx` — `Stepper`: agregar `canAdd = true` a props y tipo, y envolver el botón "+":

```tsx
      {canAdd && (
        <button
          type="button"
          aria-label={`Sumar bobina de ${label}`}
          disabled={disabled}
          onClick={() => onChange(1)}
        >
          +
        </button>
      )}
```

`LineCard.tsx`: props `canAdd: boolean` y `onEdit?: (line: FilamentLine) => void`; pasar `canAdd={canAdd}` a los 3 `<Stepper>`; renderizar el botón de editar solo `{onEdit && (...)}`.

`FilamentsPage.tsx`:

```tsx
  const { current, isAdmin } = useOperator()
  // ...
  const [taking, setTaking] = useState<{
    line: FilamentLine
    color: FilamentColor
    refill: boolean
    direction: 'out' | 'in'
  } | null>(null)
  // An operator never lands on the activity tab, even if it was saved.
  const shownView: View = view === 'activity' && !isAdmin ? 'brand' : view
```

Reemplazar todo el `move` por:

```tsx
  // − opens "Sacar" (why it leaves); + is an admin adjust. The stock only
  // changes through the database, which logs who and when.
  const move: MoveHandler = (line, color, delta, refill) => {
    if (delta > 0 && !isAdmin) return
    setTaking({ line, color, refill, direction: delta < 0 ? 'out' : 'in' })
  }
```

Usar `shownView` en lugar de `view` en todo el render. Envolver en `{isAdmin && (...)}`: botones "Nueva línea" y "Registrar compra", y el botón de la pestaña "Actividad". En `<LineCard>` pasar `canAdd={isAdmin}` y `onEdit={isAdmin ? (l) => setEditing(...) : undefined}`. Junto a los otros modales:

```tsx
      {taking && (
        <TakeSheet
          {...taking}
          onClose={() => setTaking(null)}
          onDone={(message) => {
            setTaking(null)
            setChanges((n) => n + 1)
            showToast(message)
            void reload()
          }}
        />
      )}
```

Si `ColorView` también tiene steppers, pasarle el mismo `canAdd`/`onMove`; si solo muestra, no tocarlo.

`LineDrawer.tsx:212-215` — cambiar el ajuste por:

```tsx
      const adjust = (id: string, d: number, refill: boolean) =>
        d === 0
          ? null
          : adjustFilament(id, refill, d, opId, 'Corrección desde editar línea')
```

y el import `moveFilament` → `adjustFilament` (si `moveFilament` no se usa más en el archivo).

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments && npm run typecheck`
Expected: PASS, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments
git commit -m "feat(filamentos): restar abre Sacar; compras, ajustes y actividad solo admin"
```

---

### Task 6: Ventas recientes y anulación (admin)

**Files:**
- Create: `src/features/filaments/SalesPanel.tsx`
- Test: `src/features/filaments/SalesPanel.test.tsx`
- Modify: `src/features/filaments/ActivityView.tsx` (render, arriba del `fl-hint`)
- Modify: `src/features/filaments/filaments.css`

**Interfaces:**
- Consumes: `listFilamentSales`, `voidFilamentSale` (Task 3); `FilamentSale`, `money`, `logStamp` de `filaments.ts`; `PAYMENT_LABEL` de `take.ts`; `useOperator` (`current`, `byId`).
- Produces: `export default function SalesPanel({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void })`.

- [ ] **Step 1: Test que falla**

```tsx
// src/features/filaments/SalesPanel.test.tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SalesPanel from './SalesPanel'

const api = vi.hoisted(() => ({
  listFilamentSales: vi.fn(),
  voidFilamentSale: vi.fn(),
}))
vi.mock('./filaments.api', () => api)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'admin-1' },
    byId: () => ({ name: 'sabri' }),
  }),
}))

const sale = {
  id: 's1',
  created_at: '2026-10-08T15:30:00Z',
  operator_id: 'op-2',
  color_id: 'c1',
  line_label: '3N3 PLA',
  color_label: 'Rojo',
  refill: false,
  quantity: 2,
  unit_price: 12000,
  total: 24000,
  payment: 'cash',
  customer: 'Juan',
  voided_at: null,
  voided_by: null,
  void_reason: null,
}

describe('SalesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFilamentSales.mockResolvedValue([sale])
    api.voidFilamentSale.mockResolvedValue({ ...sale, voided_at: 'x', void_reason: 'error' })
  })

  it('lista la venta con persona, total y forma de cobro', async () => {
    render(<SalesPanel reloadKey={0} onChanged={vi.fn()} />)
    expect(await screen.findByText(/Rojo · 3N3 PLA/)).toBeInTheDocument()
    expect(screen.getByText(/sabri/)).toBeInTheDocument()
    expect(screen.getByText(/\$24\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Efectivo/)).toBeInTheDocument()
  })

  it('anular pide motivo y llama a la base', async () => {
    const onChanged = vi.fn()
    render(<SalesPanel reloadKey={0} onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: /Anular venta/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribí el motivo')
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), {
      target: { value: 'cargada de más' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    })
    await waitFor(() =>
      expect(api.voidFilamentSale).toHaveBeenCalledWith('s1', 'admin-1', 'cargada de más'),
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('una venta anulada se ve tachada y sin botón', async () => {
    api.listFilamentSales.mockResolvedValue([
      { ...sale, voided_at: '2026-10-08T16:00:00Z', void_reason: 'error' },
    ])
    render(<SalesPanel reloadKey={0} onChanged={vi.fn()} />)
    expect(await screen.findByText(/Anulada: error/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anular venta/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/filaments/SalesPanel.test.tsx`
Expected: FAIL (`Cannot find module './SalesPanel'`).

- [ ] **Step 3: Implementar**

```tsx
// src/features/filaments/SalesPanel.tsx
import { useEffect, useState } from 'react'
import { useOperator } from '@/features/operators/operator-context'
import { logStamp, money, type FilamentSale } from './filaments'
import { listFilamentSales, voidFilamentSale } from './filaments.api'
import { PAYMENT_LABEL, type Payment } from './take'

// Latest filament sales for the admin: who sold what, for how much and how it
// was paid. A wrong sale is voided (with a reason), never erased.
export default function SalesPanel({
  reloadKey,
  onChanged,
}: {
  reloadKey: number
  onChanged: () => void
}) {
  const { current, byId } = useOperator()
  const [sales, setSales] = useState<FilamentSale[] | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listFilamentSales()
      .then((s) => alive && setSales(s))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.'))
    return () => {
      alive = false
    }
  }, [reloadKey])

  async function confirmVoid(id: string) {
    if (reason.trim() === '') return setError('Escribí el motivo de la anulación.')
    setBusy(true)
    setError(null)
    try {
      const updated = await voidFilamentSale(id, current?.id ?? null, reason.trim())
      setSales((prev) => prev?.map((s) => (s.id === id ? updated : s)) ?? null)
      setVoiding(null)
      setReason('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.')
    } finally {
      setBusy(false)
    }
  }

  if (sales == null) return error ? <p className="fl-error" role="alert">{error}</p> : null
  if (sales.length === 0) return null

  return (
    <section className="fl-sales" aria-label="Ventas de filamento">
      <h2 className="fl-sales__title">Ventas recientes</h2>
      {error && (
        <p className="fl-error" role="alert">
          {error}
        </p>
      )}
      <ul className="fl-sales__list">
        {sales.map((s) => (
          <li key={s.id} className={s.voided_at ? 'is-void' : undefined}>
            <span className="fl-sales__main">
              <strong>
                {s.quantity} × {s.color_label} · {s.line_label}
                {s.refill ? ' (recarga)' : ''}
              </strong>
              <span>
                {logStamp(s.created_at)} · {s.operator_id ? byId(s.operator_id)?.name : '—'}
                {s.customer ? ` · ${s.customer}` : ''}
              </span>
              {s.voided_at && <span>Anulada: {s.void_reason}</span>}
            </span>
            <span className="fl-sales__amount fl-mono">
              {money(s.total)} · {PAYMENT_LABEL[s.payment as Payment]}
            </span>
            {!s.voided_at &&
              (voiding === s.id ? (
                <span className="fl-sales__void">
                  <label className="fl-field">
                    Motivo de la anulación
                    <input
                      className="fl-input"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button type="button" className="fl-btn" disabled={busy} onClick={() => confirmVoid(s.id)}>
                    Confirmar anulación
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="fl-btn"
                  aria-label={`Anular venta de ${s.color_label}`}
                  onClick={() => {
                    setVoiding(s.id)
                    setReason('')
                    setError(null)
                  }}
                >
                  Anular
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

Antes de usar `logStamp`, verificar su firma en `filaments.ts` (recibe el ISO `created_at` y devuelve texto con día y hora); si su firma difiere, adaptar la llamada. Si `byId` devuelve otra forma, usar la misma que `ActivityView`.

En `ActivityView.tsx`, recibir `onChanged?: () => void` y renderizar arriba del `fl-hint`: `<SalesPanel reloadKey={reloadKey} onChanged={onChanged ?? (() => {})} />`. En `FilamentsPage`, pasar `onChanged={() => { setChanges((n) => n + 1); void reload() }}` a `ActivityView`.

CSS al final de `filaments.css`:

```css
/* Ventas recientes (Actividad, admin) */
.fl-sales {
  margin-bottom: 1.5rem;
}
.fl-sales__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}
.fl-sales__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.fl-sales__main {
  display: grid;
  flex: 1 1 16rem;
}
.fl-sales__list li.is-void .fl-sales__main strong,
.fl-sales__list li.is-void .fl-sales__amount {
  text-decoration: line-through;
  opacity: 0.6;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/filaments && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/filaments
git commit -m "feat(filamentos): ventas recientes y anulación para el admin"
```

---

### Task 7: Entregados sin montos para operadores

**Files:**
- Modify: `src/features/orders/DeliveredOrdersList.tsx` (`RowBody` ~línea 41, bloque `dstats` ~166-170, encabezado de mes ~209)
- Test: `src/features/orders/DeliveredOrdersList.test.tsx`

**Interfaces:**
- Consumes: `useOperator().isAdmin`.
- Produces: `RowBody` recibe `showAmount: boolean`.

- [ ] **Step 1: Test que falla**

```tsx
// src/features/orders/DeliveredOrdersList.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeliveredOrdersList from './DeliveredOrdersList'

const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: operator.isAdmin }),
}))
vi.mock('./orders.api', () => ({
  listDeliveredOrders: vi.fn().mockResolvedValue([
    {
      id: 'o1',
      due_date: '2026-10-07',
      total_amount: 55000,
      customer: { name: 'María' },
      product_type: 'Vaso',
    },
  ]),
}))
vi.mock('./productSales.api', () => ({
  listProductSales: vi.fn().mockResolvedValue([]),
  deleteProductSale: vi.fn(),
}))

function renderList() {
  return render(
    <MemoryRouter>
      <DeliveredOrdersList />
    </MemoryRouter>,
  )
}

describe('DeliveredOrdersList', () => {
  beforeEach(() => {
    operator.isAdmin = false
  })

  it('un operador ve el pedido pero no montos ni totales', async () => {
    renderList()
    expect(await screen.findByText(/María/)).toBeInTheDocument()
    expect(screen.queryByText(/\$55\.000/)).toBeNull()
    expect(screen.queryByText('Total vendido')).toBeNull()
  })

  it('el admin ve los montos', async () => {
    operator.isAdmin = true
    renderList()
    expect(await screen.findAllByText(/55\.000/)).not.toHaveLength(0)
    expect(screen.getByText('Total vendido')).toBeInTheDocument()
  })
})
```

Antes de escribirlo, mirar `toVentaRows` en `deliveredOrders.ts` y `deliveredOrders.test.ts` para armar el pedido fake con los campos que `RowBody` realmente lee (nombre del cliente, producto); ajustar el objeto del mock a esa forma. Si el componente usa otros hooks (p. ej. `useOrderModal`), mockearlos igual que en sus otros tests.

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/features/orders/DeliveredOrdersList.test.tsx`
Expected: FAIL en "un operador ve el pedido pero no montos".

- [ ] **Step 3: Implementar**

```tsx
import { useOperator } from '@/features/operators/operator-context'
// ...
function RowBody({ row, today, showAmount }: { row: VentaRow; today: string; showAmount: boolean }) {
  // ...
      {showAmount && (
        <span className="drow__amount num">{formatMoney(row.amount)}</span>
      )}
```

En el componente: `const { isAdmin } = useOperator()`; pasar `showAmount={isAdmin}` a cada `RowBody`; envolver la tarjeta `dstat--total` en `{isAdmin && (...)}` y el `<span className="num">{formatMoney(group.total)}</span>` del encabezado de mes en `{isAdmin && ...}`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run src/features/orders && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/orders/DeliveredOrdersList.tsx src/features/orders/DeliveredOrdersList.test.tsx
git commit -m "feat(entregados): los operadores no ven montos ni totales"
```

---

### Task 8: Verificación completa y PR

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todo en verde. Si `lint` marca formato, `npx prettier --write` sobre los archivos tocados y repetir.

- [ ] **Step 2: Prueba en el navegador**

Con el server `dev` levantado (`preview_start` name `dev`), el dueño inicia sesión y elige perfil (Claude no escribe PINs). Verificar con `read_page`/capturas:
1. Como admin: Filamentos muestra "+", "Registrar compra", "Nueva línea", "Actividad"; "Actividad" muestra "Ventas recientes".
2. Pedirle al dueño que cambie a un perfil de operador: no ve esos botones; "−" abre "Sacar"; Entregados sin montos.
3. **No hacer ventas reales de prueba en la base del taller** sin permiso del dueño. Si autoriza una, anularla después desde Actividad (queda en el registro como anulada; avisarle).

- [ ] **Step 3: Push y PR**

```bash
git push -u origin feature/ventas-filamento
gh pr create --base master --title "feat(filamentos): ventas, motivos de salida y control para el admin" --body "<resumen + cómo probar + 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```

Después: `mcp__ccd_pr__get_status`; no mergear sin que el dueño lo pida.

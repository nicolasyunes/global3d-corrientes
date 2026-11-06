# Libro de ventas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un libro único de ventas (`sales` + `sale_items` + `sale_log`) con carga tipo ticket, descuento, canal, quién vendió, corrección y anulación por admin con historial, y la venta de cada pedido registrada al entregarse.

**Architecture:** La base garantiza las reglas: funciones `security definer` (`create_sale`, `edit_sale`, `void_sale`, `record_order_sale`) mueven stock y escriben historial; RLS deja solo lectura directa. Un trigger en `orders` crea la venta al pasar a `delivered` (una por pedido, por `unique(order_id)`). El front tiene una feature nueva `src/features/sales/` (cálculo puro del ticket, API, helpers de lista, hoja de carga, detalle, página) y Estadísticas pasa a leer `sales`.

**Tech Stack:** Postgres/Supabase (plpgsql, RLS), React 19 + Vite + TypeScript, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-06-libro-de-ventas-design.md`

## Global Constraints

- Rama `feature/libro-ventas` (worktree `.claude/worktrees/libro-ventas`), creada desde `origin/master`.
- Textos de UI en español rioplatense. Comentarios de código siguen el estilo del repo (inglés corto).
- Prioridad del admin: carga rápida. Nueva venta se completa con teclado (buscar → Enter → Guardar).
- Montos siempre con `parseMoney` de `src/features/orders/orderDraft.ts` ("13.200" = 13200, "13.200,50" = 13200.5). Nunca `Number()` sobre texto del usuario.
- Canales: los valores de `ORIGIN_CHANNEL` (`src/lib/domain-constants.ts`). Medios: `PAYMENT_METHOD`. Mostrador = `'local'`.
- Corregir/anular: solo operador con `role = 'admin'`, chequeado en la base; anular exige motivo no vacío.
- Ventas de pedidos no mueven stock. Ventas de mostrador sí, vía funciones (`app.stock_kind` = `'sale'` al vender, `'in'` al devolver).
- Filamento (`filament_sales`) y cobros de pedidos (`transactions` `3d_service`) no se tocan.
- Tests: `node` por defecto es v16. Correr con Node 22 solo en el comando (PowerShell): `$env:PATH = "C:\Users\nyunes\AppData\Local\nvm\v22.22.3;" + $env:PATH; npx vitest run <ruta>`. El worktree necesita `node_modules` (junction a la raíz) y `.env` (copia de la raíz, ignorado por git).
- No commitear `.claude/launch.json`, `.atl/*`, `prompt-taller-3d.md`, `test-output.txt`, `.xlsx`, `.env`.
- **Producción:** aplicar la migración, correr SQL de verificación o hacer cualquier escritura en la base `bukjmleercxlxbexekos` requiere OK explícito del usuario en ese momento. Si algo falla dos veces seguidas, parar y preguntar.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261106150000_sales_ledger.sql` | Tablas, RLS, funciones, trigger de entrega, copia de datos |
| `supabase/checks/sales_ledger_checks.sql` | Verificación en transacción que siempre hace rollback |
| `src/lib/database.types.ts` | Tipos regenerados |
| `src/features/sales/ticket.ts` (+test) | Cálculo puro del ticket: líneas, descuento $/%, totales, payload |
| `src/features/sales/sales.api.ts` (+test) | RPCs y lecturas de `sales`, `sale_items`, `sale_log`; `setCustomerWholesale` |
| `src/features/sales/sales.ts` (+test) | Filtros, totales de lista, resumen de líneas, etiquetas de historial |
| `src/features/sales/NewSaleSheet.tsx` (+test) | Hoja de carga/corrección de un ticket |
| `src/features/sales/SaleDetail.tsx` (+test) | Detalle, historial, corregir/anular |
| `src/features/sales/SalesPage.tsx` (+test) | Lista con filtros y totales |
| `src/features/sales/sales.css` | Estilos de la feature |
| `src/features/admin/admin.route.tsx`, `AdminLayout.tsx` (+tests) | Ruta `/admin/ventas`, redirect, menú |
| `src/features/stats/stats.ts`, `stats.api.ts` (+tests) | Estadísticas leen `sales` |
| `src/features/orders/OrderProduction.tsx`, `OrdersBoard.tsx` | Aviso "Venta registrada" al entregar |
| Borrar: `DeliveredOrdersList.tsx`, `deliveredOrders.ts`, `ProductSaleSheet.tsx`, `useProductSaleDraft.ts`, `productSaleValidation.ts`, `productSales.api.ts` (+tests, +css) | Reemplazados |

---

### Task 0: Preparar el worktree e incorporar la búsqueda por palabras

**Files:** ninguno nuevo (merge de rama).

**Interfaces:**
- Produces: `matchesQuery(fields, query)` y `normalizeSearchText(text)` en `src/lib/search.ts` (de la rama `fix/productos-busqueda-precio`, commit `012a51e`).

- [ ] **Step 1: Junction de `node_modules` y `.env`** (PowerShell, desde el worktree)

```powershell
New-Item -ItemType Junction -Path node_modules -Target C:\Users\nyunes\Desktop\WEB-GLOBAL-3D\node_modules | Out-Null
Copy-Item ..\..\..\.env .env
git check-ignore .env   # tiene que imprimir .env
```

- [ ] **Step 2: Incorporar la búsqueda.** Si el PR de `fix/productos-busqueda-precio` ya está mergeado en `master`: `git merge origin/master`. Si no: `git merge --no-ff fix/productos-busqueda-precio -m "merge: búsqueda por palabras"`.

- [ ] **Step 3: Verificar que compila y los tests pasan**

Run: `npm run typecheck` y `npx vitest run src/lib/search.test.ts` (con Node 22)
Expected: PASS

---

### Task 1: Migración del libro de ventas

**Files:**
- Create: `supabase/migrations/20261106150000_sales_ledger.sql`

**Interfaces:**
- Produces (SQL):
  - `public.create_sale(p jsonb, p_operator uuid) returns uuid`
  - `public.edit_sale(p_sale uuid, p jsonb, p_operator uuid) returns uuid`
  - `public.void_sale(p_sale uuid, p_operator uuid, p_reason text) returns uuid`
  - `public.record_order_sale(p_order uuid, p_operator uuid) returns uuid`
  - Payload `p`: `{"channel": text|null, "customer_id": uuid|null, "method": text|null, "discount": number, "note": text|null, "items": [{"product_id": uuid|null, "description": text, "quantity": int, "list_unit_price": number, "unit_price": number}]}`
  - `customers.wholesale boolean`

- [ ] **Step 1: Escribir la migración**

```sql
-- Libro de ventas: una fila por venta (mostrador o pedido entregado), con sus
-- líneas y su historial. Todo cambio pasa por funciones security definer que
-- mueven stock y escriben sale_log; RLS deja solo lectura directa.
-- Spec: docs/superpowers/specs/2026-11-06-libro-de-ventas-design.md

alter table public.customers
  add column wholesale boolean not null default false;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sold_at timestamptz not null default now(),
  channel text check (channel in
    ('whatsapp','whatsapp_personal','instagram','facebook','local','web','mercadolibre','other')),
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid unique references public.orders (id) on delete set null,
  method text check (method in
    ('cash','transfer','uala','brubank','mercadopago','other')),
  list_total numeric not null default 0 check (list_total >= 0),
  discount numeric not null default 0 check (discount >= 0),
  amount numeric not null check (amount >= 0),
  operator_id uuid references public.operators (id) on delete set null,
  note text,
  source_tx_id uuid unique,
  voided_at timestamptz,
  voided_by uuid references public.operators (id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_sold_at_idx on public.sales (sold_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  position int not null default 0,
  product_id uuid references public.products (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity int not null check (quantity > 0),
  list_unit_price numeric not null check (list_unit_price >= 0),
  unit_price numeric not null check (unit_price >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.sale_log (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  operator_id uuid references public.operators (id) on delete set null,
  kind text not null check (kind in ('created','edited','voided','restored')),
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index sale_log_sale_idx on public.sale_log (sale_id, created_at);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_log enable row level security;
create policy sales_read on public.sales for select to authenticated using (true);
create policy sale_items_read on public.sale_items for select to authenticated using (true);
create policy sale_log_read on public.sale_log for select to authenticated using (true);
-- Sin políticas de insert/update/delete: solo las funciones escriben.

-- Foto de la venta con sus líneas, para sale_log.before/after.
create or replace function public._sale_snapshot(p_sale uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object('items', coalesce((
    select jsonb_agg(to_jsonb(i) order by i.position)
    from public.sale_items i where i.sale_id = s.id), '[]'::jsonb))
  from public.sales s where s.id = p_sale;
$$;

-- Mueve stock de un producto con el kind/operador que lee log_product_change.
create or replace function public._sale_move_stock(
  p_product uuid, p_delta int, p_kind text, p_operator uuid, p_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if p_delta = 0 then return; end if;
  perform set_config('app.stock_kind', p_kind, true);
  perform set_config('app.stock_operator', coalesce(p_operator::text, ''), true);
  perform set_config('app.stock_note', coalesce(p_note, ''), true);
  update public.products set stock_quantity = stock_quantity + p_delta
    where id = p_product returning name into v_name;
  if not found then
    raise exception 'El producto ya no existe';
  end if;
exception when check_violation then
  select name into v_name from public.products where id = p_product;
  raise exception 'No hay stock suficiente de %', coalesce(v_name, 'ese producto');
end;
$$;

-- Valida el payload y devuelve los totales. Lanza mensajes para la pantalla.
create or replace function public._sale_totals(p jsonb, out list_total numeric,
  out amount numeric, out discount numeric)
language plpgsql immutable set search_path = '' as $$
declare v_item jsonb; v_sub numeric := 0;
begin
  list_total := 0;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  for v_item in select * from jsonb_array_elements(p->'items') loop
    if coalesce((v_item->>'quantity')::int, 0) <= 0 then
      raise exception 'La cantidad tiene que ser mayor a 0';
    end if;
    if coalesce((v_item->>'unit_price')::numeric, -1) < 0
       or coalesce((v_item->>'list_unit_price')::numeric, -1) < 0 then
      raise exception 'Revisá los precios';
    end if;
    if length(trim(coalesce(v_item->>'description', ''))) = 0 then
      raise exception 'Falta el nombre de un producto';
    end if;
    list_total := list_total + (v_item->>'quantity')::int * (v_item->>'list_unit_price')::numeric;
    v_sub := v_sub + (v_item->>'quantity')::int * (v_item->>'unit_price')::numeric;
  end loop;
  discount := coalesce((p->>'discount')::numeric, 0);
  if discount < 0 then raise exception 'El descuento no puede ser negativo'; end if;
  amount := v_sub - discount;
  if amount < 0 then raise exception 'El descuento es mayor que el total'; end if;
end;
$$;

create or replace function public._sale_insert_items(p_sale uuid, p jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.sale_items
    (sale_id, position, product_id, description, quantity, list_unit_price, unit_price)
  select p_sale, (e.ord - 1)::int, nullif(e.v->>'product_id', '')::uuid,
         trim(e.v->>'description'), (e.v->>'quantity')::int,
         (e.v->>'list_unit_price')::numeric, (e.v->>'unit_price')::numeric
  from jsonb_array_elements(p->'items') with ordinality as e(v, ord);
$$;

create or replace function public.create_sale(p jsonb, p_operator uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_t record; v_id uuid; v_row record;
begin
  if p_operator is null or not exists (
    select 1 from public.operators where id = p_operator and active) then
    raise exception 'Elegí quién vende (poné tu PIN)';
  end if;
  select * into v_t from public._sale_totals(p);
  insert into public.sales (channel, customer_id, method, list_total, discount, amount, operator_id, note)
  values (coalesce(nullif(p->>'channel', ''), 'local'),
          nullif(p->>'customer_id', '')::uuid, nullif(p->>'method', ''),
          v_t.list_total, v_t.discount, v_t.amount, p_operator, nullif(trim(p->>'note'), ''))
  returning id into v_id;
  perform public._sale_insert_items(v_id, p);
  for v_row in
    select product_id, sum(quantity)::int as qty from public.sale_items
    where sale_id = v_id and product_id is not null group by product_id
  loop
    perform public._sale_move_stock(v_row.product_id, -v_row.qty, 'sale', p_operator, 'Venta');
  end loop;
  insert into public.sale_log (sale_id, operator_id, kind, after)
    values (v_id, p_operator, 'created', public._sale_snapshot(v_id));
  return v_id;
end;
$$;

create or replace function public.edit_sale(p_sale uuid, p jsonb, p_operator uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sale public.sales; v_t record; v_before jsonb; v_row record;
begin
  if not exists (select 1 from public.operators
                 where id = p_operator and role = 'admin' and active) then
    raise exception 'Solo un admin puede corregir una venta';
  end if;
  select * into v_sale from public.sales where id = p_sale for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_sale.order_id is not null then
    raise exception 'Esta venta es de un pedido: corregí el pedido';
  end if;
  if v_sale.voided_at is not null then raise exception 'La venta está anulada'; end if;
  select * into v_t from public._sale_totals(p);
  v_before := public._sale_snapshot(p_sale);
  -- Stock: devolver lo viejo y descontar lo nuevo, neto por producto.
  for v_row in
    select product_id, sum(delta)::int as delta from (
      select product_id, quantity as delta from public.sale_items
        where sale_id = p_sale and product_id is not null
      union all
      select nullif(e->>'product_id', '')::uuid, -(e->>'quantity')::int
        from jsonb_array_elements(p->'items') e
        where nullif(e->>'product_id', '') is not null
    ) d group by product_id
  loop
    perform public._sale_move_stock(v_row.product_id, v_row.delta,
      case when v_row.delta > 0 then 'in' else 'sale' end, p_operator, 'Corrección de venta');
  end loop;
  delete from public.sale_items where sale_id = p_sale;
  perform public._sale_insert_items(p_sale, p);
  update public.sales set
    channel = coalesce(nullif(p->>'channel', ''), channel),
    customer_id = nullif(p->>'customer_id', '')::uuid,
    method = nullif(p->>'method', ''),
    list_total = v_t.list_total, discount = v_t.discount, amount = v_t.amount,
    note = nullif(trim(p->>'note'), ''), updated_at = now()
  where id = p_sale;
  insert into public.sale_log (sale_id, operator_id, kind, before, after)
    values (p_sale, p_operator, 'edited', v_before, public._sale_snapshot(p_sale));
  return p_sale;
end;
$$;

create or replace function public.void_sale(p_sale uuid, p_operator uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sale public.sales; v_before jsonb; v_row record;
begin
  if not exists (select 1 from public.operators
                 where id = p_operator and role = 'admin' and active) then
    raise exception 'Solo un admin puede anular una venta';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Escribí el motivo de la anulación';
  end if;
  select * into v_sale from public.sales where id = p_sale for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_sale.voided_at is not null then raise exception 'La venta ya está anulada'; end if;
  v_before := public._sale_snapshot(p_sale);
  -- Mostrador (incluidas las copiadas de transactions, que sí descontaron stock).
  if v_sale.order_id is null then
    for v_row in
      select product_id, sum(quantity)::int as qty from public.sale_items
      where sale_id = p_sale and product_id is not null group by product_id
    loop
      perform public._sale_move_stock(v_row.product_id, v_row.qty, 'in', p_operator, 'Venta anulada');
    end loop;
  end if;
  update public.sales set voided_at = now(), voided_by = p_operator,
    void_reason = trim(p_reason), updated_at = now() where id = p_sale;
  insert into public.sale_log (sale_id, operator_id, kind, reason, before, after)
    values (p_sale, p_operator, 'voided', trim(p_reason), v_before, public._sale_snapshot(p_sale));
  return p_sale;
end;
$$;

-- Venta de un pedido: foto del total al entregarse. Una por pedido.
create or replace function public.record_order_sale(p_order uuid, p_operator uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_o public.orders; v_id uuid; v_before jsonb; v_kind text; v_items jsonb;
begin
  select * into v_o from public.orders where id = p_order;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', i.product_id,
      'description', coalesce(nullif(trim(i.description), ''), 'Pedido'),
      'quantity', greatest(i.quantity, 1),
      'list_unit_price', coalesce(i.unit_price, 0),
      'unit_price', coalesce(i.unit_price, 0)) order by i.position), '[]'::jsonb)
    into v_items
    from public.order_items i where i.order_id = p_order;
  -- Sin ítems, o ítems que no suman el total: una sola línea con el total.
  if jsonb_array_length(v_items) = 0 or (
       select sum((e->>'quantity')::int * (e->>'unit_price')::numeric)
       from jsonb_array_elements(v_items) e) is distinct from coalesce(v_o.total_amount, 0) then
    v_items := jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'description', coalesce(nullif(trim(v_o.title), ''), 'Pedido'),
      'quantity', 1,
      'list_unit_price', coalesce(v_o.total_amount, 0),
      'unit_price', coalesce(v_o.total_amount, 0)));
  end if;

  select id into v_id from public.sales where order_id = p_order for update;
  if v_id is null then
    insert into public.sales (sold_at, channel, customer_id, order_id, method,
      list_total, discount, amount, operator_id)
    values (now(), v_o.origin_channel, v_o.customer_id, p_order, v_o.payment_method,
      coalesce(v_o.total_amount, 0), 0, coalesce(v_o.total_amount, 0), p_operator)
    returning id into v_id;
    perform public._sale_insert_items(v_id, jsonb_build_object('items', v_items));
    insert into public.sale_log (sale_id, operator_id, kind, after)
      values (v_id, p_operator, 'created', public._sale_snapshot(v_id));
  else
    v_before := public._sale_snapshot(v_id);
    v_kind := case when (v_before->>'voided_at') is not null then 'restored' else 'edited' end;
    delete from public.sale_items where sale_id = v_id;
    perform public._sale_insert_items(v_id, jsonb_build_object('items', v_items));
    update public.sales set sold_at = now(), channel = v_o.origin_channel,
      customer_id = v_o.customer_id, method = v_o.payment_method,
      list_total = coalesce(v_o.total_amount, 0), discount = 0,
      amount = coalesce(v_o.total_amount, 0),
      voided_at = null, voided_by = null, void_reason = null, updated_at = now()
    where id = v_id;
    insert into public.sale_log (sale_id, operator_id, kind, before, after)
      values (v_id, p_operator, v_kind, v_before, public._sale_snapshot(v_id));
  end if;
  return v_id;
end;
$$;

create or replace function public.orders_record_sale_on_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    perform public.record_order_sale(new.id, null);
  end if;
  return new;
end;
$$;
create trigger trg_orders_record_sale
  after update of status on public.orders
  for each row execute function public.orders_record_sale_on_delivery();

revoke execute on function public._sale_snapshot(uuid), public._sale_move_stock(uuid, int, text, uuid, text),
  public._sale_totals(jsonb), public._sale_insert_items(uuid, jsonb),
  public.record_order_sale(uuid, uuid), public.orders_record_sale_on_delivery()
  from public, anon, authenticated;
revoke execute on function public.create_sale(jsonb, uuid), public.edit_sale(uuid, jsonb, uuid),
  public.void_sale(uuid, uuid, text) from public, anon;
grant execute on function public.create_sale(jsonb, uuid), public.edit_sale(uuid, jsonb, uuid),
  public.void_sale(uuid, uuid, text) to authenticated;

-- Copia inicial (idempotente). No mueve stock: esas ventas ya lo descontaron.
insert into public.sales (sold_at, channel, customer_id, method, list_total,
  discount, amount, operator_id, note, source_tx_id, created_at)
select t.transacted_at, 'local', t.customer_id, t.method, t.amount, 0, t.amount,
  t.operator_id, null, t.id, t.created_at
from public.transactions t
where t.type = 'product_sale'
on conflict (source_tx_id) do nothing;

insert into public.sale_items (sale_id, position, product_id, description,
  quantity, list_unit_price, unit_price)
select s.id, 0, t.product_id,
  coalesce(p.name, nullif(trim(t.note), ''), 'Venta'),
  coalesce(nullif(t.quantity, 0), 1),
  t.amount / coalesce(nullif(t.quantity, 0), 1),
  t.amount / coalesce(nullif(t.quantity, 0), 1)
from public.sales s
join public.transactions t on t.id = s.source_tx_id
left join public.products p on p.id = t.product_id
where not exists (select 1 from public.sale_items i where i.sale_id = s.id);

insert into public.sales (sold_at, channel, customer_id, order_id, method,
  list_total, discount, amount)
select coalesce(
    (select max(e.created_at) from public.production_events e
     where e.order_id = o.id and e.kind = 'stage' and e.to_status = 'delivered'),
    (o.due_date::timestamp + time '12:00') at time zone 'America/Argentina/Buenos_Aires',
    o.updated_at),
  o.origin_channel, o.customer_id, o.id, o.payment_method,
  coalesce(o.total_amount, 0), 0, coalesce(o.total_amount, 0)
from public.orders o
where o.status = 'delivered'
on conflict (order_id) do nothing;

insert into public.sale_items (sale_id, position, description, quantity, list_unit_price, unit_price)
select s.id, 0, coalesce(nullif(trim(o.title), ''), 'Pedido'), 1, s.amount, s.amount
from public.sales s join public.orders o on o.id = s.order_id
where not exists (select 1 from public.sale_items i where i.sale_id = s.id);

insert into public.sale_log (sale_id, kind, reason, after)
select s.id, 'created', 'Copia inicial del libro de ventas', public._sale_snapshot(s.id)
from public.sales s
where not exists (select 1 from public.sale_log l where l.sale_id = s.id);
```

- [ ] **Step 2: Revisar el SQL contra el esquema real** (solo lectura, sin OK necesario): confirmar con `execute_sql` que `orders.payment_method` y `orders.origin_channel` no tienen valores fuera de los checks de `sales`:

```sql
select 'method' k, payment_method v, count(*) from public.orders where status='delivered'
  and payment_method is not null and payment_method not in ('cash','transfer','uala','brubank','mercadopago','other') group by 2
union all
select 'channel', origin_channel, count(*) from public.orders where status='delivered'
  and origin_channel is not null and origin_channel not in ('whatsapp','whatsapp_personal','instagram','facebook','local','web','mercadolibre','other') group by 2
union all
select 'tx_method', method, count(*) from public.transactions where type='product_sale'
  and method is not null and method not in ('cash','transfer','uala','brubank','mercadopago','other') group by 2;
```

Expected: 0 filas. Si aparece alguna, agregar ese valor al check correspondiente o mapearlo a `'other'` en la copia, y anotarlo en el reporte.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261106150000_sales_ledger.sql
git commit -m "feat(ventas): migración del libro de ventas"
```

---

### Task 2: Verificación de la migración en transacción y aplicación (con OK del usuario)

**Files:**
- Create: `supabase/checks/sales_ledger_checks.sql`

**Interfaces:**
- Consumes: la migración de Task 1.

- [ ] **Step 1: Probar que `execute_sql` corre varias sentencias en UNA transacción** (con OK del usuario, es inofensivo): ejecutar `create table public._probe_tx (x int); do $$ begin raise exception 'probe'; end $$;` y después `select to_regclass('public._probe_tx')`. Tiene que dar `null`. Si da otra cosa: borrar la tabla (`drop table public._probe_tx`), NO seguir con Step 3, y proponer al usuario verificar en una rama de Supabase (tiene costo; `get_cost` + `confirm_cost`).

- [ ] **Step 2: Escribir el script de verificación.** El archivo es la migración completa seguida de este bloque `do`, que termina siempre con `raise exception` para que toda la llamada haga rollback (por eso el Step 1).

```sql
-- Se corre como: <contenido de la migración> + este bloque, en UNA llamada.
-- Siempre termina en error a propósito: nada queda escrito.
do $$
declare
  v_admin uuid; v_op uuid; v_prod uuid; v_stock int; v_sale uuid; v_order uuid;
  v_cnt int; v_msg text := '';
begin
  select id into v_admin from public.operators where role = 'admin' and active limit 1;
  select id into v_op from public.operators where role <> 'admin' and active limit 1;
  select id, stock_quantity into v_prod, v_stock from public.products
    where active and stock_quantity >= 3 limit 1;

  -- 1. create_sale descuenta stock y registra historial
  v_sale := public.create_sale(jsonb_build_object('discount', 100, 'method', 'cash',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_prod,
      'description', 'x', 'quantity', 2, 'list_unit_price', 1000, 'unit_price', 1000))), v_op);
  assert (select stock_quantity from public.products where id = v_prod) = v_stock - 2, 'stock create';
  assert (select amount from public.sales where id = v_sale) = 1900, 'amount';
  assert (select list_total from public.sales where id = v_sale) = 2000, 'list_total';
  v_msg := v_msg || 'create ok; ';

  -- 2. no admin no corrige ni anula
  begin
    perform public.void_sale(v_sale, v_op, 'x');
    raise exception 'operator could void';
  exception when others then
    assert sqlerrm like 'Solo un admin%', 'void perm: ' || sqlerrm;
  end;
  -- 3. anular sin motivo falla
  begin
    perform public.void_sale(v_sale, v_admin, '  ');
    raise exception 'void without reason';
  exception when others then
    assert sqlerrm like 'Escribí el motivo%', 'void reason: ' || sqlerrm;
  end;
  -- 4. edit ajusta stock por diferencia (2 → 1)
  perform public.edit_sale(v_sale, jsonb_build_object('method', 'cash',
    'items', jsonb_build_array(jsonb_build_object('product_id', v_prod,
      'description', 'x', 'quantity', 1, 'list_unit_price', 1000, 'unit_price', 1000))), v_admin);
  assert (select stock_quantity from public.products where id = v_prod) = v_stock - 1, 'stock edit';
  -- 5. void devuelve stock
  perform public.void_sale(v_sale, v_admin, 'prueba');
  assert (select stock_quantity from public.products where id = v_prod) = v_stock, 'stock void';
  assert (select count(*) from public.sale_log where sale_id = v_sale) = 3, 'log count';
  v_msg := v_msg || 'edit/void ok; ';

  -- 6. un pedido entregado dos veces tiene una sola venta
  select id into v_order from public.orders where status <> 'delivered' limit 1;
  update public.orders set status = 'delivered' where id = v_order;
  update public.orders set status = 'ready' where id = v_order;
  update public.orders set status = 'delivered' where id = v_order;
  select count(*) into v_cnt from public.sales where order_id = v_order;
  assert v_cnt = 1, 'one sale per order';
  v_msg := v_msg || 'order ok; ';

  -- 7. copia inicial
  select count(*) into v_cnt from public.sales where source_tx_id is not null;
  v_msg := v_msg || 'copiadas_mostrador=' || v_cnt || '; ';
  select count(*) into v_cnt from public.sales s join public.orders o on o.id = s.order_id
    where o.status = 'delivered';
  v_msg := v_msg || 'pedidos_entregados=' || v_cnt || '; ';
  select count(*) into v_cnt from public.sales s
    where not exists (select 1 from public.sale_items i where i.sale_id = s.id);
  assert v_cnt = 0, 'sales without items';

  raise exception 'CHECKS OK (rollback): %', v_msg;
end $$;
```

Nota: el estado `'ready'` debe ser un valor válido del enum de `orders.status`; verificarlo antes con `select enum_range(null::public.order_status)` (o el nombre real del enum) y usar uno distinto de `delivered`.

- [ ] **Step 3: PARAR y pedir OK al usuario** para correr la verificación en producción (todo en una transacción que termina en error = rollback). Mostrar qué hace el script.

- [ ] **Step 3b: Correr la verificación** con `execute_sql`: el contenido de `supabase/checks/sales_ledger_checks.sql`, en una sola llamada.
Expected: error `CHECKS OK (rollback): create ok; edit/void ok; order ok; copiadas_mostrador=52; pedidos_entregados=N;`. Cualquier otro error = fallo; corregir la migración y volver a Step 3.

- [ ] **Step 4: Confirmar que no quedó nada:** `select to_regclass('public.sales')` → `null`.

- [ ] **Step 5: PARAR y pedir OK** para aplicar la migración en producción, mostrando: tablas y funciones nuevas, trigger en `orders`, columna `customers.wholesale`, y las cantidades de filas que copia (de Step 3).

- [ ] **Step 6: Aplicar** con `apply_migration` (name `sales_ledger`). Luego: `select count(*) from public.sales` y comparar con Step 3.

- [ ] **Step 7: Commit**

```bash
git add supabase/checks/sales_ledger_checks.sql
git commit -m "test(ventas): verificación del libro de ventas en transacción"
```

---

### Task 3: Tipos de la base

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1:** Generar con la herramienta MCP `generate_typescript_types` (proyecto `bukjmleercxlxbexekos`) y reemplazar el archivo; correr `npx prettier --write src/lib/database.types.ts`.
- [ ] **Step 2:** `git diff --stat src/lib/database.types.ts`: tiene que mostrar `sales`, `sale_items`, `sale_log`, `customers.wholesale` y las funciones nuevas, sin borrar tablas existentes. Si el formato generado difiere mucho del actual, agregar a mano solo esos bloques siguiendo el formato existente.
- [ ] **Step 3:** `npm run typecheck` → PASS.
- [ ] **Step 4: Commit** `git commit -am "chore(ventas): tipos del libro de ventas"`

---

### Task 4: Cálculo del ticket

**Files:**
- Create: `src/features/sales/ticket.ts`, `src/features/sales/ticket.test.ts`

**Interfaces:**
- Consumes: `parseMoney(raw: string): number | null` de `@/features/orders/orderDraft`.
- Produces:

```ts
export interface TicketLine {
  key: string
  productId: string | null
  description: string
  quantity: string      // texto del input
  listUnitPrice: number // precio de lista al agregar
  unitPrice: string     // texto del input
}
export type DiscountMode = 'amount' | 'percent'
export interface TicketDraft {
  lines: TicketLine[]
  discountMode: DiscountMode
  discount: string
  method: PaymentMethod | null
  channel: OriginChannel
  customerId: string | null
  note: string
}
export interface TicketTotals { listTotal: number; subtotal: number; discount: number; amount: number }
export interface SalePayload {
  channel: OriginChannel | null; customer_id: string | null; method: PaymentMethod | null
  discount: number; note: string | null
  items: { product_id: string | null; description: string; quantity: number; list_unit_price: number; unit_price: number }[]
}
export function emptyTicket(): TicketDraft
export function lineFromProduct(p: { id: string; name: string; base_price: number | null }): TicketLine
export function freeLine(description: string): TicketLine
export function lineQty(l: TicketLine): number            // inválido → 0
export function lineUnitPrice(l: TicketLine): number      // inválido → NaN
export function ticketTotals(d: TicketDraft): TicketTotals
export function ticketErrors(d: TicketDraft): string[]
export function toPayload(d: TicketDraft): SalePayload
```

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest'
import {
  emptyTicket, freeLine, lineFromProduct, ticketErrors, ticketTotals, toPayload,
} from './ticket'

const vaso = { id: 'p1', name: 'Vaso Boca', base_price: 24800 }

function draftWith(lines = [lineFromProduct(vaso)]) {
  return { ...emptyTicket(), lines, method: 'cash' as const }
}

describe('ticket', () => {
  it('suma líneas a precio de lista sin descuento', () => {
    const d = draftWith([{ ...lineFromProduct(vaso), quantity: '2' }])
    expect(ticketTotals(d)).toEqual({ listTotal: 49600, subtotal: 49600, discount: 0, amount: 49600 })
  })

  it('precio unitario cambiado cuenta como descuento sobre la lista', () => {
    const d = draftWith([{ ...lineFromProduct(vaso), unitPrice: '13.200' }])
    expect(ticketTotals(d)).toMatchObject({ listTotal: 24800, subtotal: 13200, amount: 13200 })
  })

  it('descuento en pesos con formato argentino', () => {
    const d = { ...draftWith(), discount: '1.800' }
    expect(ticketTotals(d)).toMatchObject({ discount: 1800, amount: 23000 })
  })

  it('descuento en porcentaje redondea a peso', () => {
    const d = { ...draftWith(), discountMode: 'percent' as const, discount: '15' }
    expect(ticketTotals(d)).toMatchObject({ discount: 3720, amount: 21080 })
  })

  it('errores: sin líneas, sin medio, cantidad inválida, descuento mayor al total', () => {
    expect(ticketErrors(emptyTicket())).toEqual(
      expect.arrayContaining(['Agregá al menos un producto', 'Elegí el medio de pago']),
    )
    const bad = draftWith([{ ...lineFromProduct(vaso), quantity: '0' }])
    expect(ticketErrors(bad)).toContain('Revisá la cantidad de Vaso Boca')
    expect(ticketErrors({ ...draftWith(), discount: '30000' })).toContain(
      'El descuento es mayor que el total',
    )
  })

  it('payload para la base, con texto libre y descuento en pesos', () => {
    const d = { ...draftWith([lineFromProduct(vaso), { ...freeLine('Llavero'), unitPrice: '3000' }]), discount: '10', discountMode: 'percent' as const }
    const p = toPayload(d)
    expect(p.items).toEqual([
      { product_id: 'p1', description: 'Vaso Boca', quantity: 1, list_unit_price: 24800, unit_price: 24800 },
      { product_id: null, description: 'Llavero', quantity: 1, list_unit_price: 3000, unit_price: 3000 },
    ])
    expect(p.discount).toBe(2780)
    expect(p.channel).toBe('local')
  })
})
```

- [ ] **Step 2: Correr** `npx vitest run src/features/sales/ticket.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
import { parseMoney } from '@/features/orders/orderDraft'
import type { OriginChannel, PaymentMethod } from '@/lib/domain-constants'

// Pure ticket math for "Nueva venta". Inputs stay as typed text; everything
// numeric goes through parseMoney so "13.200" means 13200.

export interface TicketLine {
  key: string
  productId: string | null
  description: string
  quantity: string
  listUnitPrice: number
  unitPrice: string
}
export type DiscountMode = 'amount' | 'percent'
export interface TicketDraft {
  lines: TicketLine[]
  discountMode: DiscountMode
  discount: string
  method: PaymentMethod | null
  channel: OriginChannel
  customerId: string | null
  note: string
}
export interface TicketTotals { listTotal: number; subtotal: number; discount: number; amount: number }
export interface SalePayload {
  channel: OriginChannel | null
  customer_id: string | null
  method: PaymentMethod | null
  discount: number
  note: string | null
  items: { product_id: string | null; description: string; quantity: number; list_unit_price: number; unit_price: number }[]
}

let seq = 0
const nextKey = () => `l${++seq}`

export function emptyTicket(): TicketDraft {
  return { lines: [], discountMode: 'amount', discount: '', method: null, channel: 'local', customerId: null, note: '' }
}

export function lineFromProduct(p: { id: string; name: string; base_price: number | null }): TicketLine {
  const price = p.base_price ?? 0
  return { key: nextKey(), productId: p.id, description: p.name, quantity: '1', listUnitPrice: price, unitPrice: String(price) }
}

export function freeLine(description: string): TicketLine {
  return { key: nextKey(), productId: null, description: description.trim(), quantity: '1', listUnitPrice: 0, unitPrice: '' }
}

export function lineQty(l: TicketLine): number {
  const n = Number(l.quantity.trim())
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function lineUnitPrice(l: TicketLine): number {
  const n = parseMoney(l.unitPrice)
  return n == null || Number.isNaN(n) || n < 0 ? Number.NaN : n
}

// A free-text line has no catalog price: its list price is what was charged.
function listUnit(l: TicketLine): number {
  return l.productId ? l.listUnitPrice : lineUnitPrice(l)
}

function discountAmount(d: TicketDraft, subtotal: number): number {
  const raw = d.discountMode === 'percent' ? Number(d.discount.replace(',', '.')) : parseMoney(d.discount)
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 0
  return d.discountMode === 'percent' ? Math.round((subtotal * raw) / 100) : raw
}

export function ticketTotals(d: TicketDraft): TicketTotals {
  let listTotal = 0
  let subtotal = 0
  for (const l of d.lines) {
    const q = lineQty(l)
    const u = lineUnitPrice(l)
    if (!q || Number.isNaN(u)) continue
    listTotal += q * listUnit(l)
    subtotal += q * u
  }
  const discount = discountAmount(d, subtotal)
  return { listTotal, subtotal, discount, amount: subtotal - discount }
}

export function ticketErrors(d: TicketDraft): string[] {
  const errs: string[] = []
  if (d.lines.length === 0) errs.push('Agregá al menos un producto')
  for (const l of d.lines) {
    if (!lineQty(l)) errs.push(`Revisá la cantidad de ${l.description}`)
    if (Number.isNaN(lineUnitPrice(l))) errs.push(`Revisá el precio de ${l.description}`)
  }
  if (!d.method) errs.push('Elegí el medio de pago')
  const t = ticketTotals(d)
  if (t.amount < 0) errs.push('El descuento es mayor que el total')
  return errs
}

export function toPayload(d: TicketDraft): SalePayload {
  const t = ticketTotals(d)
  return {
    channel: d.channel,
    customer_id: d.customerId,
    method: d.method,
    discount: t.discount,
    note: d.note.trim() || null,
    items: d.lines.map((l) => ({
      product_id: l.productId,
      description: l.description,
      quantity: lineQty(l),
      list_unit_price: listUnit(l),
      unit_price: lineUnitPrice(l),
    })),
  }
}
```

- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `git add src/features/sales/ticket*.ts && git commit -m "feat(ventas): cálculo del ticket"`

---

### Task 5: API de ventas

**Files:**
- Create: `src/features/sales/sales.api.ts`, `src/features/sales/sales.api.test.ts`

**Interfaces:**
- Consumes: `SalePayload` (Task 4), tipos de `database.types.ts` (Task 3).
- Produces:

```ts
export type SaleRow = Database['public']['Tables']['sales']['Row']
export type SaleItemRow = Database['public']['Tables']['sale_items']['Row']
export type SaleLogRow = Database['public']['Tables']['sale_log']['Row']
export type SaleWithRefs = SaleRow & {
  sale_items: SaleItemRow[]
  customers: { name: string; wholesale: boolean } | null
  orders: { id: string; title: string | null } | null
}
export function createSale(p: SalePayload, operatorId: string | null): Promise<string>
export function editSale(id: string, p: SalePayload, operatorId: string | null): Promise<string>
export function voidSale(id: string, operatorId: string | null, reason: string): Promise<string>
export function listSales(from: Date, to: Date): Promise<SaleWithRefs[]>
export function getSaleLog(saleId: string): Promise<SaleLogRow[]>
export function getOrderSale(orderId: string): Promise<SaleRow | null>
export function setCustomerWholesale(customerId: string, wholesale: boolean): Promise<void>
```

- [ ] **Step 1: Test que falla** (mismo estilo que `payments.api.test.ts`)

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from } }))

import { createSale, editSale, listSales, voidSale } from './sales.api'

const payload = { channel: 'local' as const, customer_id: null, method: 'cash' as const, discount: 0, note: null,
  items: [{ product_id: 'p1', description: 'Vaso', quantity: 1, list_unit_price: 100, unit_price: 100 }] }

describe('sales API', () => {
  beforeEach(() => {
    rpc.mockReset(); from.mockReset()
    rpc.mockResolvedValue({ data: 's1', error: null })
  })

  it('createSale manda el ticket y quién vende', async () => {
    await expect(createSale(payload, 'op1')).resolves.toBe('s1')
    expect(rpc).toHaveBeenCalledWith('create_sale', { p: payload, p_operator: 'op1' })
  })

  it('editSale y voidSale mandan venta, persona y datos', async () => {
    await editSale('s1', payload, 'adm')
    expect(rpc).toHaveBeenCalledWith('edit_sale', { p_sale: 's1', p: payload, p_operator: 'adm' })
    await voidSale('s1', 'adm', 'mal cargada')
    expect(rpc).toHaveBeenCalledWith('void_sale', { p_sale: 's1', p_operator: 'adm', p_reason: 'mal cargada' })
  })

  it('el mensaje de la base llega tal cual', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'No hay stock suficiente de Vaso' } })
    await expect(createSale(payload, 'op1')).rejects.toThrow('No hay stock suficiente de Vaso')
  })

  it('listSales filtra por fecha y ordena la más nueva primero', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const lt = vi.fn().mockReturnValue({ order })
    const gte = vi.fn().mockReturnValue({ lt })
    const select = vi.fn().mockReturnValue({ gte })
    from.mockReturnValue({ select })
    const a = new Date('2026-11-01T03:00:00Z'); const b = new Date('2026-11-02T03:00:00Z')
    await listSales(a, b)
    expect(from).toHaveBeenCalledWith('sales')
    expect(gte).toHaveBeenCalledWith('sold_at', a.toISOString())
    expect(lt).toHaveBeenCalledWith('sold_at', b.toISOString())
    expect(order).toHaveBeenCalledWith('sold_at', { ascending: false })
  })
})
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar**

```ts
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { SalePayload } from './ticket'

export type SaleRow = Database['public']['Tables']['sales']['Row']
export type SaleItemRow = Database['public']['Tables']['sale_items']['Row']
export type SaleLogRow = Database['public']['Tables']['sale_log']['Row']
export type SaleWithRefs = SaleRow & {
  sale_items: SaleItemRow[]
  customers: { name: string; wholesale: boolean } | null
  orders: { id: string; title: string | null } | null
}

// Database errors carry a Spanish message meant for the screen.
function fail(error: { message: string }): never {
  throw new Error(error.message)
}

// Stock, totals and the history row are handled by the database function.
export async function createSale(p: SalePayload, operatorId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale', { p: p as never, p_operator: operatorId as string })
  if (error) fail(error)
  return data as string
}

// Admin only (checked in the database).
export async function editSale(id: string, p: SalePayload, operatorId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('edit_sale', { p_sale: id, p: p as never, p_operator: operatorId as string })
  if (error) fail(error)
  return data as string
}

export async function voidSale(id: string, operatorId: string | null, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc('void_sale', { p_sale: id, p_operator: operatorId as string, p_reason: reason })
  if (error) fail(error)
  return data as string
}

export async function listSales(from: Date, to: Date): Promise<SaleWithRefs[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*), customers(name, wholesale), orders(id, title)')
    .gte('sold_at', from.toISOString())
    .lt('sold_at', to.toISOString())
    .order('sold_at', { ascending: false })
  if (error) fail(error)
  return (data ?? []) as SaleWithRefs[]
}

export async function getSaleLog(saleId: string): Promise<SaleLogRow[]> {
  const { data, error } = await supabase
    .from('sale_log').select('*').eq('sale_id', saleId).order('created_at', { ascending: true })
  if (error) fail(error)
  return data ?? []
}

export async function getOrderSale(orderId: string): Promise<SaleRow | null> {
  const { data, error } = await supabase.from('sales').select('*').eq('order_id', orderId).maybeSingle()
  if (error) fail(error)
  return data
}

export async function setCustomerWholesale(customerId: string, wholesale: boolean): Promise<void> {
  const { error } = await supabase.from('customers').update({ wholesale }).eq('id', customerId)
  if (error) fail(error)
}
```

- [ ] **Step 4: Correr** → PASS. `npm run typecheck` → PASS (si los tipos de `rpc` no aceptan `jsonb`, el `as never` lo resuelve; no usar `any`).
- [ ] **Step 5: Commit** `git commit -m "feat(ventas): API del libro de ventas"` (agregar los dos archivos).

---

### Task 6: Helpers de la lista

**Files:**
- Create: `src/features/sales/sales.ts`, `src/features/sales/sales.test.ts`

**Interfaces:**
- Consumes: `SaleWithRefs`, `SaleLogRow` (Task 5).
- Produces:

```ts
export interface SaleFilters {
  channel: OriginChannel | 'all' | 'none'
  method: PaymentMethod | 'all'
  wholesale: boolean        // solo mayoristas
  operatorId: string | 'all'
  showVoided: boolean
}
export const DEFAULT_FILTERS: SaleFilters
export function filterSales(rows: readonly SaleWithRefs[], f: SaleFilters): SaleWithRefs[]
export function salesTotals(rows: readonly SaleWithRefs[]): { amount: number; count: number; discounts: number }
export function itemsSummary(items: readonly { description: string; quantity: number; position: number }[]): string
export function logLabel(row: SaleLogRow, operatorName: (id: string | null) => string): string
```

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, filterSales, itemsSummary, logLabel, salesTotals } from './sales'
import type { SaleWithRefs } from './sales.api'

function sale(over: Partial<SaleWithRefs>): SaleWithRefs {
  return {
    id: 's', sold_at: '2026-11-06T15:00:00Z', channel: 'local', customer_id: null, order_id: null,
    method: 'cash', list_total: 1000, discount: 0, amount: 1000, operator_id: 'op1', note: null,
    source_tx_id: null, voided_at: null, voided_by: null, void_reason: null,
    created_at: '', updated_at: '', sale_items: [], customers: null, orders: null, ...over,
  } as SaleWithRefs
}

describe('sales list helpers', () => {
  const rows = [
    sale({ id: 'a', amount: 900, list_total: 1000 }),
    sale({ id: 'b', channel: 'web', method: 'transfer', customers: { name: 'X', wholesale: true } }),
    sale({ id: 'c', voided_at: '2026-11-06T16:00:00Z' }),
    sale({ id: 'd', channel: null }),
  ]

  it('por defecto oculta anuladas y los totales no las suman', () => {
    const v = filterSales(rows, DEFAULT_FILTERS)
    expect(v.map((r) => r.id)).toEqual(['a', 'b', 'd'])
    expect(salesTotals(v)).toEqual({ amount: 2900, count: 3, discounts: 100 })
  })

  it('mostrar anuladas las lista pero siguen sin sumar', () => {
    const v = filterSales(rows, { ...DEFAULT_FILTERS, showVoided: true })
    expect(v).toHaveLength(4)
    expect(salesTotals(v).count).toBe(3)
  })

  it('filtra por canal, sin canal, medio y mayorista', () => {
    expect(filterSales(rows, { ...DEFAULT_FILTERS, channel: 'web' }).map((r) => r.id)).toEqual(['b'])
    expect(filterSales(rows, { ...DEFAULT_FILTERS, channel: 'none' }).map((r) => r.id)).toEqual(['d'])
    expect(filterSales(rows, { ...DEFAULT_FILTERS, method: 'transfer' }).map((r) => r.id)).toEqual(['b'])
    expect(filterSales(rows, { ...DEFAULT_FILTERS, wholesale: true }).map((r) => r.id)).toEqual(['b'])
  })

  it('resume las líneas', () => {
    expect(itemsSummary([
      { description: 'Vaso Boca', quantity: 2, position: 0 },
      { description: 'Llavero', quantity: 1, position: 1 },
      { description: 'Mate', quantity: 1, position: 2 },
    ])).toBe('Vaso Boca ×2 + 2 más')
    expect(itemsSummary([{ description: 'Llavero', quantity: 1, position: 0 }])).toBe('Llavero')
  })

  it('etiqueta del historial', () => {
    const name = (id: string | null) => (id ? 'Nico' : 'Sistema')
    expect(logLabel({ kind: 'voided', operator_id: 'x', reason: 'mal' } as never, name)).toBe('Anulada por Nico: mal')
    expect(logLabel({ kind: 'created', operator_id: null, reason: null } as never, name)).toBe('Creada por Sistema')
  })
})
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar**

```ts
import type { OriginChannel, PaymentMethod } from '@/lib/domain-constants'
import type { SaleLogRow, SaleWithRefs } from './sales.api'

export interface SaleFilters {
  channel: OriginChannel | 'all' | 'none'
  method: PaymentMethod | 'all'
  wholesale: boolean
  operatorId: string | 'all'
  showVoided: boolean
}

export const DEFAULT_FILTERS: SaleFilters = {
  channel: 'all', method: 'all', wholesale: false, operatorId: 'all', showVoided: false,
}

export function filterSales(rows: readonly SaleWithRefs[], f: SaleFilters): SaleWithRefs[] {
  return rows.filter((r) => {
    if (!f.showVoided && r.voided_at) return false
    if (f.channel === 'none' && r.channel != null) return false
    if (f.channel !== 'all' && f.channel !== 'none' && r.channel !== f.channel) return false
    if (f.method !== 'all' && r.method !== f.method) return false
    if (f.wholesale && !r.customers?.wholesale) return false
    if (f.operatorId !== 'all' && r.operator_id !== f.operatorId) return false
    return true
  })
}

// Voided rows can be listed but never count.
export function salesTotals(rows: readonly SaleWithRefs[]) {
  const t = { amount: 0, count: 0, discounts: 0 }
  for (const r of rows) {
    if (r.voided_at) continue
    t.count++
    t.amount += Number(r.amount)
    t.discounts += Math.max(0, Number(r.list_total) - Number(r.amount))
  }
  return t
}

export function itemsSummary(items: readonly { description: string; quantity: number; position: number }[]): string {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return '—'
  const first = `${sorted[0].description}${sorted[0].quantity > 1 ? ` ×${sorted[0].quantity}` : ''}`
  return sorted.length > 1 ? `${first} + ${sorted.length - 1} más` : first
}

const KIND_LABEL: Record<string, string> = {
  created: 'Creada', edited: 'Corregida', voided: 'Anulada', restored: 'Reactivada',
}

export function logLabel(row: SaleLogRow, operatorName: (id: string | null) => string): string {
  const base = `${KIND_LABEL[row.kind] ?? row.kind} por ${operatorName(row.operator_id)}`
  return row.reason ? `${base}: ${row.reason}` : base
}
```

- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ventas): filtros y totales de la lista"`

---

### Task 7: Hoja "Nueva venta" (y corrección)

**Files:**
- Create: `src/features/sales/NewSaleSheet.tsx`, `src/features/sales/NewSaleSheet.test.tsx`, `src/features/sales/sales.css`

**Interfaces:**
- Consumes: `ticket.ts` (Task 4), `createSale`, `editSale`, `setCustomerWholesale` (Task 5), `listSellableProducts`-equivalente: `listProducts` de `@/features/products/products.api` + `filterProducts(products, { query: '', activeOnly: true })` de `@/features/products/list`, `matchesQuery` de `@/lib/search`, `searchCustomers` de `@/features/orders/orderSave.api`, `useOperator` de `@/features/operators/operator-context`, `PAYMENT_METHOD`, `PAYMENT_METHOD_LABELS`, `ORIGIN_CHANNEL`, `ORIGIN_CHANNEL_LABELS`.
- Produces:

```ts
export interface NewSaleSheetProps {
  open: boolean
  onClose: () => void
  onSaved: (saleId: string) => void
  editing?: SaleWithRefs | null // con venta: modo Corregir (editSale)
}
export default function NewSaleSheet(props: NewSaleSheetProps): JSX.Element | null
```

- [ ] **Step 1: Test que falla** (mockear `sales.api`, `products.api`, `orderSave.api` y `operator-context`)

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ createSale: vi.fn(), editSale: vi.fn(), setCustomerWholesale: vi.fn() }))
vi.mock('./sales.api', () => api)
vi.mock('@/features/products/products.api', () => ({
  listProducts: vi.fn().mockResolvedValue([
    { id: 'p1', name: 'Vaso Camiseta 650 ml BOCA', base_price: 24800, stock_quantity: 3, active: true, description: null },
    { id: 'p2', name: 'Llavero River', base_price: 3000, stock_quantity: 10, active: true, description: null },
  ]),
}))
vi.mock('@/features/orders/orderSave.api', () => ({ searchCustomers: vi.fn().mockResolvedValue([]) }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op1', name: 'Nico' }, isAdmin: false }),
}))

import NewSaleSheet from './NewSaleSheet'

describe('NewSaleSheet', () => {
  beforeEach(() => { api.createSale.mockReset().mockResolvedValue('s1') })

  it('busca por palabras, agrega con Enter, aplica descuento y guarda', async () => {
    const onSaved = vi.fn()
    render(<NewSaleSheet open onClose={() => {}} onSaved={onSaved} />)
    const search = await screen.findByLabelText('Buscar producto')
    await userEvent.type(search, 'vaso boca{Enter}')
    expect(screen.getByText('Vaso Camiseta 650 ml BOCA')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Descuento'), '1.800')
    expect(screen.getByText(/Cobrás \$\s?23\.000/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('s1'))
    expect(api.createSale).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'cash', discount: 1800, channel: 'local',
        items: [expect.objectContaining({ product_id: 'p1', quantity: 1, unit_price: 24800 })] }),
      'op1',
    )
  })

  it('muestra los errores y no guarda sin medio de pago', async () => {
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Buscar producto'), 'llavero{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar venta' }))
    expect(screen.getByText('Elegí el medio de pago')).toBeInTheDocument()
    expect(api.createSale).not.toHaveBeenCalled()
  })

  it('texto libre cuando no hay coincidencias', async () => {
    render(<NewSaleSheet open onClose={() => {}} onSaved={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Buscar producto'), 'Cartel a medida{Enter}')
    expect(screen.getByDisplayValue('Cartel a medida')).toBeInTheDocument()
  })
})
```

Nota: verificar la etiqueta real de `PAYMENT_METHOD_LABELS.cash` (si no es "Efectivo", usar la del archivo) y el formato de moneda de `@/features/orders/format` (usar el formateador existente del repo para mostrar montos).

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar el componente.** Estructura (mismo patrón de diálogo que `ProductSaleSheet`/`QuickOrderSheet`, que reemplaza):
  - Estado: `draft: TicketDraft` (de `emptyTicket()` o, en modo `editing`, armado desde `editing.sale_items`: `productId`, `description`, `quantity: String(q)`, `listUnitPrice: list_unit_price`, `unitPrice: String(unit_price)`, más `method`, `channel ?? 'local'`, `customerId`, `note`, `discount: String(editing.discount)`, `discountMode: 'amount'`).
  - Productos: al abrir, `listProducts()` → `filterProducts(…, { query: '', activeOnly: true })`.
  - Buscador `<input aria-label="Buscar producto">`: sugerencias = productos con `matchesQuery([p.name, p.description], query)` (máx. 8, cada una con "N en stock" y precio). Flechas para moverse; **Enter** agrega la sugerencia marcada (`lineFromProduct`) o, si no hay ninguna, `freeLine(query)`; limpia el buscador y deja el foco ahí.
  - Líneas: por línea, descripción (editable si es texto libre), `<input aria-label="Cantidad de {desc}">`, `<input aria-label="Precio de {desc}">` y botón quitar. Si `unitPrice` ≠ lista, mostrar la lista tachada.
  - Descuento: `<input aria-label="Descuento">` + toggle `$` / `%`.
  - Resumen en vivo: `Lista $X · Descuento $Y · Cobrás $Z` con `ticketTotals`.
  - Medio de pago: botones grandes con `PAYMENT_METHOD_LABELS` (`aria-pressed`).
  - Canal: `<select aria-label="Canal">` con `ORIGIN_CHANNEL_LABELS`, por defecto `local`.
  - Cliente (opcional): input con `searchCustomers` (debounce 250 ms) igual que en el pedido; al elegir uno, casilla **"Mayorista"** que llama `setCustomerWholesale(id, checked)` y muestra el estado actual.
  - Nota opcional.
  - Guardar: `ticketErrors(draft)`; si hay, listarlos y no guardar. Si no, `editing ? editSale(editing.id, toPayload(draft), current?.id ?? null) : createSale(toPayload(draft), current?.id ?? null)`; error de la base → mostrar `err.message`; ok → `onSaved(id)` y reset.
  - Sin persona activa (`current == null`): aviso "Poné tu PIN para cargar ventas" y Guardar deshabilitado.
  - Estilos en `sales.css` (botones de medio grandes, líneas en grilla, resumen fijo abajo en móvil).
- [ ] **Step 4: Correr** el test → PASS. `npm run typecheck`.
- [ ] **Step 5: Commit** `git commit -m "feat(ventas): hoja de nueva venta tipo ticket"`

---

### Task 8: Detalle de venta (historial, corregir, anular)

**Files:**
- Create: `src/features/sales/SaleDetail.tsx`, `src/features/sales/SaleDetail.test.tsx`

**Interfaces:**
- Consumes: `getSaleLog`, `voidSale` (Task 5), `logLabel`, `itemsSummary` (Task 6), `NewSaleSheet` (Task 7), `useOperator` (`current`, `isAdmin`, `byId`).
- Produces:

```ts
export default function SaleDetail(props: {
  sale: SaleWithRefs
  onClose: () => void
  onChanged: () => void
}): JSX.Element
```

- [ ] **Step 1: Test que falla**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getSaleLog: vi.fn(), voidSale: vi.fn(), editSale: vi.fn(), createSale: vi.fn(), setCustomerWholesale: vi.fn() }))
vi.mock('./sales.api', () => api)
const op = vi.hoisted(() => ({ value: { current: { id: 'adm' }, isAdmin: true, byId: () => ({ name: 'Nico' }) } }))
vi.mock('@/features/operators/operator-context', () => ({ useOperator: () => op.value }))

import SaleDetail from './SaleDetail'

const sale = {
  id: 's1', sold_at: '2026-11-06T15:00:00Z', channel: 'local', method: 'cash', amount: 23000,
  list_total: 24800, discount: 1800, order_id: null, voided_at: null, operator_id: 'adm',
  sale_items: [{ id: 'i1', description: 'Vaso Boca', quantity: 1, list_unit_price: 24800, unit_price: 24800, position: 0, product_id: 'p1' }],
  customers: null, orders: null,
} as never

describe('SaleDetail', () => {
  beforeEach(() => {
    api.getSaleLog.mockResolvedValue([{ id: 'l1', kind: 'created', operator_id: 'adm', reason: null, created_at: '2026-11-06T15:00:00Z' }])
    api.voidSale.mockResolvedValue('s1')
  })

  it('muestra líneas e historial', async () => {
    render(<MemoryRouter><SaleDetail sale={sale} onClose={() => {}} onChanged={() => {}} /></MemoryRouter>)
    expect(screen.getByText('Vaso Boca')).toBeInTheDocument()
    expect(await screen.findByText('Creada por Nico')).toBeInTheDocument()
  })

  it('un admin anula con motivo', async () => {
    const onChanged = vi.fn()
    render(<MemoryRouter><SaleDetail sale={sale} onClose={() => {}} onChanged={onChanged} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Anular' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect(screen.getByText('Escribí el motivo de la anulación.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo'), 'cargada dos veces')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    await waitFor(() => expect(api.voidSale).toHaveBeenCalledWith('s1', 'adm', 'cargada dos veces'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('quien no es admin ve el aviso y no los botones', () => {
    op.value = { current: { id: 'op1' }, isAdmin: false, byId: () => ({ name: 'Ana' }) } as never
    render(<MemoryRouter><SaleDetail sale={sale} onClose={() => {}} onChanged={() => {}} /></MemoryRouter>)
    expect(screen.getByText('Solo un admin puede corregir o anular')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull()
  })
})
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Diálogo con: fecha/hora, canal, medio, cliente (con etiqueta "Mayorista" si aplica), quién vendió (`byId(sale.operator_id)?.name ?? '—'`); líneas (descripción, cantidad, precio cobrado, lista tachada si difiere); totales `Lista · Descuento · Cobrado`; si `order_id`, link `Pedido` a `/admin/orders/{order_id}` (verificar la ruta real de detalle de pedido en `admin.route.tsx`); si anulada, banda "Anulada: {void_reason}". Historial: `getSaleLog(sale.id)` → `logLabel(row, (id) => byId(id)?.name ?? 'Sistema')` + fecha. Acciones (si no está anulada): si `!isAdmin` → texto "Solo un admin puede corregir o anular"; si admin → **Corregir** (solo sin `order_id`; abre `NewSaleSheet` con `editing={sale}`, al guardar `onChanged()`) y **Anular** (form con `<textarea aria-label="Motivo">`, valida no vacío con "Escribí el motivo de la anulación.", llama `voidSale(sale.id, current?.id ?? null, motivo)`, muestra `err.message` si falla, ok → `onChanged()`).
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ventas): detalle con historial, corregir y anular"`

---

### Task 9: Página Ventas, ruta, menú y retiro de lo viejo

**Files:**
- Create: `src/features/sales/SalesPage.tsx`, `src/features/sales/SalesPage.test.tsx`
- Modify: `src/features/admin/admin.route.tsx:14,90`, `src/features/admin/AdminLayout.tsx:72`, sus tests
- Delete: `src/features/orders/DeliveredOrdersList.tsx`, `DeliveredOrdersList.test.tsx`, `deliveredOrders.ts`, `deliveredOrders.test.ts`, `deliveredOrders.css`, `ProductSaleSheet.tsx`, `ProductSaleSheet.test.tsx`, `useProductSaleDraft.ts`, `productSaleValidation.ts`, `productSaleValidation.test.ts`, `productSales.api.ts` — **solo después** de Task 10, que deja de importar `deliveredOrders`/`productSales.api` desde Estadísticas. Antes de borrar: `git grep -n "deliveredOrders\|productSales.api\|ProductSaleSheet\|DeliveredOrdersList" src` tiene que dar solo esos archivos.

**Interfaces:**
- Consumes: `listSales` (Task 5), `filterSales`, `salesTotals`, `itemsSummary`, `DEFAULT_FILTERS` (Task 6), `NewSaleSheet`, `SaleDetail`, `periodRange` / `PeriodKind` / `Range` de `@/features/stats/stats`.
- Produces: `export default function SalesPage(): JSX.Element`, ruta `/admin/ventas`.

- [ ] **Step 1: Test que falla**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./sales.api', () => ({
  listSales: vi.fn().mockResolvedValue([
    { id: 'a', sold_at: new Date().toISOString(), channel: 'local', method: 'cash', amount: 23000, list_total: 24800, discount: 1800, operator_id: 'op1', voided_at: null, order_id: null, customers: null, orders: null,
      sale_items: [{ description: 'Vaso Boca', quantity: 1, position: 0 }] },
    { id: 'b', sold_at: new Date().toISOString(), channel: 'web', method: 'transfer', amount: 10000, list_total: 10000, discount: 0, operator_id: null, voided_at: null, order_id: 'o1', customers: { name: 'Juan', wholesale: true }, orders: { id: 'o1', title: 'Trofeos' },
      sale_items: [{ description: 'Trofeos', quantity: 1, position: 0 }] },
  ]),
  getSaleLog: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op1' }, isAdmin: true, byId: () => ({ name: 'Nico' }) }),
}))

import SalesPage from './SalesPage'

describe('SalesPage', () => {
  it('lista ventas de hoy con totales y filtra por canal', async () => {
    render(<MemoryRouter><SalesPage /></MemoryRouter>)
    expect(await screen.findByText('Vaso Boca')).toBeInTheDocument()
    expect(screen.getByText('2 ventas')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'web')
    expect(screen.queryByText('Vaso Boca')).toBeNull()
    expect(screen.getByText('1 venta')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar `SalesPage`.** Encabezado "Ventas" + botón **Nueva venta** (abre `NewSaleSheet`; al guardar recarga). Selector de período reutilizando `periodRange(kind, now)` de stats (`today` por defecto; `week`, `month`, `custom` con dos fechas). Filtros: `<select aria-label="Canal">` (Todos, Sin canal, cada canal), `<select aria-label="Medio">`, `<select aria-label="Vendió">` (operadores), casilla "Solo mayoristas", interruptor "Mostrar anuladas". Totales: `$amount · N venta(s) · Descuentos $X`. Filas (botón que abre `SaleDetail`): hora (o fecha si el período no es hoy), `itemsSummary(sale_items)`, canal, cliente (+ "Mayorista"), cobrado, `-$descuento` si `list_total > amount`, medio, quién (`byId`), "Pedido" si `order_id`; anuladas con clase tachada. Estado vacío: "No hay ventas en este período".
- [ ] **Step 4: Ruta y menú.** En `admin.route.tsx`: importar `SalesPage`, `<Route path="ventas" element={<SalesPage />} />` y reemplazar la de `ventas-pedidos` por `<Route path="ventas-pedidos" element={<Navigate to="/admin/ventas" replace />} />`. En `AdminLayout.tsx:72`: `{ to: '/admin/ventas', label: 'Ventas', icon: 'receipt' }`. Actualizar `admin.route.test.tsx` y `AdminLayout.test.tsx` donde esperen "Entregados" o `ventas-pedidos`.
- [ ] **Step 5: Correr** los tests de `src/features/sales` y `src/features/admin` → PASS.
- [ ] **Step 6: Commit** `git commit -m "feat(ventas): página Ventas con filtros, ruta y menú"`

---

### Task 10: Estadísticas leen el libro de ventas

**Files:**
- Modify: `src/features/stats/stats.ts:98-150`, `src/features/stats/stats.api.ts:37-70`, `stats.test.ts`, `stats.api.test.ts`, `CashTab.test.tsx` (si construye `DeliveredRow` a mano, no cambia)

**Interfaces:**
- Consumes: `SaleWithRefs`, `listSales` (Task 5), `itemsSummary` (Task 6).
- Produces: `export function saleToDeliveredRow(s: SaleWithRefs): DeliveredRow` en `stats.ts`; `loadStats(range)` mantiene su firma y `StatsData.delivered: DeliveredRow[]`.

- [ ] **Step 1: Medir totales actuales ANTES de cambiar nada** (solo lectura, sin OK necesario): en el worktree, script temporal fuera del repo o consulta SQL que replica el cálculo actual por mes:

```sql
with moments as (
  select order_id, max(created_at) at from public.production_events
  where kind='stage' and to_status='delivered' group by order_id),
rows as (
  select coalesce(m.at, (o.due_date::timestamp + time '12:00') at time zone 'America/Argentina/Buenos_Aires') at, coalesce(o.total_amount,0) amount
  from public.orders o left join moments m on m.order_id=o.id where o.status='delivered'
  union all
  select transacted_at, amount from public.transactions where type='product_sale')
select to_char(at at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') mes, sum(amount) total, count(*) n
from rows group by 1 order by 1;
```

Guardar el resultado en el reporte de la tarea.

- [ ] **Step 2: Test que falla** en `stats.test.ts`

```ts
it('saleToDeliveredRow: venta de pedido y de mostrador', () => {
  const base = { sold_at: '2026-11-06T15:00:00Z', amount: 1000, list_total: 1000, method: 'cash', voided_at: null,
    customers: { name: 'Ana', wholesale: false }, sale_items: [{ description: 'Vaso', quantity: 2, position: 0 }] }
  expect(saleToDeliveredRow({ ...base, id: 's1', order_id: 'o1', orders: { id: 'o1', title: 'Vaso' } } as never))
    .toMatchObject({ id: 's1', kind: 'order', at: '2026-11-06T15:00:00Z', exact: true, amount: 1000, productLabel: 'Vaso ×2', href: '/admin/orders/o1' })
  expect(saleToDeliveredRow({ ...base, id: 's2', order_id: null, orders: null } as never))
    .toMatchObject({ kind: 'product', method: 'cash', href: null })
})
```

(Usar el mismo `href` de pedido que hoy produce `orderToVentaRow` en `deliveredOrders.ts`; leerlo antes de borrar ese archivo.)

- [ ] **Step 3: Correr** → FAIL.
- [ ] **Step 4: Implementar.** En `stats.ts`: borrar `toDeliveredRows` y sus imports de `deliveredOrders`/`productSales.api`; agregar

```ts
export function saleToDeliveredRow(s: SaleWithRefs): DeliveredRow {
  return {
    id: s.id,
    kind: s.order_id ? 'order' : 'product',
    at: s.sold_at,
    exact: true,
    customerName: s.customers?.name ?? null,
    productLabel: itemsSummary(s.sale_items),
    amount: Number(s.amount),
    method: (s.method ?? null) as PaymentMethod | null,
    href: s.order_id ? `/admin/orders/${s.order_id}` : null,
  }
}
```

En `stats.api.ts` `loadStats`: reemplazar `listDeliveredOrders()`, `listProductSales()`, `deliveredMoments()` por `listSales(range.from, range.to)` y `delivered = sales.filter((s) => !s.voided_at).map(saleToDeliveredRow)`. `deliveredMoments` se queda (lo usa `summary.api.ts`). Actualizar `stats.api.test.ts` para mockear `listSales`.

- [ ] **Step 5: Correr** `npx vitest run src/features/stats` → PASS.
- [ ] **Step 6: Comparar totales DESPUÉS** (requiere la migración aplicada, Task 2):

```sql
select to_char(sold_at at time zone 'America/Argentina/Buenos_Aires','YYYY-MM') mes, sum(amount) total, count(*) n
from public.sales where voided_at is null group by 1 order by 1;
```

Expected: igual a Step 1 mes por mes, salvo ventas nuevas cargadas después de aplicar la migración. Si difiere, PARAR y mostrar la diferencia al usuario.

- [ ] **Step 7: Borrar los archivos viejos** listados en Task 9 (verificando el `git grep`), correr `npm run typecheck` y `npx vitest run src` → PASS.
- [ ] **Step 8: Commit** `git commit -m "feat(ventas): estadísticas desde el libro de ventas y retiro de Entregados"`

---

### Task 11: Aviso al entregar un pedido

**Files:**
- Modify: `src/features/orders/OrderProduction.tsx`, `src/features/orders/OrdersBoard.tsx`, `OrderProduction.test.tsx`

**Interfaces:**
- Consumes: `getOrderSale(orderId)` (Task 5), el toast existente del repo (buscar con `git grep -n "useToast\|showToast" src`).

- [ ] **Step 1: Test que falla** en `OrderProduction.test.tsx`: al marcar Entregado (mismo flujo que el test existente de cambio de etapa), con `getOrderSale` mockeado a `{ id: 's1', amount: 24800 }`, aparece el texto `Venta registrada: $24.800` y un link "Ver venta" a `/admin/ventas`.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Después de que el cambio de estado a `delivered` vuelve OK, llamar `getOrderSale(order.id)`; si hay venta, mostrar el toast/aviso con el monto formateado con el formateador de moneda del repo. Si `getOrderSale` falla, no mostrar nada (no romper la entrega). Mismo agregado en `OrdersBoard.tsx` donde se mueve una tarjeta a Entregado.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ventas): aviso de venta registrada al entregar"`

---

### Task 12: Verificación final, navegador y PR

- [ ] **Step 1:** `npm run typecheck`, `npm run lint`, `npx vitest run src --exclude ".claude/**"` (Node 22). Todo verde salvo `supabase.smoke.test.ts` si no hay conexión; anotarlo.
- [ ] **Step 2:** `npm run build` → OK.
- [ ] **Step 3: Navegador.** Agregar una entrada local en `.claude/launch.json` de la raíz (no se commitea) para el admin del worktree en un puerto libre; el usuario inicia sesión y pone su PIN. Probar: cargar un ticket con 2 productos y descuento; ver que baja el stock en Productos; corregirlo como admin; anularlo con motivo y ver el stock devuelto y el historial; marcar un pedido de prueba como Entregado y ver el aviso y la fila en Ventas (anular después esa venta de prueba si no corresponde a una entrega real, con OK del usuario). Mobile (375 px): sin scroll horizontal.
- [ ] **Step 4: PR** contra `master`: `git push -u origin feature/libro-ventas` y `gh pr create --base master` con resumen, migración aplicada, comparación de totales (Task 10) y lo no verificado.
- [ ] **Step 5:** Pendiente aparte para el usuario: alinear `products_write` de producción con el repo.

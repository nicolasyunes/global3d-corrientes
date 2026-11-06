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

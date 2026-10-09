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

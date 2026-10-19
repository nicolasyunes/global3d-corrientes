-- Productos para todo el equipo + registro de movimientos.
--
-- Hasta ahora solo el admin escribía productos. Ahora cualquier persona del
-- taller puede crear productos y mover stock; a cambio, todo queda en
-- `product_log` (quién, cuándo, cuánto) y solo el admin lo lee, por RPC.
-- El precio de lista sigue siendo del admin.

alter table public.products
  add column updated_by uuid references public.operators (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Registro. Sin acceso directo por API: se escribe con el trigger de abajo y
-- se lee con list_product_log(). Guarda el nombre como texto para que se siga
-- leyendo aunque después se cambie o desaparezca el producto.
-- ---------------------------------------------------------------------------
create table public.product_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operator_id uuid references public.operators (id) on delete set null,
  kind text not null check (kind in
    ('created', 'in', 'out', 'adjust', 'sale', 'edited')),
  product_id uuid references public.products (id) on delete set null,
  product_label text not null,
  delta integer,
  stock_after integer,
  note text
);
create index product_log_created_at_idx on public.product_log (created_at desc);
create index product_log_product_idx on public.product_log (product_id);

alter table public.product_log enable row level security;
revoke all on public.product_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: todo cambio de stock o de ficha deja una fila, venga de donde venga
-- (pantalla, RPC, venta directa). Quién lo hizo: lo que fije el RPC/la venta
-- en la transacción, o si no `updated_by` que manda la pantalla.
-- ---------------------------------------------------------------------------
create or replace function public.log_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_op uuid;
  v_changes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.product_log
      (operator_id, kind, product_id, product_label, delta, stock_after)
    values (new.updated_by, 'created', new.id, new.name,
            new.stock_quantity, new.stock_quantity);
    return new;
  end if;

  v_op := coalesce(
    nullif(current_setting('app.stock_operator', true), '')::uuid,
    new.updated_by
  );

  if new.stock_quantity <> old.stock_quantity then
    v_kind := coalesce(nullif(current_setting('app.stock_kind', true), ''), 'adjust');
    insert into public.product_log
      (operator_id, kind, product_id, product_label, delta, stock_after, note)
    values (v_op, v_kind, new.id, new.name,
            new.stock_quantity - old.stock_quantity, new.stock_quantity,
            nullif(current_setting('app.stock_note', true), ''));
  end if;

  if new.name is distinct from old.name then
    v_changes := v_changes || ('Nombre: ' || old.name || ' → ' || new.name);
  end if;
  if new.active is distinct from old.active then
    v_changes := v_changes ||
      case when new.active then 'Activado' else 'Pausado' end;
  end if;
  if new.base_price is distinct from old.base_price then
    v_changes := v_changes || ('Precio: ' || coalesce(old.base_price::text, '—')
      || ' → ' || coalesce(new.base_price::text, '—'));
  end if;
  if array_length(v_changes, 1) > 0 then
    insert into public.product_log
      (operator_id, kind, product_id, product_label, stock_after, note)
    values (v_op, 'edited', new.id, new.name, new.stock_quantity,
            array_to_string(v_changes, ' · '));
  end if;

  return new;
end;
$$;

create trigger trg_products_log
  after insert or update on public.products
  for each row execute function public.log_product_change();

-- La venta directa descuenta stock: que figure como venta y de quién.
create or replace function public.consume_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'product_sale' and new.product_id is not null and new.quantity is not null then
    perform set_config('app.stock_kind', 'sale', true);
    perform set_config('app.stock_operator', coalesce(new.operator_id::text, ''), true);
    perform set_config('app.stock_note', '', true);
    update public.products
      set stock_quantity = stock_quantity - new.quantity
      where id = new.product_id;
    if not found then
      raise exception 'product row % not found', new.product_id;
    end if;
    perform set_config('app.stock_kind', '', true);
    perform set_config('app.stock_operator', '', true);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mover stock (suma o resta) de forma atómica, con motivo y nota.
-- ---------------------------------------------------------------------------
create or replace function public.move_product_stock(
  p_product uuid,
  p_delta integer,
  p_operator uuid,
  p_note text default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.products;
begin
  if not exists (
    select 1 from public.operators where id = p_operator and active
  ) then
    raise exception 'No se reconoce a la persona que mueve el stock';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;

  perform set_config('app.stock_kind', case when p_delta > 0 then 'in' else 'out' end, true);
  perform set_config('app.stock_operator', p_operator::text, true);
  perform set_config('app.stock_note', coalesce(nullif(trim(p_note), ''), ''), true);

  update public.products
    set stock_quantity = greatest(0, stock_quantity + p_delta),
        updated_by = p_operator
    where id = p_product
    returning * into v_row;
  if not found then
    raise exception 'No se encontró el producto';
  end if;

  perform set_config('app.stock_kind', '', true);
  perform set_config('app.stock_operator', '', true);
  perform set_config('app.stock_note', '', true);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leer el registro: solo un admin (el equipo comparte una sola sesión de
-- Supabase, así que se valida a la persona, igual que resolve_stock_count).
-- ---------------------------------------------------------------------------
create or replace function public.list_product_log(
  p_operator uuid,
  p_before timestamptz default null,
  p_limit integer default 100
)
returns setof public.product_log
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede ver el registro';
  end if;
  return query
    select * from public.product_log
    where p_before is null or created_at < p_before
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.move_product_stock(uuid, integer, uuid, text)
  from public, anon;
revoke execute on function public.list_product_log(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.move_product_stock(uuid, integer, uuid, text)
  to authenticated;
grant execute on function public.list_product_log(uuid, timestamptz, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Escritura abierta al taller: productos, piezas y fotos (tabla y bucket).
-- El precio de lista queda para el admin en la pantalla; como el taller
-- comparte una sesión, la base no lo distingue, pero todo cambio de precio
-- queda anotado en el registro.
-- ---------------------------------------------------------------------------
drop policy if exists products_write on public.products;
create policy products_write
  on public.products for all to authenticated using (true) with check (true);

drop policy if exists product_parts_write on public.product_parts;
create policy product_parts_write
  on public.product_parts for all to authenticated using (true) with check (true);

drop policy if exists product_images_all on public.product_images;
create policy product_images_all
  on public.product_images for all to authenticated using (true) with check (true);

drop policy if exists product_images_admin_write on storage.objects;
drop policy if exists product_images_admin_update on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_team_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy product_images_team_update
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
create policy product_images_team_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');

-- Permiso por persona para cargar y editar productos (antes: solo admin).
-- El admin lo habilita desde Personas confirmando con su PIN. Cada cambio de
-- un producto queda en product_log con quién lo hizo (updated_by).

alter table public.operators
  add column if not exists can_manage_products boolean not null default false;

-- Agustina ya carga productos.
update public.operators set can_manage_products = true
  where lower(name) in ('agus', 'agustina');

create or replace function public.set_operator_products(
  p_operator uuid,
  p_value boolean,
  p_admin uuid,
  p_admin_pin text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1 from public.operators
    where id = p_admin and role = 'admin' and active
      and pin_hash = extensions.crypt(p_admin_pin, pin_hash)
  ) then
    raise exception 'Se necesita un administrador con PIN válido';
  end if;
  update public.operators
    set can_manage_products = coalesce(p_value, false)
    where id = p_operator;
end;
$$;

revoke all on function public.set_operator_products(uuid, boolean, uuid, text)
  from public, anon;
grant execute on function public.set_operator_products(uuid, boolean, uuid, text)
  to authenticated;

-- Registro: además de nombre, precio, estado y stock, anota cambios de
-- descripción, y un "Guardado" cuando se guardó la ficha sin tocar esos campos
-- (piezas, fotos o tienda), para que igual quede quién fue.
create or replace function public.log_product_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind text;
  v_op uuid;
  v_changes text[] := '{}';
  v_stock_changed boolean;
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
  v_stock_changed := new.stock_quantity <> old.stock_quantity;

  if v_stock_changed then
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
  if new.description is distinct from old.description then
    v_changes := v_changes || 'Descripción'::text;
  end if;

  if array_length(v_changes, 1) > 0 then
    insert into public.product_log
      (operator_id, kind, product_id, product_label, stock_after, note)
    values (v_op, 'edited', new.id, new.name, new.stock_quantity,
            array_to_string(v_changes, ' · '));
  elsif not v_stock_changed
    and new.image_url is not distinct from old.image_url
    and new.updated_by is not null then
    insert into public.product_log
      (operator_id, kind, product_id, product_label, stock_after, note)
    values (v_op, 'edited', new.id, new.name, new.stock_quantity,
            'Guardado (piezas, fotos o tienda)');
  end if;

  return new;
end;
$$;

-- La app lee operators por columnas (pin_hash queda oculto).
grant select (can_manage_products) on public.operators to authenticated;

-- El equipo puede leer el historial de productos (lo escribe solo el trigger).
grant select on public.product_log to authenticated;
drop policy if exists product_log_read on public.product_log;
create policy product_log_read on public.product_log
  for select to authenticated using (true);

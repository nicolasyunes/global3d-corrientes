-- Fase 1 del taller: personas con PIN (operators), piezas por ítem con color,
-- contador y estado (evolución de order_production_tasks) e historial
-- automático (production_events). Todos comparten una única sesión de Supabase
-- ("cuenta del taller"), así que la persona que actúa viaja como operador
-- explícito (tasks.updated_by / parámetros de RPC), no como auth.uid().

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- operators
-- ---------------------------------------------------------------------------
create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  initials text not null check (length(initials) between 1 and 3),
  color text not null default '#F37021',
  role text not null default 'operator' check (role in ('admin', 'operator')),
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;
create policy operators_select
  on public.operators for select to authenticated using (true);
-- Sin políticas de escritura: altas y PIN sólo vía RPC security definer.

-- El hash del PIN nunca se expone por la Data API.
revoke all on public.operators from anon, authenticated;
grant select (id, name, initials, color, role, active, created_at)
  on public.operators to authenticated;

create or replace function public.verify_operator_pin(p_operator uuid, p_pin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.operators o
    where o.id = p_operator
      and o.active
      and o.pin_hash = extensions.crypt(p_pin, o.pin_hash)
  );
$$;

-- Alta de operador. Permitida sin verificación sólo cuando no hay ninguno
-- (primer uso: crea al dueño). Después exige un admin activo con su PIN.
create or replace function public.create_operator(
  p_name text,
  p_initials text,
  p_color text,
  p_role text,
  p_pin text,
  p_admin uuid default null,
  p_admin_pin text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_first boolean := not exists (select 1 from public.operators);
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener 4 dígitos';
  end if;
  if not v_first then
    if not exists (
      select 1 from public.operators
      where id = p_admin and role = 'admin' and active
        and pin_hash = extensions.crypt(p_admin_pin, pin_hash)
    ) then
      raise exception 'Se necesita un administrador con PIN válido';
    end if;
  end if;

  insert into public.operators (name, initials, color, role, pin_hash)
  values (
    trim(p_name),
    upper(trim(p_initials)),
    coalesce(p_color, '#F37021'),
    case when v_first then 'admin' else coalesce(p_role, 'operator') end,
    extensions.crypt(p_pin, extensions.gen_salt('bf'))
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_operator_pin(
  p_operator uuid,
  p_new_pin text,
  p_admin uuid,
  p_admin_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener 4 dígitos';
  end if;
  if not exists (
    select 1 from public.operators
    where id = p_admin and role = 'admin' and active
      and pin_hash = extensions.crypt(p_admin_pin, pin_hash)
  ) then
    raise exception 'Se necesita un administrador con PIN válido';
  end if;
  update public.operators
    set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf'))
    where id = p_operator;
end;
$$;

revoke execute on function public.verify_operator_pin(uuid, text) from public, anon;
revoke execute on function public.create_operator(text, text, text, text, text, uuid, text) from public, anon;
revoke execute on function public.set_operator_pin(uuid, text, uuid, text) from public, anon;
grant execute on function public.verify_operator_pin(uuid, text) to authenticated;
grant execute on function public.create_operator(text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.set_operator_pin(uuid, text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Piezas: evolución de order_production_tasks
-- ---------------------------------------------------------------------------
alter table public.order_production_tasks
  add column order_item_id uuid references public.order_items (id) on delete cascade,
  add column color text,
  add column quantity_total integer not null default 1 check (quantity_total > 0),
  add column quantity_done integer not null default 0,
  add column status text not null default 'pending'
    check (status in ('pending', 'printing', 'done')),
  add column updated_by uuid references public.operators (id) on delete set null;

update public.order_production_tasks
  set status = case when done then 'done' else 'pending' end,
      quantity_done = case when done then 1 else 0 end;

alter table public.order_production_tasks
  drop column done,
  add constraint order_production_tasks_done_range
    check (quantity_done between 0 and quantity_total);

create index order_production_tasks_item_idx
  on public.order_production_tasks (order_item_id);
create index order_production_tasks_open_idx
  on public.order_production_tasks (order_id) where status <> 'done';
create index order_production_tasks_updated_by_idx
  on public.order_production_tasks (updated_by);

-- Contador y estado se mantienen coherentes en la base, sin importar desde
-- dónde se escriba.
create or replace function public.normalize_production_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.quantity_done is not distinct from old.quantity_done then
    -- Cambio manual de estado.
    if new.status = 'done' then
      new.quantity_done := new.quantity_total;
    elsif new.status = 'pending' then
      new.quantity_done := 0;
    elsif new.quantity_done >= new.quantity_total then
      new.quantity_done := greatest(new.quantity_total - 1, 0);
    end if;
  else
    new.quantity_done := least(greatest(new.quantity_done, 0), new.quantity_total);
    if new.quantity_done >= new.quantity_total then
      new.status := 'done';
    elsif new.quantity_done > 0 then
      new.status := 'printing';
    elsif tg_op = 'UPDATE' and old.status = 'done' then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_normalize_production_task
  before insert or update on public.order_production_tasks
  for each row execute function public.normalize_production_task();

-- ---------------------------------------------------------------------------
-- Historial
-- ---------------------------------------------------------------------------
create table public.production_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  task_id uuid references public.order_production_tasks (id) on delete set null,
  operator_id uuid references public.operators (id) on delete set null,
  kind text not null check (kind in ('created', 'status', 'count', 'failed', 'deleted')),
  label text not null,
  from_status text,
  to_status text,
  delta integer,
  created_at timestamptz not null default now()
);
create index production_events_order_idx
  on public.production_events (order_id, created_at desc);
create index production_events_task_idx on public.production_events (task_id);
create index production_events_operator_idx on public.production_events (operator_id);

alter table public.production_events enable row level security;
create policy production_events_select
  on public.production_events for select to authenticated using (true);
-- Sólo triggers y RPCs (security definer) insertan eventos.
revoke all on public.production_events from anon, authenticated;
grant select on public.production_events to authenticated;

create or replace function public.log_production_task_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.production_events (order_id, task_id, operator_id, kind, label, to_status, delta)
    values (new.order_id, new.id, new.updated_by, 'created', new.label, new.status, new.quantity_done);
  elsif tg_op = 'UPDATE' then
    if new.quantity_done is distinct from old.quantity_done then
      insert into public.production_events (order_id, task_id, operator_id, kind, label, from_status, to_status, delta)
      values (new.order_id, new.id, new.updated_by, 'count', new.label, old.status, new.status,
              new.quantity_done - old.quantity_done);
    elsif new.status is distinct from old.status then
      insert into public.production_events (order_id, task_id, operator_id, kind, label, from_status, to_status)
      values (new.order_id, new.id, new.updated_by, 'status', new.label, old.status, new.status);
    end if;
  elsif tg_op = 'DELETE' then
    -- En un borrado en cascada del pedido no hay a quién colgarle el evento.
    if exists (select 1 from public.orders where id = old.order_id) then
      insert into public.production_events (order_id, task_id, operator_id, kind, label, from_status)
      values (old.order_id, null, old.updated_by, 'deleted', old.label, old.status);
    end if;
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_log_production_task_event
  after insert or update or delete on public.order_production_tasks
  for each row execute function public.log_production_task_event();

-- Primera pieza en marcha => el pedido pasa a "Imprimiendo".
create or replace function public.bump_order_to_printing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('printing', 'done')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.orders
      set status = 'printing'
      where id = new.order_id and status in ('new', 'in_queue');
  end if;
  return new;
end;
$$;

-- Sin "of status": el estado muchas veces lo cambia el trigger BEFORE a partir
-- del contador, y "update of" sólo mira las columnas del SET.
create trigger trg_bump_order_to_printing
  after insert or update on public.order_production_tasks
  for each row execute function public.bump_order_to_printing();

revoke execute on function public.log_production_task_event() from public, anon, authenticated;
revoke execute on function public.bump_order_to_printing() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de piso de taller
-- ---------------------------------------------------------------------------

-- +N atómico: dos celulares sumando a la vez no se pisan.
create or replace function public.increment_task(p_task uuid, p_delta integer, p_operator uuid)
returns public.order_production_tasks
language sql
set search_path = ''
as $$
  update public.order_production_tasks
    set quantity_done = quantity_done + p_delta,
        updated_by = p_operator
    where id = p_task
  returning *;
$$;

create or replace function public.register_task_failure(p_task uuid, p_operator uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.production_events (order_id, task_id, operator_id, kind, label, to_status, delta)
  select t.order_id, t.id, p_operator, 'failed', t.label, t.status, 1
  from public.order_production_tasks t
  where t.id = p_task;
$$;

revoke execute on function public.increment_task(uuid, integer, uuid) from public, anon;
revoke execute on function public.register_task_failure(uuid, uuid) from public, anon;
grant execute on function public.increment_task(uuid, integer, uuid) to authenticated;
grant execute on function public.register_task_failure(uuid, uuid) to authenticated;

-- Rediseño Pedidos y Taller: el posprocesado (lijar / pintar) es del pedido
-- completo y la etapa del pedido se calcula sola a partir de sus piezas.
-- El stepper puede fijarla a mano (stage_manual) hasta que se vuelva a
-- "automático".

alter table public.orders
  add column if not exists pp_sand boolean not null default false,
  add column if not exists pp_paint boolean not null default false,
  add column if not exists pp_notes text,
  add column if not exists sand_done boolean not null default false,
  add column if not exists paint_done boolean not null default false,
  add column if not exists stage_manual boolean not null default false;

-- ---------------------------------------------------------------------------
-- Etapa calculada
-- ---------------------------------------------------------------------------
create or replace function public.recompute_order_stage(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_total integer;
  v_pending integer;
  v_done integer;
  v_stage public.order_status;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  -- Entregado y cancelado son decisiones de una persona; "en espera" no entra
  -- al taller; una etapa fijada a mano no se pisa.
  if o.status in ('delivered', 'cancelled') or o.stage_manual
     or o.waiting_reason is not null then
    return;
  end if;

  select count(*),
         count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'done')
    into v_total, v_pending, v_done
    from public.order_production_tasks
    where order_id = p_order;

  -- Sin piezas cargadas no hay nada que calcular.
  if v_total = 0 then return; end if;

  if v_pending = v_total then
    v_stage := 'new';
  elsif v_done < v_total then
    v_stage := 'printing';
  elsif (o.pp_sand and not o.sand_done) or (o.pp_paint and not o.paint_done) then
    v_stage := 'post_processing';
  else
    v_stage := 'finished';
  end if;

  if v_stage is distinct from o.status then
    update public.orders set status = v_stage where id = p_order;
  end if;
end;
$$;

create or replace function public.trg_task_recompute_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_order_stage(old.order_id);
    return old;
  end if;
  perform public.recompute_order_stage(new.order_id);
  return new;
end;
$$;

-- Reemplaza al trigger que sólo sabía pasar a "Imprimiendo".
drop trigger if exists trg_bump_order_to_printing on public.order_production_tasks;
drop function if exists public.bump_order_to_printing();

drop trigger if exists trg_task_recompute_stage on public.order_production_tasks;
create trigger trg_task_recompute_stage
  after insert or update or delete on public.order_production_tasks
  for each row execute function public.trg_task_recompute_stage();

create or replace function public.trg_order_recompute_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_order_stage(new.id);
  return new;
end;
$$;

-- "update of": sólo cuando cambia algo que afecta a la etapa (el propio
-- cambio de status no vuelve a disparar).
drop trigger if exists trg_order_recompute_stage on public.orders;
create trigger trg_order_recompute_stage
  after update of pp_sand, pp_paint, sand_done, paint_done, stage_manual, waiting_reason
  on public.orders
  for each row execute function public.trg_order_recompute_stage();

revoke execute on function public.recompute_order_stage(uuid) from public, anon, authenticated;
revoke execute on function public.trg_task_recompute_stage() from public, anon, authenticated;
revoke execute on function public.trg_order_recompute_stage() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Actividad del pedido (además de la de las piezas)
-- ---------------------------------------------------------------------------
alter table public.production_events
  drop constraint if exists production_events_kind_check;
alter table public.production_events
  add constraint production_events_kind_check
  check (kind in ('created', 'status', 'count', 'failed', 'deleted', 'edited',
                  'stage', 'priority', 'postprocess', 'payment'));

create or replace function public.log_order_event(
  p_order uuid,
  p_operator uuid,
  p_kind text,
  p_label text,
  p_delta integer default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.production_events (order_id, operator_id, kind, label, delta)
  select p_order, p_operator, p_kind, p_label, p_delta
  where p_kind in ('stage', 'priority', 'postprocess', 'payment', 'edited')
    and exists (select 1 from public.orders where id = p_order);
$$;

revoke execute on function public.log_order_event(uuid, uuid, text, text, integer) from public, anon;
grant execute on function public.log_order_event(uuid, uuid, text, text, integer) to authenticated;

-- Cada cambio de etapa (automático o a mano) queda en el historial: de ahí
-- salen las fechas que el stepper muestra bajo cada paso.
create or replace function public.log_order_stage_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.production_events (order_id, kind, label, from_status, to_status)
    values (new.id, 'stage', new.status::text, old.status::text, new.status::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_stage_event on public.orders;
create trigger trg_log_order_stage_event
  after update of status on public.orders
  for each row execute function public.log_order_stage_event();

revoke execute on function public.log_order_stage_event() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pedidos que ya existían
-- ---------------------------------------------------------------------------
-- Su etapa se puso a mano (o vino de la planilla) y no siempre coincide con
-- las piezas cargadas. No se toca nada de eso: los que no coinciden quedan
-- con la etapa "fijada a mano" hasta que alguien los vuelva a automático.
with calc as (
  select o.id,
         case
           when count(t.id) = 0 then o.status
           when count(t.id) filter (where t.status = 'pending') = count(t.id)
             then 'new'::public.order_status
           when count(t.id) filter (where t.status = 'done') < count(t.id)
             then 'printing'::public.order_status
           else 'finished'::public.order_status
         end as stage
    from public.orders o
    left join public.order_production_tasks t on t.order_id = o.id
   where o.status not in ('delivered', 'cancelled')
     and o.waiting_reason is null
   group by o.id, o.status
)
update public.orders o
   set stage_manual = true
  from calc
 where calc.id = o.id
   and calc.stage is distinct from
       (case when o.status = 'in_queue' then 'new'::public.order_status else o.status end);

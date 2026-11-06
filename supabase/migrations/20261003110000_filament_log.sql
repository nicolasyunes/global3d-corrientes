-- Registro de actividad de filamentos: todo lo que entra, sale o se crea/borra,
-- con quién y cuándo. Es solo para control: la app lee y agrega, nunca edita ni
-- borra. Guarda los nombres como texto para que siga leyéndose aunque después
-- se borre la línea o el color.

create table public.filament_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operator_id uuid references public.operators (id) on delete set null,
  kind text not null check (kind in (
    'purchase', 'used', 'adjust',
    'color_added', 'color_removed', 'line_added', 'line_removed'
  )),
  line_label text not null,
  color_label text,
  refill boolean not null default false,
  delta integer,
  note text
);
create index filament_log_created_at_idx on public.filament_log (created_at desc);

alter table public.filament_log enable row level security;
create policy filament_log_read
  on public.filament_log for select to authenticated using (true);
create policy filament_log_add
  on public.filament_log for insert to authenticated with check (true);
grant select, insert on public.filament_log to authenticated;

-- Lo que ya estaba en el historial por línea pasa al registro.
insert into public.filament_log
  (created_at, operator_id, kind, line_label, color_label, refill, delta, note)
select m.created_at, m.operator_id, m.kind, l.brand || ' ' || l.name, c.name,
       m.refill, m.delta, m.note
from public.filament_movements m
join public.filament_colors c on c.id = m.color_id
join public.filament_lines l on l.id = c.line_id;

-- Mover stock ahora también deja la fila en el registro, en el mismo paso.
create or replace function public.move_filament(
  p_color uuid,
  p_refill boolean,
  p_delta integer,
  p_kind text,
  p_operator uuid,
  p_note text default null
)
returns public.filament_colors
language plpgsql
set search_path = ''
as $$
declare
  v_row public.filament_colors;
  v_before integer;
  v_after integer;
  v_line text;
begin
  select * into v_row from public.filament_colors where id = p_color for update;
  if not found then
    raise exception 'filament color % not found', p_color;
  end if;

  v_before := case when p_refill then coalesce(v_row.stock_refill, 0) else v_row.stock end;
  v_after := greatest(0, v_before + p_delta);

  if p_refill then
    update public.filament_colors set stock_refill = v_after where id = p_color
      returning * into v_row;
  else
    update public.filament_colors set stock = v_after where id = p_color
      returning * into v_row;
  end if;

  if v_after <> v_before then
    insert into public.filament_movements (color_id, refill, delta, kind, note, operator_id)
    values (p_color, p_refill, v_after - v_before, p_kind, p_note, p_operator);

    select brand || ' ' || name into v_line
      from public.filament_lines where id = v_row.line_id;
    insert into public.filament_log
      (operator_id, kind, line_label, color_label, refill, delta, note)
    values (p_operator, p_kind, v_line, v_row.name, p_refill, v_after - v_before, p_note);
  end if;

  return v_row;
end;
$$;

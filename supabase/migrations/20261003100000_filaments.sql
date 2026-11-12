-- Filamentos: stock de bobinas de 1 kg por línea (marca + nombre) y color,
-- con historial de movimientos (compras, lo que se termina en el taller y
-- ajustes). Reemplaza a la vieja tabla inventory, que queda sin tocar.
-- Una línea puede venderse con spool, como recarga, o de las dos formas
-- (Bambu Lab PLA Lite): entonces cada color lleva dos stocks.

create table public.filament_lines (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(trim(brand)) > 0),
  name text not null check (length(trim(name)) > 0),
  material text not null default 'PLA'
    check (material in ('PLA', 'PLA especial', 'PETG', 'TPU', 'Otro')),
  presentation text not null default 'spool'
    check (presentation in ('spool', 'refill', 'both')),
  -- Precio por bobina; con 'both' es el de la bobina con spool.
  price numeric(12, 2),
  refill_price numeric(12, 2),
  accent text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_filament_lines_updated_at
  before update on public.filament_lines
  for each row execute function public.set_updated_at();

create table public.filament_colors (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.filament_lines (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Color de la muestra: un hex o un degradé CSS para sedas y multicolor.
  swatch text not null default '#b8b0a6',
  finish text not null default 'Estándar',
  -- Vacío = usa el precio de la línea.
  price numeric(12, 2),
  stock integer not null default 0 check (stock >= 0),
  -- Solo para líneas 'both': stock de recargas (null = no viene como recarga)
  -- y si el color se consigue con spool.
  stock_refill integer check (stock_refill >= 0),
  spool_available boolean not null default true,
  min_stock integer not null default 1 check (min_stock >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index filament_colors_line_id_idx on public.filament_colors (line_id);

create trigger trg_filament_colors_updated_at
  before update on public.filament_colors
  for each row execute function public.set_updated_at();

create table public.filament_movements (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references public.filament_colors (id) on delete cascade,
  refill boolean not null default false,
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('purchase', 'used', 'adjust')),
  note text,
  operator_id uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now()
);
create index filament_movements_color_id_idx
  on public.filament_movements (color_id, created_at desc);

alter table public.filament_lines enable row level security;
alter table public.filament_colors enable row level security;
alter table public.filament_movements enable row level security;

create policy filament_lines_all
  on public.filament_lines for all to authenticated using (true) with check (true);
create policy filament_colors_all
  on public.filament_colors for all to authenticated using (true) with check (true);
create policy filament_movements_all
  on public.filament_movements for all to authenticated using (true) with check (true);

grant select, insert, update, delete
  on public.filament_lines, public.filament_colors, public.filament_movements
  to authenticated;

-- Mueve el stock de un color y deja el movimiento en el historial, en un solo
-- paso. Nunca baja de cero: el movimiento guarda lo que de verdad cambió.
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
  end if;

  return v_row;
end;
$$;

revoke execute on function public.move_filament(uuid, boolean, integer, text, uuid, text)
  from public, anon;
grant execute on function public.move_filament(uuid, boolean, integer, text, uuid, text)
  to authenticated;

-- La pieza puede llevar el filamento elegido; el texto de color sigue siendo
-- lo que se muestra y agrupa en el taller.
alter table public.order_production_tasks
  add column filament_color_id uuid
    references public.filament_colors (id) on delete set null;
create index order_production_tasks_filament_color_id_idx
  on public.order_production_tasks (filament_color_id);

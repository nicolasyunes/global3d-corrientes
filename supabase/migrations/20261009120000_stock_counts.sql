-- Control de filamentos (entrega 3): conteo semanal del estante, a ciegas.
-- Quien cuenta manda solo lo que contó; la base guarda lo que el sistema
-- esperaba en ese momento. El admin aprueba o descarta; aprobar genera
-- ajustes 'count' solo en las filas con diferencia.

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  -- Momento en que se cerró el conteo.
  created_at timestamptz not null default now(),
  operator_id uuid references public.operators (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'discarded')),
  resolved_at timestamptz,
  resolved_by uuid references public.operators (id) on delete set null,
  check ((status = 'pending') = (resolved_at is null))
);
create index stock_counts_created_at_idx on public.stock_counts (created_at desc);

create table public.stock_count_items (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts (id) on delete cascade,
  color_id uuid references public.filament_colors (id) on delete set null,
  -- Nombres como texto, igual que filament_log: se leen aunque se borre el color.
  line_label text not null,
  color_label text not null,
  refill boolean not null default false,
  counted integer not null check (counted >= 0),
  expected integer not null check (expected >= 0)
);
create index stock_count_items_count_idx on public.stock_count_items (count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
create policy stock_counts_read
  on public.stock_counts for select to authenticated using (true);
create policy stock_count_items_read
  on public.stock_count_items for select to authenticated using (true);
-- Sin insert/update/delete por API: se cuenta y se resuelve solo por RPC.
revoke all on public.stock_counts, public.stock_count_items from anon, authenticated;
grant select on public.stock_counts, public.stock_count_items to authenticated;

-- ---------------------------------------------------------------------------
-- Cerrar un conteo: guarda lo contado y lo que el sistema esperaba.
-- ---------------------------------------------------------------------------
create or replace function public.submit_stock_count(
  p_operator uuid,
  p_items jsonb
)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts;
  v_total integer;
  v_inserted integer;
begin
  if not exists (
    select 1 from public.operators where id = p_operator and active
  ) then
    raise exception 'No se reconoce a la persona que cuenta';
  end if;
  if exists (select 1 from public.stock_counts where status = 'pending') then
    raise exception 'Ya hay un conteo esperando revisión del dueño';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Contá al menos un color';
  end if;
  v_total := jsonb_array_length(p_items);

  -- Valores válidos y sin repetidos.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
    where i.color_id is null or i.counted is null or i.counted < 0
  ) then
    raise exception 'Hay cantidades inválidas';
  end if;
  if (
    select count(distinct (i.color_id, coalesce(i.refill, false)))
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
  ) <> v_total then
    raise exception 'Hay colores repetidos en el conteo';
  end if;
  -- Recarga solo donde la línea tiene stock de recarga.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
    join public.filament_colors c on c.id = i.color_id
    where coalesce(i.refill, false) and c.stock_refill is null
  ) then
    raise exception 'Ese color no tiene recarga';
  end if;

  insert into public.stock_counts (operator_id) values (p_operator)
    returning * into v_count;

  insert into public.stock_count_items
    (count_id, color_id, line_label, color_label, refill, counted, expected)
  select v_count.id, c.id, l.brand || ' ' || l.name, c.name,
         coalesce(i.refill, false), i.counted,
         case when coalesce(i.refill, false) then coalesce(c.stock_refill, 0)
              else c.stock end
  from jsonb_to_recordset(p_items) as i(color_id uuid, refill boolean, counted integer)
  join public.filament_colors c on c.id = i.color_id
  join public.filament_lines l on l.id = c.line_id;

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_total then
    raise exception 'Hay colores que ya no existen; recargá la pantalla';
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aprobar o descartar un conteo: solo admin. Aprobar ajusta el stock en la
-- diferencia contado − esperado (no a un valor absoluto), así no pisa ventas
-- hechas entre el conteo y la revisión.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_stock_count(
  p_count uuid,
  p_operator uuid,
  p_approve boolean
)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count public.stock_counts;
  v_who text;
  v_item public.stock_count_items;
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede revisar conteos';
  end if;

  select * into v_count from public.stock_counts where id = p_count for update;
  if not found then
    raise exception 'No se encontró el conteo';
  end if;
  if v_count.status <> 'pending' then
    raise exception 'Este conteo ya se resolvió';
  end if;

  if p_approve then
    select coalesce(name, 'alguien') into v_who
      from public.operators where id = v_count.operator_id;
    v_who := coalesce(v_who, 'alguien');

    for v_item in
      select * from public.stock_count_items
      where count_id = p_count and color_id is not null and counted <> expected
      order by line_label, color_label
    loop
      perform public.move_filament(
        v_item.color_id, v_item.refill, v_item.counted - v_item.expected,
        'count', p_operator,
        'Conteo de ' || v_who || ' ('
          || to_char(v_count.created_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
          || '): contó ' || v_item.counted || ', esperado ' || v_item.expected
      );
    end loop;
  end if;

  update public.stock_counts
    set status = case when p_approve then 'approved' else 'discarded' end,
        resolved_at = now(), resolved_by = p_operator
    where id = p_count
    returning * into v_count;

  return v_count;
end;
$$;

revoke execute on function public.submit_stock_count(uuid, jsonb) from public, anon;
revoke execute on function public.resolve_stock_count(uuid, uuid, boolean) from public, anon;
grant execute on function public.submit_stock_count(uuid, jsonb) to authenticated;
grant execute on function public.resolve_stock_count(uuid, uuid, boolean) to authenticated;

-- La nota que deja una venta en el registro de filamentos pasa a leerse como
-- en la app: "2 × $12.000 = $24.000 · efectivo · cliente".

create or replace function public.ars(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$' || replace(to_char(round(p), 'FM999,999,999,990'), ',', '.');
$$;

revoke execute on function public.ars(numeric) from public, anon;
grant execute on function public.ars(numeric) to authenticated;

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
    p_qty || ' × ' || public.ars(v_price) || ' = ' || public.ars(v_price * p_qty)
      || ' · '
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

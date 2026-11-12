-- Venta de filamento con pago mixto: parte en efectivo y el resto por
-- transferencia MP. payment = 'mixed' guarda en cash_amount lo que entró en
-- efectivo; la transferencia es total - cash_amount.
-- Aplicada en Supabase el 2026-11-12 vía MCP.

alter table public.filament_sales
  drop constraint filament_sales_payment_check,
  add constraint filament_sales_payment_check
    check (payment in ('cash', 'transfer', 'mixed')),
  add column cash_amount numeric(12, 2),
  add constraint filament_sales_cash_amount_check check (
    (payment = 'mixed') = (cash_amount is not null)
    and (cash_amount is null
         or (cash_amount > 0 and cash_amount < quantity * unit_price))
  );

comment on column public.filament_sales.cash_amount is
  'Solo pago mixto: lo cobrado en efectivo; el resto (total - cash_amount) fue por transferencia MP.';

-- Se agrega p_cash_amount (opcional, al final): hay que reemplazar la firma.
drop function public.sell_filament(uuid, boolean, integer, text, uuid, text);

create function public.sell_filament(
  p_color uuid,
  p_refill boolean,
  p_qty integer,
  p_payment text,
  p_operator uuid,
  p_customer text default null,
  p_cash_amount numeric default null
)
returns public.filament_sales
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_color public.filament_colors;
  v_line public.filament_lines;
  v_price numeric(12, 2);
  v_have integer;
  v_customer text := nullif(trim(p_customer), '');
  v_cash numeric(12, 2);
  v_how text;
  v_sale public.filament_sales;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'La cantidad tiene que ser 1 o más';
  end if;
  if p_payment is null or p_payment not in ('cash', 'transfer', 'mixed') then
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

  if p_payment = 'mixed' then
    v_cash := round(p_cash_amount, 2);
    if v_cash is null or v_cash <= 0 or v_cash >= v_price * p_qty then
      raise exception 'En pago mixto, el efectivo tiene que ser más que 0 y menos que el total (%)',
        public.ars(v_price * p_qty);
    end if;
  end if;

  v_have := case when p_refill then coalesce(v_color.stock_refill, 0)
                 else v_color.stock end;
  if v_have < p_qty then
    raise exception 'No hay stock suficiente (quedan %)', v_have;
  end if;

  v_how := case p_payment
    when 'cash' then 'efectivo'
    when 'transfer' then 'transferencia MP'
    else 'mixto: ' || public.ars(v_cash) || ' efectivo + '
      || public.ars(v_price * p_qty - v_cash) || ' transferencia MP'
  end;

  perform public.move_filament(
    p_color, p_refill, -p_qty, 'sale', p_operator,
    p_qty || ' × ' || public.ars(v_price) || ' = ' || public.ars(v_price * p_qty)
      || ' · ' || v_how
      || coalesce(' · ' || v_customer, '')
  );

  insert into public.filament_sales
    (operator_id, color_id, line_label, color_label, refill, quantity,
     unit_price, payment, cash_amount, customer)
  values
    (p_operator, p_color, v_line.brand || ' ' || v_line.name, v_color.name,
     p_refill, p_qty, v_price, p_payment, v_cash, v_customer)
  returning * into v_sale;

  return v_sale;
end;
$function$;

revoke all on function public.sell_filament(uuid, boolean, integer, text, uuid, text, numeric) from public, anon;
grant execute on function public.sell_filament(uuid, boolean, integer, text, uuid, text, numeric) to authenticated, service_role;

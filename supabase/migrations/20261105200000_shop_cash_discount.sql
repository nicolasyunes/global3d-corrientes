-- Descuento por pagar en efectivo o transferencia en la tienda.
-- El porcentaje vive en shop_settings.descuento_efectivo (10 %). Lo aplica
-- shop_create_order sobre el total del pedido, antes de calcular la seña; la
-- tienda muestra el mismo cálculo (apps/tienda/src/lib/discount.ts).

insert into public.shop_settings (key, value)
values ('descuento_efectivo', jsonb_build_object('porcentaje', 10))
on conflict (key) do update set value = excluded.value;

do $mig$
declare
  src text := pg_get_functiondef('public.shop_create_order(jsonb)'::regprocedure);
  a text := $q$v_pos integer := 0;$q$;
  b text := $q$v_deposit := case when v_pay = 'sena' then ceil(v_total * 0.5) else v_total end;$q$;
  c text := $q$|| case when v_quote then '. Hay ítems a cotizar.' else '' end$q$;
begin
  if position(a in src) = 0 or position(b in src) = 0 or position(c in src) = 0 then
    raise exception 'shop_create_order cambió: revisar la migración del descuento';
  end if;
  src := replace(src, a, a || $q$
  v_discount numeric := 0;$q$);
  src := replace(src, b, $q$v_discount := case when v_method in ('transfer', 'cash')
    then round(v_total * coalesce((select (value ->> 'porcentaje')::numeric
                                     from public.shop_settings
                                    where key = 'descuento_efectivo'), 0) / 100)
    else 0 end;
  v_total := v_total - v_discount;
  $q$ || b);
  src := replace(src, c, $q$|| case when v_discount > 0 then '. Descuento por efectivo/transferencia: -' || public.ars(v_discount) else '' end
    $q$ || c);
  execute src;
end
$mig$;

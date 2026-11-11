-- Gestor MercadoLibre: registrar/anular ventas de ML (las llama el gestor con la secret key).
-- Nunca deja stock negativo: descuenta lo que hay y guarda `stock_descontado` por ítem para devolverlo al anular.
-- Lo vendido sin stock (fabricación a pedido) queda como "a fabricar" = quantity - stock_descontado.
-- Aplicada en Supabase el 2026-11-11 vía MCP.

create or replace function public.ml_register_sale(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order bigint := (p->>'ml_order_id')::bigint;
  v_sale uuid;
  v_it jsonb;
  v_pos int := 0;
  v_applied boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_desc int;
begin
  select sale_id into v_sale from public.ml_orders where ml_order_id = v_order;
  if found then return v_sale; end if;

  insert into public.sales (sold_at, channel, method, list_total, discount, amount, note)
  values (coalesce((p->>'sold_at')::timestamptz, now()), 'mercadolibre', 'other',
          (p->>'total')::numeric, 0, (p->>'total')::numeric,
          'ML #' || v_order || coalesce(' · ' || (p->>'buyer_nickname'), ''))
  returning id into v_sale;

  for v_it in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    insert into public.sale_items (sale_id, position, product_id, description, quantity, list_unit_price, unit_price)
    values (v_sale, v_pos, nullif(v_it->>'product_id','')::uuid, v_it->>'description',
            (v_it->>'quantity')::int, (v_it->>'unit_price')::numeric, (v_it->>'unit_price')::numeric);
    v_pos := v_pos + 1;
    v_desc := 0;
    if (v_it->>'product_id') is not null and coalesce((v_it->>'descontar_stock')::boolean, true) then
      select least((v_it->>'quantity')::int, greatest(stock_quantity, 0)) into v_desc
        from public.products where id = (v_it->>'product_id')::uuid for update;
      v_desc := coalesce(v_desc, 0);
      if v_desc > 0 then
        perform set_config('app.stock_kind', 'sale', true);
        perform set_config('app.stock_note', 'Venta ML #' || v_order, true);
        update public.products set stock_quantity = stock_quantity - v_desc
         where id = (v_it->>'product_id')::uuid;
        v_applied := true;
      end if;
    end if;
    v_items := v_items || (v_it || jsonb_build_object('stock_descontado', v_desc));
  end loop;

  insert into public.sale_log (sale_id, kind, reason, after)
  values (v_sale, 'created', 'Venta MercadoLibre (gestor)', p || jsonb_build_object('items', v_items));

  insert into public.ml_orders (ml_order_id, pack_id, sale_id, status, buyer_id, buyer_nickname, shipping_id, items, stock_applied)
  values (v_order, nullif(p->>'pack_id','')::bigint, v_sale, p->>'status', nullif(p->>'buyer_id','')::bigint,
          p->>'buyer_nickname', nullif(p->>'shipping_id','')::bigint, v_items, v_applied);
  return v_sale;
end; $$;

create or replace function public.ml_void_sale(p_order bigint, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  r public.ml_orders;
  v_it jsonb;
  v_q int;
begin
  select * into r from public.ml_orders where ml_order_id = p_order for update;
  if not found or r.voided then return false; end if;
  if r.sale_id is not null then
    update public.sales set voided_at = now(), void_reason = p_reason where id = r.sale_id;
    insert into public.sale_log (sale_id, kind, reason) values (r.sale_id, 'voided', p_reason);
  end if;
  for v_it in select * from jsonb_array_elements(coalesce(r.items,'[]'::jsonb)) loop
    v_q := coalesce((v_it->>'stock_descontado')::int, 0);
    if v_q > 0 and (v_it->>'product_id') is not null then
      perform set_config('app.stock_kind', 'in', true);
      perform set_config('app.stock_note', 'Venta anulada ML #' || p_order, true);
      update public.products set stock_quantity = stock_quantity + v_q where id = (v_it->>'product_id')::uuid;
    end if;
  end loop;
  update public.ml_orders set voided = true, status = 'cancelled' where ml_order_id = p_order;
  return true;
end; $$;

revoke all on function public.ml_register_sale(jsonb) from public, anon, authenticated;
revoke all on function public.ml_void_sale(bigint, text) from public, anon, authenticated;
grant execute on function public.ml_register_sale(jsonb) to service_role;
grant execute on function public.ml_void_sale(bigint, text) to service_role;

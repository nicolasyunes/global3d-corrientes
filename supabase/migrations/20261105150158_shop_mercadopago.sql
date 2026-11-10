-- Mercado Pago (Checkout API con Card Payment Brick) en la tienda.
--
-- Arranca apagado: shop_settings.mercadopago.enabled = false. La tienda solo
-- ofrece el pago con tarjeta si está prendido (o, para probar, con ?mp=prueba).
-- El cobro lo hacen las edge functions mp-pay y mp-webhook con el secret
-- MP_ACCESS_TOKEN; acá queda dónde se registra.

-- 1) La tienda acepta "mercadopago" como medio de pago. Se edita la función
--    actual en lugar de copiarla entera: si el texto no está, la migración falla.
do $mig$
declare
  src text := pg_get_functiondef('public.shop_create_order(jsonb)'::regprocedure);
  a text := $q$if v_method not in ('transfer', 'cash') then$q$;
  b text := $q$case v_method when 'transfer' then ' por transferencia' else ' en efectivo en el local' end$q$;
begin
  if position(a in src) = 0 or position(b in src) = 0 then
    raise exception 'shop_create_order cambió: revisar la migración de Mercado Pago';
  end if;
  src := replace(src, a, $q$if v_method not in ('transfer', 'cash', 'mercadopago') then$q$);
  src := replace(src, b, $q$case v_method when 'transfer' then ' por transferencia' when 'mercadopago' then ' con Mercado Pago' else ' en efectivo en el local' end$q$);
  execute src;
end
$mig$;

-- 2) Configuración pública (la Public Key es pública por diseño).
insert into public.shop_settings (key, value)
values ('mercadopago', jsonb_build_object(
  'enabled', false,
  'publicKey', 'APP_USR-9f452ec0-17e5-4de1-ab6a-0bf2d4de68a4'))
on conflict (key) do nothing;

-- 3) Pagos de Mercado Pago, uno por id de pago: evita registrar dos veces el
--    mismo pago cuando llegan la respuesta del cobro y el aviso (webhook).
create table public.shop_mp_payments (
  mp_payment_id text primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null,
  status_detail text,
  recorded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_mp_payments enable row level security;
revoke all on public.shop_mp_payments from anon;
create policy shop_mp_payments_read
  on public.shop_mp_payments for select to authenticated using (true);

-- 4) Registro del pago (solo lo llaman las edge functions, con service role).
--    Si quedó aprobado: cobro en transactions como Mercado Pago, seña/saldo del
--    pedido actualizados y el pedido de la tienda queda confirmado.
create or replace function public.shop_record_mp_payment(
  p_token text,
  p_mp_id text,
  p_status text,
  p_detail text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_prev public.shop_mp_payments;
  v_paid numeric(12, 2);
  v_kind text;
  v_amount numeric(12, 2) := round(p_amount, 2);
begin
  select o.* into v_order
    from public.shop_orders so
    join public.orders o on o.id = so.order_id
   where so.token = p_token
   for update of o;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pedido_inexistente');
  end if;

  select * into v_prev from public.shop_mp_payments where mp_payment_id = p_mp_id;
  insert into public.shop_mp_payments (mp_payment_id, order_id, amount, status, status_detail)
  values (p_mp_id, v_order.id, v_amount, p_status, p_detail)
  on conflict (mp_payment_id) do update
    set status = excluded.status,
        status_detail = excluded.status_detail,
        updated_at = now();

  if p_status <> 'approved' or coalesce(v_prev.recorded, false) then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;

  v_paid := coalesce((
    select sum(amount) from public.transactions
     where order_id = v_order.id and type = '3d_service' and voided_at is null
  ), 0);
  v_kind := case
    when v_paid = 0 and v_amount >= coalesce(v_order.total_amount, 0) then 'full'
    when v_paid = 0 then 'deposit'
    else 'balance'
  end;

  insert into public.transactions
    (type, order_id, customer_id, amount, method, note, payment_kind, operator_id)
  values
    ('3d_service', v_order.id, v_order.customer_id, v_amount, 'mercadopago',
     'Mercado Pago #' || p_mp_id, v_kind, null);

  update public.orders
     set deposit = v_paid + v_amount,
         pending_balance = greatest(coalesce(total_amount, 0) - (v_paid + v_amount), 0),
         web_pending = false
   where id = v_order.id;

  update public.shop_mp_payments set recorded = true where mp_payment_id = p_mp_id;

  insert into public.production_events (order_id, operator_id, kind, label, delta)
  values (v_order.id, null, 'payment',
          public.ars(v_amount) || ' · Mercado Pago (tienda)', round(v_amount)::integer);

  return jsonb_build_object('ok', true, 'recorded', true);
end;
$$;

revoke all on function public.shop_record_mp_payment(text, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.shop_record_mp_payment(text, text, text, text, numeric)
  to service_role;

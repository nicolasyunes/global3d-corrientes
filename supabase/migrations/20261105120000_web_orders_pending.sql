-- Pedidos de la tienda "por confirmar".
--
-- La tienda crea el pedido apenas el cliente toca "Confirmar pedido", aunque
-- después no mande el WhatsApp ni pague. Esos pedidos entran marcados con
-- web_pending y quedan fuera de todas las vistas del admin (Hoy, Semana,
-- Pedidos, Números) hasta que alguien del taller los confirma. Se ven y se
-- manejan con shop_pending_orders / shop_confirm_order / shop_discard_order.
-- Si nadie los confirma en 72 horas, se cancelan solos.

alter table public.orders
  add column web_pending boolean not null default false;

-- Solo shop_create_order crea filas en shop_orders: así se marcan los pedidos
-- de la tienda sin tocar esa función, y un pedido cargado a mano con canal
-- "web" no queda pendiente.
create or replace function public.shop_mark_order_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders set web_pending = true where id = new.order_id;
  return new;
end;
$$;

revoke all on function public.shop_mark_order_pending() from public, anon, authenticated;

create trigger trg_shop_orders_mark_pending
  after insert on public.shop_orders
  for each row execute function public.shop_mark_order_pending();

-- El admin no ve los pendientes en ninguna consulta directa.
create policy orders_hide_web_pending
  on public.orders
  as restrictive
  for select
  to authenticated
  using (not web_pending);

-- Lista para el panel "Pedidos de la tienda".
create or replace function public.shop_pending_orders()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'code', upper(left(so.token, 6)),
    'createdAt', o.created_at,
    'customer', c.name,
    'whatsapp', coalesce(c.whatsapp, c.phone),
    'total', o.total_amount,
    'delivery', so.delivery,
    'payment', so.payment,
    'notes', o.observations,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'personalization', i.personalization,
        'quantity', i.quantity
      ) order by i.position)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  ) order by o.created_at desc), '[]'::jsonb)
  from public.orders o
  join public.shop_orders so on so.order_id = o.id
  left join public.customers c on c.id = o.customer_id
  where o.web_pending and o.status = 'new';
$$;

-- Confirmar: pasa a ser un pedido normal del taller.
create or replace function public.shop_confirm_order(p_order uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.orders set web_pending = false
     where id = p_order and web_pending and status = 'new'
    returning 1)
  select exists (select 1 from u);
$$;

-- Descartar: queda cancelado y sigue fuera de las vistas.
create or replace function public.shop_discard_order(p_order uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.orders set status = 'cancelled'
     where id = p_order and web_pending and status = 'new'
    returning 1)
  select exists (select 1 from u);
$$;

revoke all on function public.shop_pending_orders() from public, anon;
revoke all on function public.shop_confirm_order(uuid) from public, anon;
revoke all on function public.shop_discard_order(uuid) from public, anon;
grant execute on function public.shop_pending_orders() to authenticated;
grant execute on function public.shop_confirm_order(uuid) to authenticated;
grant execute on function public.shop_discard_order(uuid) to authenticated;

-- La página del pedido en la tienda muestra si falta la confirmación.
create or replace function public.shop_order_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', upper(left(so.token, 6)),
    'status', o.status,
    'pendingConfirmation', o.web_pending and o.status = 'new',
    'createdAt', o.created_at,
    'dueDate', o.due_date,
    'total', o.total_amount,
    'deposit', coalesce(o.deposit, 0),
    'pendingBalance', o.pending_balance,
    'customerFirstName', split_part(btrim(c.name), ' ', 1),
    'delivery', so.delivery,
    'payment', so.payment,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'personalization', i.personalization,
        'quantity', i.quantity,
        'unitPrice', i.unit_price
      ) order by i.position)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.shop_orders so
  join public.orders o on o.id = so.order_id
  join public.customers c on c.id = o.customer_id
  where p_token ~ '^[0-9a-f]{32}$' and so.token = p_token;
$$;

-- Vencimiento: cada hora cancela los que llevan más de 72 horas sin confirmar.
select cron.schedule(
  'expire-web-orders',
  '15 * * * *',
  $$
  update public.orders set status = 'cancelled'
   where web_pending and status = 'new'
     and created_at < now() - interval '72 hours';
  $$
);

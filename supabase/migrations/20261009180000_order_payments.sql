-- Estadísticas F1: cada cobro de un pedido queda registrado con fecha, medio,
-- tipo y quién lo cargó. transactions (type '3d_service') es el libro; las
-- columnas orders.deposit / pending_balance son el resumen y las mantienen las
-- funciones de abajo. Los cobros no se borran: se anulan con motivo.

-- ---------------------------------------------------------------------------
-- Libro de cobros
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column payment_kind text,
  add column operator_id uuid references public.operators (id) on delete set null,
  add column voided_at timestamptz,
  add column voided_by uuid references public.operators (id) on delete set null,
  add column void_reason text,
  add constraint transactions_payment_kind_check
    check (payment_kind is null or payment_kind in ('deposit', 'balance', 'full')),
  add constraint transactions_payment_kind_type_check
    check (payment_kind is null or type = '3d_service'),
  add constraint transactions_void_check
    check ((voided_at is null) = (void_reason is null));

-- Los cobros de pedidos solo se escriben por las funciones de abajo (corren
-- como dueño de la tabla y no pasan por estas políticas). Las ventas de
-- producto e insumos siguen igual.
drop policy transactions_all on public.transactions;
create policy transactions_read
  on public.transactions for select to authenticated using (true);
create policy transactions_insert
  on public.transactions for insert to authenticated
  with check (type <> '3d_service');
create policy transactions_update
  on public.transactions for update to authenticated
  using (type <> '3d_service') with check (type <> '3d_service');
create policy transactions_delete
  on public.transactions for delete to authenticated
  using (type <> '3d_service');

-- ---------------------------------------------------------------------------
-- Canal: se suma Mercado Libre
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint orders_origin_channel_check;
alter table public.orders add constraint orders_origin_channel_check
  check (origin_channel in ('whatsapp', 'whatsapp_personal', 'instagram',
                            'facebook', 'local', 'web', 'mercadolibre', 'other'));

-- ---------------------------------------------------------------------------
-- Señas ya cargadas: una fila por pedido, con la fecha de alta y nota "migrado".
-- El medio no se conoce. Los saldos de pedidos viejos NO se tocan.
-- ---------------------------------------------------------------------------
insert into public.transactions
  (type, order_id, customer_id, amount, method, note, transacted_at, payment_kind)
select '3d_service', o.id, o.customer_id, o.deposit, null, 'migrado', o.created_at,
       case when o.total_amount is not null and o.deposit >= o.total_amount
            then 'full' else 'deposit' end
from public.orders o
where coalesce(o.deposit, 0) > 0;

-- ---------------------------------------------------------------------------
-- Registrar un cobro
-- ---------------------------------------------------------------------------
create or replace function public.register_order_payment(
  p_order uuid,
  p_amount numeric,
  p_method text,
  p_operator uuid,
  p_note text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_paid numeric(12, 2);
  v_due numeric(12, 2);
  v_kind text;
  v_tx public.transactions;
  v_label text;
begin
  if not exists (
    select 1 from public.operators where id = p_operator and active
  ) then
    raise exception 'No se reconoce a la persona que cobra';
  end if;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then
    raise exception 'Escribí el monto que pagó';
  end if;
  if p_method is null
     or p_method not in ('cash', 'transfer', 'uala', 'brubank', 'mercadopago', 'other') then
    raise exception 'Elegí cómo pagó';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'No se encontró el pedido';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'El pedido está cancelado';
  end if;
  if v_order.total_amount is null then
    raise exception 'Cargá primero el total del pedido';
  end if;

  v_paid := coalesce((
    select sum(amount) from public.transactions
    where order_id = p_order and type = '3d_service' and voided_at is null
  ), 0);
  v_due := v_order.total_amount - v_paid;
  if p_amount > v_due then
    raise exception 'El cobro supera el saldo (queda %)', public.ars(v_due);
  end if;

  v_kind := case
    when v_paid = 0 and p_amount >= v_order.total_amount then 'full'
    when v_paid = 0 then 'deposit'
    else 'balance'
  end;

  insert into public.transactions
    (type, order_id, customer_id, amount, method, note, payment_kind, operator_id)
  values
    ('3d_service', p_order, v_order.customer_id, p_amount, p_method,
     nullif(trim(p_note), ''), v_kind, p_operator)
  returning * into v_tx;

  update public.orders
    set deposit = v_paid + p_amount,
        pending_balance = v_order.total_amount - (v_paid + p_amount)
    where id = p_order;

  v_label := public.ars(p_amount) || ' · ' || case p_method
    when 'cash' then 'efectivo'
    when 'transfer' then 'transferencia'
    when 'mercadopago' then 'Mercado Pago'
    when 'uala' then 'Ualá'
    when 'brubank' then 'Brubank'
    else 'otro medio' end;
  insert into public.production_events (order_id, operator_id, kind, label, delta)
    values (p_order, p_operator, 'payment', v_label, round(p_amount)::integer);

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anular un cobro: solo admin, con motivo; devuelve el saldo al pedido
-- ---------------------------------------------------------------------------
create or replace function public.void_order_payment(
  p_tx uuid,
  p_operator uuid,
  p_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_order public.orders;
  v_new numeric(12, 2);
  v_order_id uuid;
begin
  if not exists (
    select 1 from public.operators
    where id = p_operator and role = 'admin' and active
  ) then
    raise exception 'Solo un administrador puede anular cobros';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribí el motivo de la anulación';
  end if;

  select order_id into v_order_id from public.transactions
    where id = p_tx and type = '3d_service' and order_id is not null;
  if not found then
    raise exception 'No se encontró el cobro';
  end if;

  select * into v_order from public.orders where id = v_order_id for update;

  select * into v_tx from public.transactions
    where id = p_tx and type = '3d_service' and order_id is not null for update;
  if not found then
    raise exception 'No se encontró el cobro';
  end if;
  if v_tx.voided_at is not null then
    raise exception 'El cobro ya está anulado';
  end if;

  update public.transactions
    set voided_at = now(), voided_by = p_operator, void_reason = trim(p_reason)
    where id = p_tx
    returning * into v_tx;

  v_new := coalesce((
    select sum(amount) from public.transactions
    where order_id = v_tx.order_id and type = '3d_service' and voided_at is null
  ), 0);

  update public.orders
    set deposit = v_new,
        pending_balance = case when total_amount is null then null
                               else total_amount - v_new end
    where id = v_tx.order_id;

  insert into public.production_events (order_id, operator_id, kind, label, delta)
    values (v_tx.order_id, p_operator, 'payment',
            'Cobro anulado · ' || public.ars(v_tx.amount) || ' (' || trim(p_reason) || ')',
            -round(v_tx.amount)::integer);

  return v_tx;
end;
$$;

revoke execute on function public.register_order_payment(uuid, numeric, text, uuid, text) from public, anon;
revoke execute on function public.void_order_payment(uuid, uuid, text) from public, anon;
grant execute on function public.register_order_payment(uuid, numeric, text, uuid, text) to authenticated;
grant execute on function public.void_order_payment(uuid, uuid, text) to authenticated;

-- Si cambia el total del pedido, el saldo se recalcula a partir de la seña
-- ya cobrada (la seña y el saldo no se escriben desde la edición del pedido).
create or replace function public.orders_sync_balance_on_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.pending_balance := case
    when new.total_amount is null then null
    else greatest(0, new.total_amount - coalesce(new.deposit, 0))
  end;
  return new;
end;
$$;

create trigger orders_sync_balance_on_total
  before update of total_amount on public.orders
  for each row
  when (new.total_amount is distinct from old.total_amount)
  execute function public.orders_sync_balance_on_total();

-- Envíos por Correo Argentino: importar el envío en MiCorreo y seguirlo.
--
-- * shop_shipments: un envío por pedido. Lo escribe solo la edge function
--   correo-envio (service role); el admin lo lee. Guarda lo que se mandó a
--   /shipping/import, el número de seguimiento (lo pega el taller cuando
--   genera la etiqueta en MiCorreo) y los últimos eventos de /shipping/tracking.
-- * shop_create_order: con envío cotizado acepta delivery.recipient (email,
--   provincia y, a domicilio, calle, número, piso, depto y ciudad) y lo guarda
--   en delivery.shipping.recipient. Es opcional: sin él se comporta como antes
--   y el taller completa los datos al crear el envío.
-- * shop_order_status: devuelve el seguimiento para la página del pedido.

create table if not exists public.shop_shipments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  carrier text not null default 'correo' check (carrier in ('correo')),
  ext_order_id text not null,
  import_payload jsonb,
  imported_at timestamptz,
  tracking_number text,
  tracking_events jsonb not null default '[]'::jsonb,
  tracking_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shop_shipments enable row level security;
-- El admin solo lee; escribe la edge function con service role.
drop policy if exists shop_shipments_read on public.shop_shipments;
create policy shop_shipments_read on public.shop_shipments
  for select to authenticated using (true);

create or replace function public.shop_create_order(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p -> 'customer' ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p -> 'customer' ->> 'whatsapp', ''), '\D', '', 'g');
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_delivery text := coalesce(p -> 'delivery' ->> 'mode', 'retiro');
  v_address text := left(btrim(coalesce(p -> 'delivery' ->> 'address', '')), 200);
  v_ship_in jsonb := p -> 'delivery' -> 'shipping';
  v_pay text := coalesce(p -> 'payment' ->> 'mode', 'sena');
  v_method text := coalesce(p -> 'payment' ->> 'method', 'transfer');
  v_notes text := left(btrim(coalesce(p ->> 'notes', '')), 500);
  v_customer uuid;
  v_order uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_total numeric := 0;
  v_quote boolean := false;
  v_lead integer := 1;
  v_ptype text;
  v_types text[] := '{}';
  v_resolved jsonb := '[]'::jsonb;
  v_lines text := '';
  v_obs text;
  v_deposit numeric;
  it jsonb;
  r jsonb;
  v_prod public.products%rowtype;
  v_fam public.shop_families%rowtype;
  v_unit numeric;
  v_qty integer;
  v_desc text;
  v_perso text;
  v_pos integer := 0;
  v_discount numeric := 0;
  -- Envío por Correo Argentino
  v_sq public.shipping_quotes%rowtype;
  v_ship_type text;
  v_ship_product text;
  v_ship_rate jsonb;
  v_ship numeric := 0;
  v_ship_desc text;
  v_agency_code text;
  v_agency_name text;
  v_shipping jsonb;
  -- Destinatario para importar el envío en MiCorreo
  v_rcpt jsonb := p -> 'delivery' -> 'recipient';
  v_email text;
  v_prov text;
  v_street text;
  v_number text;
  v_floor text;
  v_apt text;
  v_city text;
  v_recipient jsonb;
begin
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'nombre_invalido';
  end if;
  if length(v_phone) < 8 or length(v_phone) > 15 then
    raise exception 'whatsapp_invalido';
  end if;
  if jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) = 0
     or jsonb_array_length(v_items) > 30 then
    raise exception 'items_invalidos';
  end if;
  if v_delivery not in ('retiro', 'corrientes', 'pais') then
    raise exception 'entrega_invalida';
  end if;
  if v_pay not in ('sena', 'total') then
    raise exception 'pago_invalido';
  end if;
  if v_method not in ('transfer', 'cash', 'mercadopago') then
    raise exception 'medio_invalido';
  end if;

  -- Envío al país: la cotización tiene que existir, estar vigente y ser de
  -- este mismo carrito. El precio sale de la cotización guardada.
  -- Sin cotización (tienda vieja o Correo caído) queda como antes: "a cotizar".
  if v_delivery = 'pais' and jsonb_typeof(v_ship_in) = 'object' then
    v_ship_type := v_ship_in ->> 'type';
    v_ship_product := coalesce(v_ship_in ->> 'product', 'CP');
    if coalesce(v_ship_type, '') not in ('S', 'D') or v_ship_product !~ '^[A-Z]{2}$' then
      raise exception 'envio_invalido';
    end if;
    begin
      select * into v_sq from public.shipping_quotes
       where id = (v_ship_in ->> 'quoteId')::uuid;
    exception when invalid_text_representation then
      raise exception 'envio_sin_cotizar';
    end;
    if not found then
      raise exception 'envio_sin_cotizar';
    end if;
    if coalesce(v_sq.valid_to, v_sq.created_at + interval '12 hours') < now()
       or v_sq.created_at < now() - interval '24 hours' then
      raise exception 'cotizacion_vencida';
    end if;
    if v_sq.boxes <> public.shop_shipping_boxes(v_items) then
      raise exception 'cotizacion_vencida';
    end if;
    select e.value into v_ship_rate
      from jsonb_array_elements(v_sq.rates) e
     where e.value ->> 'deliveredType' = v_ship_type
       and e.value ->> 'productType' = v_ship_product
     limit 1;
    if v_ship_rate is null then
      raise exception 'envio_invalido';
    end if;
    v_ship := ceil((v_ship_rate ->> 'price')::numeric);

    -- Destinatario (tienda nueva). Sin él, el taller lo completa al crear
    -- el envío en el admin.
    if jsonb_typeof(v_rcpt) = 'object' then
      v_email := lower(left(btrim(coalesce(v_rcpt ->> 'email', '')), 120));
      if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'email_invalido';
      end if;
      v_prov := upper(left(btrim(coalesce(v_rcpt ->> 'province', '')), 1));
      if v_prov !~ '^[A-HJ-NP-Z]$' then
        v_prov := null;
      end if;
      if v_ship_type = 'D' then
        v_street := left(btrim(coalesce(v_rcpt ->> 'street', '')), 80);
        v_number := left(btrim(coalesce(v_rcpt ->> 'number', '')), 10);
        v_floor := left(btrim(coalesce(v_rcpt ->> 'floor', '')), 3);
        v_apt := left(btrim(coalesce(v_rcpt ->> 'apartment', '')), 3);
        v_city := left(btrim(coalesce(v_rcpt ->> 'city', '')), 60);
        if length(v_street) < 2 or v_number = '' or length(v_city) < 2
           or v_prov is null then
          raise exception 'direccion_invalida';
        end if;
        v_address := v_street || ' ' || v_number
          || case when v_floor <> '' then ' piso ' || v_floor else '' end
          || case when v_apt <> '' then ' ' || v_apt else '' end
          || ', ' || v_city;
      end if;
      v_recipient := jsonb_strip_nulls(jsonb_build_object(
        'email', v_email,
        'province', v_prov,
        'street', nullif(v_street, ''),
        'number', nullif(v_number, ''),
        'floor', nullif(v_floor, ''),
        'apartment', nullif(v_apt, ''),
        'city', nullif(v_city, '')));
    end if;

    if v_ship_type = 'S' then
      v_agency_code := left(btrim(coalesce(v_ship_in ->> 'agencyCode', '')), 12);
      v_agency_name := left(btrim(coalesce(v_ship_in ->> 'agencyName', '')), 160);
      if v_agency_code !~ '^[A-Z0-9]{3,12}$' then
        raise exception 'sucursal_invalida';
      end if;
      v_address := left('Sucursal ' || coalesce(nullif(v_agency_name, ''), v_agency_code)
        || ' (' || v_agency_code || '), CP ' || v_sq.postal_code, 200);
    elsif length(v_address) >= 5 then
      v_address := left(v_address || ' (CP ' || v_sq.postal_code || ')', 200);
    end if;

    v_ship_desc := coalesce(v_ship_rate ->> 'productName', 'Correo Argentino')
      || case v_ship_type when 'S' then ' a sucursal' else ' a domicilio' end;
    v_shipping := jsonb_build_object(
      'carrier', 'correo_argentino',
      'quoteId', v_sq.id,
      'type', v_ship_type,
      'product', v_ship_product,
      'productName', v_ship_rate ->> 'productName',
      'price', v_ship,
      'postalCode', v_sq.postal_code,
      'boxes', v_sq.boxes,
      'agencyCode', v_agency_code,
      'agencyName', nullif(v_agency_name, ''),
      'deliveryTimeMin', v_ship_rate ->> 'deliveryTimeMin',
      'deliveryTimeMax', v_ship_rate ->> 'deliveryTimeMax',
      'recipient', v_recipient);
  end if;

  if v_delivery <> 'retiro' and length(v_address) < 5 then
    raise exception 'direccion_invalida';
  end if;

  if (select count(*)
        from public.shop_orders so
        join public.orders o on o.id = so.order_id
        join public.customers c on c.id = o.customer_id
       where right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 10) = right(v_phone, 10)
         and so.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.shop_orders
          where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'demasiados_pedidos';
  end if;

  for it in select value from jsonb_array_elements(v_items)
  loop
    v_qty := greatest(1, least(500, coalesce((it ->> 'quantity')::integer, 1)));
    v_perso := nullif(left(btrim(coalesce(it ->> 'personalization', '')), 400), '');
    v_unit := null;

    if nullif(it ->> 'productId', '') is not null then
      select p2.* into v_prod
        from public.products p2
        join public.shop_family_products fp on fp.product_id = p2.id
        join public.shop_families f on f.id = fp.family_id
       where p2.id = (it ->> 'productId')::uuid and p2.active and f.published;
      if not found then
        raise exception 'producto_invalido';
      end if;
      select f.* into v_fam
        from public.shop_families f
        join public.shop_family_products fp on fp.family_id = f.id
       where fp.product_id = v_prod.id;
      v_unit := v_prod.base_price;
      v_desc := v_prod.name;
      if coalesce(v_prod.stock_quantity, 0) < v_qty or v_perso is not null then
        v_lead := greatest(v_lead, v_fam.lead_days);
      end if;
    else
      select * into v_fam from public.shop_families
       where slug = it ->> 'familySlug' and published;
      if not found then
        raise exception 'producto_invalido';
      end if;
      if v_qty < v_fam.min_qty then
        raise exception 'cantidad_minima';
      end if;
      v_desc := v_fam.name;
      v_unit := case when v_fam.sale_mode = 'cotizacion' then null else v_fam.price_from end;
      v_lead := greatest(v_lead, v_fam.lead_days);
    end if;

    if v_unit is null then
      v_quote := true;
    else
      v_total := v_total + v_unit * v_qty;
    end if;

    v_ptype := case v_fam.category
      when 'vasos' then 'cup' when 'milkshake' then 'cup'
      when 'trofeos' then 'trophy' when 'llaveros' then 'keychain'
      else 'other' end;
    v_types := array_append(v_types, v_ptype);

    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'product_id', case when nullif(it ->> 'productId', '') is null then null else v_prod.id end,
      'product_type', v_ptype,
      'description', v_desc,
      'personalization', v_perso,
      'quantity', v_qty,
      'unit_price', v_unit));
    v_lines := v_lines || v_qty || ' × ' || v_desc
      || case when v_perso is null then '' else ' (' || v_perso || ')' end || E'\n';
  end loop;

  select id into v_customer
    from public.customers
   where right(regexp_replace(coalesce(whatsapp, phone, ''), '\D', '', 'g'), 10) = right(v_phone, 10)
   order by created_at
   limit 1;
  if v_customer is null then
    insert into public.customers (name, whatsapp)
    values (v_name, v_phone)
    returning id into v_customer;
  end if;

  -- El descuento por efectivo/transferencia es sobre los productos; el envío
  -- va entero y se cobra completo con la seña.
  v_discount := case when v_method in ('transfer', 'cash')
    then round(v_total * coalesce((select (value ->> 'porcentaje')::numeric
                                     from public.shop_settings
                                    where key = 'descuento_efectivo'), 0) / 100)
    else 0 end;
  v_total := v_total - v_discount;
  v_deposit := case when v_pay = 'sena' then ceil(v_total * 0.5) else v_total end + v_ship;
  v_total := v_total + v_ship;

  if v_ship > 0 then
    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'product_type', 'other',
      'description', 'Envío ' || v_ship_desc,
      'personalization', null,
      'quantity', 1,
      'unit_price', v_ship));
    v_lines := v_lines || '1 × Envío ' || v_ship_desc || E'\n';
  end if;

  v_obs := 'Pedido web. Entrega: '
    || case v_delivery
         when 'retiro' then 'retira en el local'
         when 'corrientes' then 'envío en Corrientes a ' || v_address
         else case when v_shipping is null
                then 'envío al país a ' || v_address || ' (cotizar envío)'
                else 'Correo Argentino, ' || v_ship_desc || ' (' || public.ars(v_ship) || ') a ' || v_address end end
    || '. Pago: ' || case v_pay when 'sena' then 'seña 50%' else 'total' end
    || case v_method when 'transfer' then ' por transferencia' when 'mercadopago' then ' con Mercado Pago' else ' en efectivo en el local' end
    || case when v_discount > 0 then '. Descuento por efectivo/transferencia: -' || public.ars(v_discount) else '' end
    || case when v_quote then '. Hay ítems a cotizar.' else '' end
    || case when v_notes = '' then '' else E'\nNota del cliente: ' || v_notes end;

  insert into public.orders (
    customer_id, product_type, due_date, status, total_amount, deposit,
    pending_balance, payment_method, origin_channel, title, description, observations
  ) values (
    v_customer,
    case when array_length(array(select distinct unnest(v_types)), 1) = 1 then v_types[1] else 'other' end,
    current_date + v_lead,
    'new',
    v_total,
    0,
    v_total,
    v_method,
    'web',
    'Pedido web · ' || v_name,
    btrim(v_lines),
    v_obs
  ) returning id into v_order;

  for r in select value from jsonb_array_elements(v_resolved)
  loop
    insert into public.order_items (
      order_id, product_type, description, personalization, quantity,
      unit_price, line_total, position, product_id
    ) values (
      v_order,
      r ->> 'product_type',
      r ->> 'description',
      r ->> 'personalization',
      (r ->> 'quantity')::integer,
      (r ->> 'unit_price')::numeric,
      case when r ->> 'unit_price' is null then null
           else (r ->> 'unit_price')::numeric * (r ->> 'quantity')::integer end,
      v_pos,
      nullif(r ->> 'product_id', '')::uuid
    );
    v_pos := v_pos + 1;
  end loop;

  insert into public.shop_orders (order_id, token, delivery, payment)
  values (
    v_order,
    v_token,
    jsonb_build_object('mode', v_delivery, 'address', nullif(v_address, ''))
      || case when v_shipping is null then '{}'::jsonb
              else jsonb_build_object('shipping', v_shipping) end,
    jsonb_build_object('mode', v_pay, 'method', v_method, 'deposit', v_deposit)
  );

  return jsonb_build_object(
    'token', v_token,
    'code', upper(left(v_token, 6)),
    'total', v_total,
    'deposit', v_deposit,
    'shipping', v_ship,
    'quote', v_quote,
    'dueDate', current_date + v_lead
  );
end;
$function$;

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
    'shipment', (
      select jsonb_build_object(
        'carrier', s.carrier,
        'trackingNumber', s.tracking_number,
        'events', s.tracking_events,
        'checkedAt', s.tracking_checked_at)
      from public.shop_shipments s
      where s.order_id = o.id and s.tracking_number is not null),
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

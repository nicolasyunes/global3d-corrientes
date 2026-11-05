-- Tienda pública (apps/tienda). Se reabre en noviembre 2026.
--
-- Todo es ADITIVO: tablas nuevas con prefijo shop_ y funciones RPC. No se
-- modifica ni se borra nada de lo que usa el admin.
--
-- Seguridad: el visitante anónimo NO lee ninguna tabla. Solo puede llamar a
-- cinco funciones SECURITY DEFINER que devuelven lo justo:
--   shop_catalog()          familias publicadas con sus variantes y fotos
--   shop_filaments()        líneas y colores de filamento con stock
--   shop_settings()         datos públicos del local (alias, horarios, WhatsApp)
--   shop_create_order(p)    crea cliente + pedido + ítems con precios del servidor
--   shop_order_status(t)    estado de un pedido por su token de seguimiento

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Familia = lo que ve el cliente ("Vaso camiseta"). Sus variantes son filas de
-- products ("Vaso Camiseta 1lt RIVER") vinculadas por shop_family_products.
-- Una familia sin productos (sale_mode a_pedido/cotizacion) se vende por precio
-- "desde" y se fabrica a pedido.
create table public.shop_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  category text not null,
  description text,
  sale_mode text not null default 'stock'
    check (sale_mode in ('stock', 'a_pedido', 'cotizacion')),
  lead_days integer not null default 3 check (lead_days between 0 and 60),
  min_qty integer not null default 1 check (min_qty >= 1),
  -- [{"key":"tamano","label":"Tamaño"}, {"key":"diseno","label":"Diseño"}]
  option_axes jsonb not null default '[]'::jsonb,
  -- [{"key":"nombre","label":"Nombre","type":"text","max":24,"hint":"..."}]
  personalization jsonb not null default '[]'::jsonb,
  price_from numeric check (price_from is null or price_from >= 0),
  featured boolean not null default false,
  position integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_family_products (
  product_id uuid primary key references public.products (id) on delete cascade,
  family_id uuid not null references public.shop_families (id) on delete cascade,
  -- {"tamano":"1 L","diseno":"River"}
  option_values jsonb not null default '{}'::jsonb,
  position integer not null default 0
);
create index shop_family_products_family_idx on public.shop_family_products (family_id);

-- Datos públicos del local que muestra la tienda (clave → valor).
create table public.shop_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Pedidos que entraron por la web: token de seguimiento y lo que eligió el
-- cliente en el checkout. El pedido en sí vive en orders (origin_channel = web).
create table public.shop_orders (
  order_id uuid primary key references public.orders (id) on delete cascade,
  token text not null unique,
  delivery jsonb not null default '{}'::jsonb,
  payment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index shop_orders_created_idx on public.shop_orders (created_at);

create trigger trg_shop_families_updated_at
  before update on public.shop_families
  for each row execute function public.set_updated_at();
create trigger trg_shop_settings_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- RLS: solo el taller (autenticado) lee y edita. El público no toca tablas.
alter table public.shop_families enable row level security;
alter table public.shop_family_products enable row level security;
alter table public.shop_settings enable row level security;
alter table public.shop_orders enable row level security;

create policy shop_families_all on public.shop_families
  for all to authenticated using (true) with check (true);
create policy shop_family_products_all on public.shop_family_products
  for all to authenticated using (true) with check (true);
create policy shop_settings_all on public.shop_settings
  for all to authenticated using (true) with check (true);
create policy shop_orders_all on public.shop_orders
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Lectura pública
-- ---------------------------------------------------------------------------

create or replace function public.shop_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', f.slug,
    'name', f.name,
    'category', f.category,
    'description', f.description,
    'saleMode', f.sale_mode,
    'leadDays', f.lead_days,
    'minQty', f.min_qty,
    'optionAxes', f.option_axes,
    'personalization', f.personalization,
    'priceFrom', f.price_from,
    'featured', f.featured,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'options', fp.option_values,
        'price', p.base_price,
        'stock', greatest(coalesce(p.stock_quantity, 0), 0),
        'images', coalesce(
          (select jsonb_agg(i.url order by i.position)
             from public.product_images i where i.product_id = p.id),
          case when p.image_url is not null
               then jsonb_build_array(p.image_url) else '[]'::jsonb end)
      ) order by fp.position, p.base_price, p.name)
      from public.shop_family_products fp
      join public.products p on p.id = fp.product_id
      where fp.family_id = f.id and p.active
    ), '[]'::jsonb)
  ) order by f.position, f.name), '[]'::jsonb)
  from public.shop_families f
  where f.published;
$$;

create or replace function public.shop_filaments()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'brand', l.brand,
    'name', l.name,
    'material', l.material,
    'presentation', l.presentation,
    'price', l.price,
    'refillPrice', l.refill_price,
    'colors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'swatch', c.swatch,
        'finish', c.finish,
        'price', coalesce(c.price, l.price),
        'stock', greatest(coalesce(c.stock, 0), 0),
        'refillStock', greatest(coalesce(c.stock_refill, 0), 0)
      ) order by c.position, c.name)
      from public.filament_colors c where c.line_id = l.id
    ), '[]'::jsonb)
  ) order by l.position, l.brand), '[]'::jsonb)
  from public.filament_lines l;
$$;

create or replace function public.shop_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.shop_settings;
$$;

-- ---------------------------------------------------------------------------
-- Crear pedido desde la web
-- ---------------------------------------------------------------------------
-- Entrada:
-- {
--   "customer": {"name": "Lucía", "whatsapp": "3794 000000"},
--   "items": [
--     {"productId": "<uuid>", "quantity": 1, "personalization": "Nombre: Facu"},
--     {"familySlug": "llaveros-logo", "quantity": 20, "personalization": "..."}
--   ],
--   "delivery": {"mode": "retiro" | "corrientes" | "pais", "address": "..."},
--   "payment": {"mode": "sena" | "total", "method": "transfer" | "cash"},
--   "notes": "..."
-- }
-- Los precios salen de la base, nunca del cliente.
create or replace function public.shop_create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p -> 'customer' ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p -> 'customer' ->> 'whatsapp', ''), '\D', '', 'g');
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_delivery text := coalesce(p -> 'delivery' ->> 'mode', 'retiro');
  v_address text := left(btrim(coalesce(p -> 'delivery' ->> 'address', '')), 200);
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
  if v_method not in ('transfer', 'cash') then
    raise exception 'medio_invalido';
  end if;
  if v_delivery <> 'retiro' and length(v_address) < 5 then
    raise exception 'direccion_invalida';
  end if;

  -- Freno a pedidos en ráfaga: 5 por WhatsApp por hora, 40 en total cada 10 min.
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

  -- Resolver ítems con precios del servidor
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

  -- Cliente: se reutiliza por WhatsApp (últimos 10 dígitos)
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

  v_deposit := case when v_pay = 'sena' then ceil(v_total * 0.5) else v_total end;

  v_obs := 'Pedido web. Entrega: '
    || case v_delivery
         when 'retiro' then 'retira en el local'
         when 'corrientes' then 'envío en Corrientes a ' || v_address
         else 'envío al país a ' || v_address || ' (cotizar envío)' end
    || '. Pago: ' || case v_pay when 'sena' then 'seña 50%' else 'total' end
    || case v_method when 'transfer' then ' por transferencia' else ' en efectivo en el local' end
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
    jsonb_build_object('mode', v_delivery, 'address', nullif(v_address, '')),
    jsonb_build_object('mode', v_pay, 'method', v_method, 'deposit', v_deposit)
  );

  return jsonb_build_object(
    'token', v_token,
    'code', upper(left(v_token, 6)),
    'total', v_total,
    'deposit', v_deposit,
    'quote', v_quote,
    'dueDate', current_date + v_lead
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Seguimiento por token
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Permisos: el público solo ejecuta estas cinco funciones
-- ---------------------------------------------------------------------------
revoke all on function public.shop_catalog() from public;
revoke all on function public.shop_filaments() from public;
revoke all on function public.shop_settings() from public;
revoke all on function public.shop_create_order(jsonb) from public;
revoke all on function public.shop_order_status(text) from public;

grant execute on function public.shop_catalog() to anon, authenticated;
grant execute on function public.shop_filaments() to anon, authenticated;
grant execute on function public.shop_settings() to anon, authenticated;
grant execute on function public.shop_create_order(jsonb) to anon, authenticated;
grant execute on function public.shop_order_status(text) to anon, authenticated;

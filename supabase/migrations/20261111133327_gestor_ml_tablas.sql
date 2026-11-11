-- Gestor MercadoLibre (repo global3d-gestor-ML): publicaciones, tokens, memoria del director y precios por canal.
-- Aplicada en Supabase el 2026-11-11 vía MCP; este archivo es el registro.

create or replace function public.ml_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- 1) Publicaciones de MercadoLibre vinculadas a familias/productos
create table public.ml_listings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.shop_families(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  ml_item_id text not null,
  ml_variation_id text,
  status text not null default 'draft' check (status in ('draft','active','paused','closed','under_review','error')),
  title text,
  category_id text,
  listing_type text,
  ml_price numeric,
  ml_stock integer,
  permalink text,
  last_synced_at timestamptz,
  last_audit jsonb,
  needs_review boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ml_item_id, ml_variation_id)
);
create index on public.ml_listings (family_id);
create index on public.ml_listings (product_id);
create trigger ml_listings_touch before update on public.ml_listings
  for each row execute function public.ml_touch_updated_at();

-- 2) Tokens OAuth de MercadoLibre (solo service_role: RLS sin políticas)
create table public.ml_auth (
  id smallint primary key default 1 check (id = 1),
  ml_user_id bigint,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger ml_auth_touch before update on public.ml_auth
  for each row execute function public.ml_touch_updated_at();

-- 3) Memoria corta del director
create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'director',
  key text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  unique (scope, key)
);
create trigger agent_memory_touch before update on public.agent_memory
  for each row execute function public.ml_touch_updated_at();

-- 4) Precios por canal: reglas generales + excepciones por producto
create table public.price_rules (
  channel text primary key check (channel in ('ml','efectivo')),
  markup_pct numeric not null default 0,   -- % sobre base_price (negativo = descuento)
  fixed_add numeric not null default 0,    -- monto fijo a sumar
  round_to integer not null default 100,   -- redondeo hacia arriba
  updated_at timestamptz not null default now()
);
create trigger price_rules_touch before update on public.price_rules
  for each row execute function public.ml_touch_updated_at();
insert into public.price_rules (channel) values ('ml'), ('efectivo');
-- Valores cargados después a mano: ml +20, efectivo -10 (igual que shop_settings.descuento_efectivo).

create table public.product_prices (
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null check (channel in ('ml','efectivo')),
  price numeric not null check (price >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, channel)
);
create trigger product_prices_touch before update on public.product_prices
  for each row execute function public.ml_touch_updated_at();

-- Vista con los 3 precios (web = base_price)
create view public.v_product_prices with (security_invoker = true) as
select p.id as product_id, p.name, p.base_price as price_web,
  coalesce(pe.price, ceil((p.base_price*(1+re.markup_pct/100)+re.fixed_add)/nullif(re.round_to,0))*re.round_to) as price_efectivo,
  coalesce(pm.price, ceil((p.base_price*(1+rm.markup_pct/100)+rm.fixed_add)/nullif(rm.round_to,0))*rm.round_to) as price_ml,
  (pe.price is not null) as efectivo_manual,
  (pm.price is not null) as ml_manual
from public.products p
cross join (select * from public.price_rules where channel='efectivo') re
cross join (select * from public.price_rules where channel='ml') rm
left join public.product_prices pe on pe.product_id=p.id and pe.channel='efectivo'
left join public.product_prices pm on pm.product_id=p.id and pm.channel='ml';

-- RLS: mismo criterio que el resto del admin (usuarios autenticados); ml_auth queda cerrada
alter table public.ml_listings enable row level security;
alter table public.ml_auth enable row level security;
alter table public.agent_memory enable row level security;
alter table public.price_rules enable row level security;
alter table public.product_prices enable row level security;
create policy ml_listings_all on public.ml_listings for all to authenticated using (true) with check (true);
create policy agent_memory_all on public.agent_memory for all to authenticated using (true) with check (true);
create policy price_rules_all on public.price_rules for all to authenticated using (true) with check (true);
create policy product_prices_all on public.product_prices for all to authenticated using (true) with check (true);

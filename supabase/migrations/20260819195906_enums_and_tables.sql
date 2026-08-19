-- Core persistence schema: enums, seven workshop tables, constraints, indexes,
-- and the set_updated_at() trigger. Greenfield additive migration (applied in
-- timestamp order, no destructive DDL).

-- ---------------------------------------------------------------------------
-- Enums (closed value sets)
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'new',
  'in_queue',
  'printing',
  'post_processing',
  'finished',
  'cancelled'
);

create type public.transaction_type as enum ('3d_service', 'supplies_sale');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Operator/admin roles. The id references auth.users so a profile is tied to a
-- real auth identity; the role is the single seam RLS reads through.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_phone_unique
  on public.customers (phone) where phone is not null;
create unique index customers_whatsapp_unique
  on public.customers (whatsapp) where whatsapp is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_price numeric(12, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text,
  color text,
  size text,
  personalization boolean not null default false,
  price_delta numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_id_idx
  on public.product_variants (product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  product_type text not null
    check (product_type in ('cup', 'trophy', 'keychain', 'other')),
  color_spec jsonb not null default '{}'::jsonb,
  personalization text,
  measurements text,
  observations text,
  order_date timestamptz not null default now(),
  due_date date not null,
  total_amount numeric(12, 2) check (total_amount >= 0),
  deposit numeric(12, 2) check (deposit >= 0),
  pending_balance numeric(12, 2) check (pending_balance >= 0),
  payment_method text
    check (payment_method in
      ('cash', 'transfer', 'uala', 'brubank', 'mercadopago', 'other')),
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_deposit_lte_total
    check (deposit is null or total_amount is null or deposit <= total_amount)
);
create index orders_due_date_status_idx
  on public.orders (due_date, status);
create index orders_customer_id_idx
  on public.orders (customer_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  order_id uuid references public.orders (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_account text,
  method text
    check (method in
      ('cash', 'transfer', 'uala', 'brubank', 'mercadopago', 'other')),
  note text,
  transacted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_order_id_idx
  on public.transactions (order_id);
create index transactions_transacted_at_idx
  on public.transactions (transacted_at);
create index transactions_type_idx
  on public.transactions (type);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text,
  material text not null,
  color text,
  brand text,
  quantity_grams numeric(10, 2),
  remaining_grams numeric(10, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger trg_inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

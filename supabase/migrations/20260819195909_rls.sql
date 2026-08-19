-- Row-level security baseline: private role-function schema, security-definer
-- role seam, RLS enable + policies on the seven core tables, and the
-- connectivity `smoke` health table.

-- ---------------------------------------------------------------------------
-- private schema (not exposed through the Data API; keeps the role function
-- out of client-visible generated types)
-- ---------------------------------------------------------------------------
create schema if not exists private;

-- Single role seam. Every policy that needs a role routes through these two
-- functions, so roles-hardening later changes only these bodies. `security
-- definer` runs the query as the owner (postgres), bypassing RLS on profiles;
-- `set search_path = ''` prevents search-path injection and RLS recursion.
create or replace function private.current_user_role()
returns text
language sql
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.transactions enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (policy matrix from design)
--   anon: no workshop access (except the `smoke` health table below)
--   authenticated (operator): read/write workshop rows; transactions admin-only
-- ---------------------------------------------------------------------------
create policy profiles_select
  on public.profiles for select to authenticated using (true);

create policy customers_all
  on public.customers for all to authenticated using (true) with check (true);
create policy orders_all
  on public.orders for all to authenticated using (true) with check (true);
create policy products_all
  on public.products for all to authenticated using (true) with check (true);
create policy product_variants_all
  on public.product_variants for all to authenticated using (true) with check (true);
create policy inventory_all
  on public.inventory for all to authenticated using (true) with check (true);

create policy transactions_all
  on public.transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Connectivity `smoke` health table. Exposed to anon for a no-auth connectivity
-- probe; exists as a migration (not seed) so it is present on the cloud project.
-- ---------------------------------------------------------------------------
create table public.smoke (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.smoke enable row level security;
create policy smoke_select
  on public.smoke for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Table privileges. Design relies on "RLS is the sole gate", which requires
-- anon/authenticated to hold the underlying table privileges so RLS (not a
-- missing GRANT) is what blocks access. Granted explicitly so behaviour is
-- deterministic regardless of the project's default-privileges setting.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated;

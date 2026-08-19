# Design: Data Model Core — Supabase schema, RLS baseline, generated types

## Technical Approach

Formalize the persistence layer as raw SQL migrations managed by the Supabase CLI (single source of truth), with Postgres enums for closed sets, `text` + `CHECK` for open lists, UUID PKs, and RLS gated through one security-definer role seam. Generated types derive from the local schema; enum constants derive from the generated types so completeness is compile-time enforced. No data-access layer, no auth UI.

## Architecture Decisions

| # | Decision | Rationale (tradeoffs already committed in exploration #169) |
|---|----------|-------------------------------------------------------------|
| 1 | **Migration layout**: two additive migrations, applied via `supabase db reset` | Tables are FK-coupled (transactions→orders→customers) — one migration ships the full graph atomically; RLS split out for review isolation. Idempotency = `db reset`, not `IF NOT EXISTS` guards |
| 2 | **Enums** (`order_status`, `transaction_type`) vs `text`+`CHECK` (`payment_method`, `product_type`) | Closed statuses get typed enums; open lists ("etc.") extend with a cheap CHECK migration |
| 3 | **Role seam**: `private.current_user_role()` + `public.is_admin()`, both `security definer` + `set search_path = ''` | One function body to change later (roles-hardening); search_path fix prevents RLS recursion + injection |
| 4 | **`handle_new_user` trigger deferred** (design note only) | Can't verify without auth flow; profiles are seedable for local tests. Refines proposal's "triggers" to `set_updated_at()` only |
| 5 | **Types**: `gen types --local --schema public` | `public` only keeps `private.current_user_role()` out of client-visible types; `is_admin()` stays callable |
| 6 | **Enum constants** derive unions from `database.types.ts` | `Record<OrderStatus, string>` forces label coverage at compile time — success criterion enforced, not manual |

## Migration Layout

`supabase/migrations/<14-digit-timestamp>_<snake_case>.sql` (created by `supabase migration new <name>`), applied in timestamp order. Two files:

1. `..._enums_and_tables.sql` — enums, 7 tables, indexes, `set_updated_at()` trigger.
2. `..._rls.sql` — `private` schema, role functions, RLS enable + policies.

### Enums and tables (migration 1)

```sql
create type public.order_status as enum ('new','in_queue','printing','post_processing','finished','cancelled');
create type public.transaction_type as enum ('3d_service','supplies_sale');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('admin','operator')),
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
create unique index customers_phone_unique on public.customers(phone) where phone is not null;
create unique index customers_whatsapp_unique on public.customers(whatsapp) where whatsapp is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_price numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text,
  color text,
  size text,
  personalization boolean not null default false,
  price_delta numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants(product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_type text not null check (product_type in ('cup','trophy','keychain','other')),
  color_spec jsonb not null default '{}'::jsonb,
  personalization text,
  measurements text,
  observations text,
  order_date timestamptz not null default now(),
  due_date date not null,
  total_amount numeric(12,2) check (total_amount >= 0),
  deposit numeric(12,2) check (deposit >= 0),
  pending_balance numeric(12,2) check (pending_balance >= 0),
  payment_method text check (payment_method in ('cash','transfer','uala','brubank','mercadopago','other')),
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_deposit_lte_total check (deposit is null or total_amount is null or deposit <= total_amount)
);
create index orders_due_date_status_idx on public.orders(due_date, status);
create index orders_customer_id_idx on public.orders(customer_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  order_id uuid references public.orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  payment_account text,
  method text check (method in ('cash','transfer','uala','brubank','mercadopago','other')),
  note text,
  transacted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_order_id_idx on public.transactions(order_id);
create index transactions_transacted_at_idx on public.transactions(transacted_at);
create index transactions_type_idx on public.transactions(type);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text,
  material text not null,
  color text,
  brand text,
  quantity_grams numeric(10,2),
  remaining_grams numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- one trigger per table with updated_at (customers, products, product_variants, orders, transactions, inventory)
create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
-- ... (repeat for the other five)
```

### RLS (migration 2)

```sql
create schema if not exists private;

create or replace function private.current_user_role()
returns text language sql security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' as $$
  select coalesce(private.current_user_role() = 'admin', false);
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.transactions enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy customers_all on public.customers for all to authenticated using (true) with check (true);
create policy orders_all on public.orders for all to authenticated using (true) with check (true);
create policy products_all on public.products for all to authenticated using (true) with check (true);
create policy product_variants_all on public.product_variants for all to authenticated using (true) with check (true);
create policy inventory_all on public.inventory for all to authenticated using (true) with check (true);
create policy transactions_all on public.transactions for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

### Policy matrix

| Table | anon | authenticated (operator) | admin |
|-------|------|--------------------------|-------|
| `customers` | — | SELECT/INSERT/UPDATE/DELETE | same as operator |
| `orders` | — | SELECT/INSERT/UPDATE/DELETE | same as operator |
| `products` | — | SELECT/INSERT/UPDATE/DELETE | same as operator |
| `product_variants` | — | SELECT/INSERT/UPDATE/DELETE | same as operator |
| `inventory` | — | SELECT/INSERT/UPDATE/DELETE | same as operator |
| `transactions` | — | — | SELECT/INSERT/UPDATE/DELETE |
| `profiles` | — | SELECT | SELECT |

Grants: rely on Supabase default table privileges (`anon`/`authenticated` granted in `public`); RLS is the sole gate. No custom grants.

**Deferred financial nuance (explicit)**: RLS is row-level, not column-level. `orders.total_amount`/`deposit`/`pending_balance` remain operator-readable by design. Column-level restriction (view + column grants) is `roles-hardening` work. `transactions` admin-only already protects the reconciliation register.

### Design note — `handle_new_user` (deferred)

```sql
-- Deferred to the auth change (NOT built here, no auth UI):
-- create or replace function public.handle_new_user()
-- returns trigger language plpgsql security definer set search_path = '' as $$
--   begin insert into public.profiles (id) values (new.id); return new; end $$;
-- create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
```
Profiles are seedable manually for local RLS tests until this lands.

## Type Generation

```bash
npx supabase gen types typescript --local --schema public > src/lib/database.types.ts
```

- Output: `src/lib/database.types.ts` (generated, never hand-edited).
- Regeneration: after every migration change; wired as the `gen:types` npm script.
- Drift gate (verify): run `gen:types`, then `git diff --exit-code -- src/lib/database.types.ts` — non-empty diff = drift = fail.

`supabase.ts` swaps the placeholder for the real type:

```ts
import type { Database } from './database.types'
export const supabase: SupabaseClient<Database> = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
```

## Enum Constants

`src/lib/domain-constants.ts` derives unions from generated types so a missing label fails `tsc`:

```ts
import type { Database } from './database.types'
export type OrderStatus = Database['public']['Enums']['order_status']
export type TransactionType = Database['public']['Enums']['transaction_type']

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New', in_queue: 'In Queue', printing: 'Printing',
  post_processing: 'Post-processing', finished: 'Finished', cancelled: 'Cancelled',
}
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  '3d_service': '3D Service', supplies_sale: 'Supplies Sale',
}
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'var(--color-gray)', in_queue: 'var(--color-orange)', printing: 'var(--color-orange)',
  post_processing: 'var(--color-gray)', finished: 'var(--color-black)', cancelled: 'var(--color-gray)',
}
```

Urgency traffic-light colors (overdue/today/close) are a separate `agenda-view` concern — not here.

## Data Flow — RLS evaluation

```
client (supabase-js, anon key)
   │  SELECT * FROM orders
   ▼
PostgREST ──► auth.uid() = session user
   │            │
   │            ▼
   │         policy: to authenticated using (true)  ── anon → no policy → 0 rows
   │         policy: transactions using (is_admin())
   │                        │
   │                        ▼
   │              private.current_user_role()  ──► profiles.role
   │                        │
   ▼                        ▼
  orders: operator ✓ / admin ✓        transactions: operator ✗ / admin ✓
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/config.toml` | Create | generated by `supabase init`, defaults (seed path `supabase/seed.sql`) |
| `supabase/migrations/*_enums_and_tables.sql` | Create | enums + 7 tables + indexes + `set_updated_at` trigger |
| `supabase/migrations/*_rls.sql` | Create | `private` schema, role functions, RLS + policies |
| `supabase/seed.sql` | Create | `smoke` health table (anon-select policy) + fixtures |
| `supabase/tests/rls.test.sql` | Create | pgTAP negative RLS tests |
| `src/lib/database.types.ts` | Create | generated types (excluded from review forecast) |
| `src/lib/supabase.ts` | Modify | replace placeholder `Database` with generated type import |
| `src/lib/domain-constants.ts` | Create | enum label/color constants |
| `package.json` | Modify | `gen:types`, `db:reset`, `db:test` scripts |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| RLS (integration) | anon → 0 rows (orders, transactions); operator → orders readable incl. financial cols, transactions = 0; admin → transactions readable | `supabase test db` (pgTAP) in `supabase/tests/rls.test.sql` using `set local role` to simulate anon/authenticated/admin |
| Type drift | `database.types.ts` up to date | `gen:types` + `git diff --exit-code` |
| Unit | `domain-constants` covers every enum value; env validation unchanged | vitest, hermetic |
| Build | `tsc --noEmit`, `vite build` | existing quality gates |

## Migration / Rollout

Additive (greenfield) — no data migration. Rollback = delete `supabase/`, `database.types.ts`, `domain-constants.ts`; restore placeholder `Database` in `supabase.ts`; remove scripts. No destructive DDL on existing data.

## Environment Gate (BLOCKING)

apply/verify are **BLOCKED** on local verification until Docker Desktop + Supabase CLI are provisioned (obs #170: `docker` not found, `supabase` CLI not found, `npx supabase` = 2.115.0 works but `supabase start` still needs a Docker daemon). apply MUST NOT silently proceed with skipped RLS tests.

## Non-Goals (explicit)

Data-access layer / typed query helpers (→ orders-core); column-level financial restriction on `orders` (→ roles-hardening); Supabase cloud project, auth UI, `handle_new_user` trigger (→ auth change); catalog/public read on `products` (→ catalog-phase1); `payment_method`/`product_type` TS constants (→ orders-core/finance forms).

## Open Questions

- [ ] `handle_new_user` trigger: proposal listed it in-scope; this design defers it (no auth flow to verify against). Confirm deferral is accepted.
- [ ] `payment_method` list: requirements say "Cash, Transfer, Ualá, Brubank, etc."; this design commits `cash,transfer,uala,brubank,mercadopago,other`. Confirm `mercadopago` inclusion is desired now vs later.

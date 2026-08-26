-- order_items: an order MAY hold one or more line items, each with its own
-- product type, full-length description, personalization, per-part color
-- spec, quantity, and price. Child table (not a jsonb array column) so items
-- stay queryable/orderable, mirroring how product_variants relates to
-- products. Additive only — existing single-item fields on `orders` are kept
-- untouched as the fast path for the common one-product order.

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_type text not null
    check (product_type in ('cup', 'trophy', 'keychain', 'other')),
  description text not null,
  personalization text,
  color_spec jsonb not null default '{}'::jsonb,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) check (unit_price >= 0),
  line_total numeric(12, 2) check (line_total >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);
create trigger trg_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

alter table public.order_items enable row level security;
create policy order_items_all
  on public.order_items for all to authenticated using (true) with check (true);

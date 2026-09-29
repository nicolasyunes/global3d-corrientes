-- Preset products carry the list of parts to print ("Vaso milkshake Spiderman":
-- cabeza roja ×1, ojos negro ×2, …). When an order item is linked to a
-- product, the app copies these parts into order_production_tasks, multiplied
-- by the item quantity, so the checklist starts filled in.

create table public.product_parts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  color text,
  quantity integer not null default 1 check (quantity > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_parts_product_idx
  on public.product_parts (product_id, position);

alter table public.product_parts enable row level security;

-- Same shape as products: everyone reads (order modal), only admin edits.
create policy product_parts_read
  on public.product_parts for select to authenticated using (true);
create policy product_parts_write
  on public.product_parts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Which preset (if any) an order item came from. Free-text items stay null.
alter table public.order_items
  add column product_id uuid references public.products(id) on delete set null;

create index order_items_product_idx on public.order_items (product_id);

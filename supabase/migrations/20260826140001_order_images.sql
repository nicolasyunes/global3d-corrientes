-- order_images: a flat per-order image gallery (reference photos, generated
-- mockups, logos to create), each with an optional free-text note. Order-level
-- (not per order_item) — confirmed sufficient for the current usage. Child
-- table, not a jsonb array, matching order_items / order_production_tasks.
-- See openspec/changes/2026-08-26-order-images-and-link/design.md.

create table public.order_images (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  storage_path text not null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index order_images_order_id_idx on public.order_images (order_id);

alter table public.order_images enable row level security;
create policy order_images_all
  on public.order_images for all to authenticated using (true) with check (true);

-- Storage: public bucket, mirroring the product-images precedent
-- (supabase/migrations/20260825120000_product_stock_images.sql), except
-- write/delete are open to any authenticated operator (not admin-only) —
-- orders and order_items are already writable by any operator.
insert into storage.buckets (id, name, public)
values ('order-images', 'order-images', true)
on conflict (id) do nothing;

create policy order_images_bucket_read
  on storage.objects for select
  using (bucket_id = 'order-images');

create policy order_images_bucket_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'order-images');

create policy order_images_bucket_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'order-images');

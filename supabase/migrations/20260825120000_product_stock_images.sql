-- Product management admin screen: stock + a single cover image per product,
-- plus a storage bucket to hold the uploaded files. Additive on `products`.

alter table public.products
  add column stock_quantity integer not null default 0 check (stock_quantity >= 0),
  add column image_url text;

-- ---------------------------------------------------------------------------
-- Storage: one public bucket for product cover images. Public so the image
-- URLs saved on `products.image_url` can be used directly by <img src> from
-- the (currently static) storefront without a signed-URL round trip later.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_public_read
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy product_images_admin_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_update
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: unlike orders/sales (shared by all operators), stock/pricing/image
-- edits are scoped to admin only, per product decision — the other tables'
-- "any operator" policy shape does not apply here.
-- ---------------------------------------------------------------------------
drop policy products_all on public.products;
create policy products_all
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

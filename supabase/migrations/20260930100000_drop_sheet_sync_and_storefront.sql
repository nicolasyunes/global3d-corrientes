-- The workshop no longer uses the Google Sheet: orders and supplies stop
-- syncing to it. The public storefront is gone too, so its catalog columns and
-- tables go with it. Data the workshop still uses (orders, customers,
-- inventory, transactions, products with their stock) is untouched.

-- ---------------------------------------------------------------------------
-- Google Sheet sync
-- ---------------------------------------------------------------------------
drop trigger if exists trg_orders_sync_to_sheet on public.orders;
drop trigger if exists trg_inventory_sync_to_sheet on public.inventory;
drop function if exists public.sync_order_to_sheet();
drop function if exists public.sync_insumo_to_sheet();
drop table if exists public.sheet_sync_config;

-- ---------------------------------------------------------------------------
-- Storefront catalog leftovers
-- ---------------------------------------------------------------------------
drop table if exists public.product_variants;

alter table public.products
  drop column if exists category_id,
  drop column if exists subcategory,
  drop column if exists slug,
  drop column if exists sku,
  drop column if exists compare_at_price,
  drop column if exists weight_grams,
  drop column if exists personalizable,
  drop column if exists custom_on_request;

drop table if exists public.categories;

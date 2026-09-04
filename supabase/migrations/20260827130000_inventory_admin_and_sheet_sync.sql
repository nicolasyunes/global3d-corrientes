-- Insumos (filament supply) stock ⇄ Google Sheet sync, phase 1: schema.
--
-- The team keeps filament stock (marca / tipo PLA·PETG / color, all 1kg rolls)
-- in a Google Sheet tab. This makes `public.inventory` the mirror of that tab:
-- a stable join key (`sku`), a per-roll sale price, and two config columns that
-- point the existing sheet-sync machinery at the insumos tab. Rolls are stored
-- as grams (`rolls * 1000`) so `consume_inventory()` (20260824160001) keeps
-- working unchanged.

-- ---------------------------------------------------------------------------
-- inventory: sale price + a NOT NULL, UNIQUE sku to upsert against
-- ---------------------------------------------------------------------------
alter table public.inventory
  add column unit_price numeric(10, 2);

-- Backfill blank skus from a brand/material/color slug.
update public.inventory
  set sku = lower(
    regexp_replace(
      coalesce(brand, '') || '-' || coalesce(material, '') || '-' || coalesce(color, ''),
      '[^a-zA-Z0-9]+', '-', 'g'
    )
  )
  where sku is null or btrim(sku) = '';

-- Disambiguate any leftover duplicates so the unique index can be built.
update public.inventory i
  set sku = i.sku || '-' || substr(i.id::text, 1, 8)
  from (
    select sku from public.inventory group by sku having count(*) > 1
  ) dup
  where i.sku = dup.sku;

create unique index inventory_sku_key on public.inventory (sku);
alter table public.inventory alter column sku set not null;

-- ---------------------------------------------------------------------------
-- sheet_sync_config: where the insumos tab lives + which Edge Function the
-- write-back trigger POSTs to. Both nullable → "not configured yet, don't
-- sync", same convention as the Google credential columns (20260824150000).
-- ---------------------------------------------------------------------------
alter table public.sheet_sync_config
  add column insumos_tab_name text,
  add column insumos_edge_function_url text;

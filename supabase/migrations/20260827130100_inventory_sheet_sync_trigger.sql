-- Insumos stock ⇄ Google Sheet sync, phase 2: DB → Sheet write-back.
--
-- Same fire-and-forget shape as sync_order_to_sheet() (20260824150001): a
-- pg_net POST queued after commit, so an unreachable Sheets API never blocks a
-- sale or a stock adjustment. Fires on every insert/adjustment to `inventory`,
-- which is what pushes a `supplies_sale` consumption or a manual +/- from the
-- admin into the planilla.
--
-- Bounce guard: the Sheet → DB import (read-insumos-stock) writes rows into
-- `inventory` too. The import only issues an UPDATE for rows whose values
-- actually changed, and this function additionally ignores UPDATEs that touch
-- none of the mirrored columns — so re-importing an unchanged planilla
-- produces zero write-backs, and a genuinely changed row writes its new value
-- back once (identical to what the sheet already holds) and then settles.

create or replace function public.sync_insumo_to_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.sheet_sync_config;
begin
  select * into cfg from public.sheet_sync_config where id = true;

  -- Not configured (no insumos tab / URL) — no-op, don't error.
  if cfg is null
     or cfg.insumos_tab_name is null
     or cfg.insumos_edge_function_url is null then
    return new;
  end if;

  -- Skip UPDATEs that don't move any mirrored column (e.g. an updated_at-only
  -- touch, or a re-import writing the same values).
  if tg_op = 'UPDATE' and not (
       old.remaining_grams is distinct from new.remaining_grams
    or old.unit_price      is distinct from new.unit_price
    or old.brand           is distinct from new.brand
    or old.material        is distinct from new.material
    or old.color           is distinct from new.color
    or old.active          is distinct from new.active
    or old.sku             is distinct from new.sku
  ) then
    return new;
  end if;

  perform net.http_post(
    url := cfg.insumos_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', cfg.webhook_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'record', to_jsonb(new)
    )
  );

  return new;
end;
$$;

create trigger trg_inventory_sync_to_sheet
  after insert or update on public.inventory
  for each row execute function public.sync_insumo_to_sheet();

-- Trigger-only function: close the auto-exposed PostgREST RPC endpoint, same
-- hardening as 20260824150003 for sync_order_to_sheet().
revoke execute on function public.sync_insumo_to_sheet() from public, anon, authenticated;

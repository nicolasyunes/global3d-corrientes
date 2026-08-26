-- sheets-mirror-sync: which tab within the spreadsheet to sync to, editable
-- without a redeploy. Default 'Pedidos' matches the current tab name in
-- "Pedidos - Nueva" — confirm/adjust during Phase 0 setup if it differs.

alter table public.sheet_sync_config
  add column sheet_tab_name text not null default 'Pedidos';

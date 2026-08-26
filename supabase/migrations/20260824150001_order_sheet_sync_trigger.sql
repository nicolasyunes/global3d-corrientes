-- sheets-mirror-sync: fire-and-forget order sync via pg_net. The HTTP call is
-- queued by net.http_post() and delivered by a background worker after this
-- transaction commits, so an unreachable Sheets API or Edge Function can never
-- block, slow down, or fail an order save.

create or replace function public.sync_order_to_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.sheet_sync_config;
begin
  select * into cfg from public.sheet_sync_config where id = true;

  -- Not configured yet (Phase 0 manual setup pending) — no-op, don't error.
  if cfg is null then
    return new;
  end if;

  perform net.http_post(
    url := cfg.edge_function_url,
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

create trigger trg_orders_sync_to_sheet
  after insert or update on public.orders
  for each row execute function public.sync_order_to_sheet();

-- sheets-mirror-sync: enable pg_net, create the singleton config table that
-- holds sync credentials/settings. RLS is enabled with no policies granted to
-- anon/authenticated (default-deny); service_role bypasses RLS by design and
-- is the only reader (the Edge Function, via its auto-provisioned
-- SUPABASE_SERVICE_ROLE_KEY). Explicit revoke mirrors the "grant explicitly,
-- don't rely on defaults" approach already used in rls.sql.

create extension if not exists pg_net;

create table public.sheet_sync_config (
  id boolean primary key default true,
  constraint sheet_sync_config_singleton check (id),
  webhook_secret text not null,
  sheet_id text not null,
  edge_function_url text not null,
  google_service_account_email text,
  google_service_account_private_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_sheet_sync_config_updated_at
  before update on public.sheet_sync_config
  for each row execute function public.set_updated_at();

alter table public.sheet_sync_config enable row level security;
revoke all on public.sheet_sync_config from anon, authenticated;
-- No policies created: anon/authenticated have zero access under RLS even if
-- ever granted table privileges by a future migration. service_role bypasses
-- RLS entirely and is the only intended reader/writer.

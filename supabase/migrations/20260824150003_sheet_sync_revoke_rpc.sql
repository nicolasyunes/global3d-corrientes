-- sheets-mirror-sync hardening (advisor cleanup): `sync_order_to_sheet()` is a
-- trigger-only function (reads NEW/TG_OP, meaningless outside a trigger
-- context). PostgREST auto-exposes every public-schema function as an RPC
-- endpoint unless revoked. Triggers fire independent of role EXECUTE grants,
-- so this only closes the unintended public/anon/authenticated RPC endpoint —
-- the trigger itself keeps firing on every order insert/update.

revoke execute on function public.sync_order_to_sheet() from public, anon, authenticated;

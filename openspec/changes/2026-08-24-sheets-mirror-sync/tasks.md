# Tasks: sheets-mirror-sync

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200–300 (Edge Function only; no app code changes) |
| 400-line budget risk | Low |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single PR |

Decision needed before apply: **Yes** — the Google Cloud service account (Phase 0) must exist before the sync can write anything; everything else below is already live.

**Implementation note — deviated from design.md in two low-risk ways, both applied directly against the live project (`bukjmleercxlxbexekos`) via the Supabase MCP tools rather than the CLI/dashboard:**
1. The Database Webhook is a `pg_net`-backed trigger (`trg_orders_sync_to_sheet`) created by SQL migration, not the Dashboard "Database Webhooks" UI — same underlying mechanism (Supabase's own dashboard feature is built on the same `pg_net`), created this way because it's scriptable and reviewable as a migration.
2. Credentials live in a new singleton table `public.sheet_sync_config` (RLS-locked to `service_role` only) instead of `supabase secrets set` env vars — no CLI access from this session. The Edge Function reads it at request time via its auto-provisioned service-role client. Functionally equivalent; easier to update without a redeploy.

## Phase 0: Manual setup (outside the repo) — **you**

- [ ] 0.1 Create a Google Cloud project (or reuse one) and enable the Sheets API.
- [ ] 0.2 Create a service account; download its JSON key.
- [ ] 0.3 Share "Pedidos - Nueva" with the service account email, Editor access.
- [ ] 0.4 Add hidden column `K` (`_web_order_id`) to the "Pedidos" tab.
- [ ] 0.5 Send the service account email + private key so the `sheet_sync_config` row can be completed (see chat for the safest way to hand it over).

## Phase 1: Edge Function

- [x] 1.1 Create `supabase/functions/sync-order-to-sheet/index.ts` — webhook secret check, payload parsing.
- [x] 1.2 Order+customer fetch via service-role client.
- [x] 1.3 Field mapping module (`toSheetRow(order)`) — pure function; encodes the mapping table in design.md, including the `finished → Listo` status note.
- [x] 1.4 Google Sheets API client: `getAccessToken()` (service-account JWT bearer via `npm:jose`), `upsertOrderRow()` (find-by-column-K, update or append).
- [ ] 1.5 Unit tests: `toSheetRow` mapping (all status/channel/product combinations, including nulls); date/currency formatting matches existing sheet rows. **Not yet written** — no local shell access from this session to run `npm test`; do this next local session, or ask for it and it'll be added blind (reasoned through, not executed).
- [x] 1.6 Deployed: `sync-order-to-sheet` is live on project `bukjmleercxlxbexekos` (version 1, `verify_jwt: false`, custom auth via `X-Webhook-Secret`).

## Phase 2: Wire the webhook

- [x] 2.1 `trg_orders_sync_to_sheet` trigger created (`orders`, insert + update) — calls `net.http_post()` to the deployed function with the shared secret header.
- [x] 2.2 End-to-end check: inserted a synthetic test order directly in Supabase (not through the app UI, to avoid needing the running dev server); confirmed via `net._http_response` that the trigger fired and the function responded `200`. Test rows deleted immediately after.
- [ ] 2.3 Real check once Phase 0 is done: create/edit an order in the running app, confirm the sheet row appears/updates.
- [ ] 2.4 Failure-path check: temporarily break the service account's sheet access, confirm the order still saves normally and the failure shows in `net._http_response` / function logs, not a silent drop.

**Advisor cleanup applied along the way**: `sync_order_to_sheet()` is trigger-only (reads `NEW`/`TG_OP`) but Postgres/PostgREST exposes every `public`-schema function as a callable RPC endpoint by default — revoked `EXECUTE` from `public`/`anon`/`authenticated` so it's only reachable by the trigger, not `/rest/v1/rpc/sync_order_to_sheet`. Re-verified the trigger still fires after the revoke (second synthetic test, same result).

## Phase 3: Week-1 checkpoint

- [ ] 3.1 At the end of week 1, confirm with the team whether the sheet is still being checked.
- [ ] 3.2 If trust in the app is established: delete the Database Webhook (Rollback Plan, one action, zero app impact).
- [ ] 3.3 If not: keep it running and revisit in another week rather than removing it prematurely.

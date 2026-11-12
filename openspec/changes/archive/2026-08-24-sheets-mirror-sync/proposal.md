# Proposal: sheets-mirror-sync — Week-1 Orders Mirror to Google Sheets

## Intent

For the first week the team uses the workshop app for real, they want every order to also be visible in the existing "Pedidos - Nueva" spreadsheet, as a familiar safety net while trust in the new app builds. The order MUST still be captured only once — re-introducing double entry would recreate the exact duplicate-order problem (`Marce Paso` logged four different ways across four rows) this whole project starts from. This change adds a one-way, automatic mirror: every order saved in the app updates or appends its row in the spreadsheet, with no operator action. **Deliverable: workshop app + a small piece of infrastructure outside it** (Supabase Edge Function).

## Scope

### In Scope

- A Supabase Database Webhook on `orders` (insert + update) calling a new Edge Function.
- The Edge Function writes/updates one row per order in "Pedidos - Nueva" (spreadsheet ID `1_We4vuurs5OIPgRRsiP9szFISwnzDJ1LEPmtrXnK6LY`), matched by order UUID stored in a new bookkeeping column (`K`, hidden) — never by row position or by name-matching, which is exactly what produces duplicates today.
- Field mapping from `orders` (+ `customers`) to the sheet's existing columns (CLIENTE, PRODUCTO, DESCRIPCION, FECHA DE ENTREGA, Total (ARS), SEÑA, SALDO, CANAL, ESTADO). `Columna 1` (the old manual sequence number) is left blank for app-sourced rows, same as the ~90% of existing rows that already have no number.
- Sync direction is one-way: web app → sheet. The sheet is a read-only mirror for this week; nobody edits the sheet directly, and nothing written to the sheet is read back into the app.

### Out of Scope

- Two-way sync (sheet edits flowing back into the app) — not needed once capture happens only in the app, and it reopens the conflict/race problem this project is meant to close.
- Mirroring `order_items` (from `order-items-and-supplies-sales`, if/when that ships) or supplies sales into the sheet — out of scope; the sheet mirror covers `orders` only.
- A permanent integration. This is explicitly a transition aid — see Rollback Plan.

## Capabilities

### New

- `sheets-mirror-sync`: async, one-way, idempotent mirror of `orders` rows into the existing spreadsheet.

### Modified

- None. No schema change to `orders`; the bookkeeping column lives in the spreadsheet, not the database.

## Approach

- The webhook fires **after** the order is committed in Supabase — sheet sync can never block, slow down, or fail an order save. If the Sheets API is down, the order still saves; the mirror catches up on the next successful call or a manual replay.
- Idempotent upsert keyed by the order's UUID (written once into the hidden column, never re-derived from name/date) is the direct fix for the exact failure mode found in the original spreadsheet audit: the same customer typed four different ways across four separate rows.
- A Google service account (not a personal account) holds edit access to the spreadsheet, scoped to that one file. Credentials live only as Supabase Edge Function secrets — never in client code or the repo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/functions/sync-order-to-sheet/*` | New | Edge Function: receives the webhook, upserts a sheet row |
| Supabase project config (Database Webhooks) | New | `orders` insert/update → Edge Function URL |
| Google Sheets ("Pedidos - Nueva") | Modified | new hidden bookkeeping column `K` (order UUID) |
| Google Cloud | New | service account, shared as Editor on the one spreadsheet |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| An operator edits/deletes the hidden bookkeeping column | Low | column is hidden + documented "no tocar"; worst case a duplicate row appears on the next sync, not data loss |
| Sheets API transient failure | Low | Supabase Database Webhooks retry automatically; a missed sync self-heals on the order's next update |
| Service account key exposure | Low | stored only as an Edge Function secret; never bundled client-side |
| Team keeps relying on the sheet past week 1, undermining the point of migrating | Med | explicit removal step in Rollback Plan; revisit at the week-1 check-in |

## Rollback Plan

- Delete the Database Webhook (one action in the Supabase dashboard) — the app is entirely unaffected, since the webhook is additive and async.
- Optionally delete the Edge Function.
- The spreadsheet itself is untouched history; the hidden bookkeeping column can stay or be removed, at no risk to the data already in the app.

## Dependencies

- `orders-core` (the `orders` table and its RLS policy — the Edge Function reads via the Supabase service role, bypassing RLS by design, since it runs server-side and unattended).
- A Google Cloud project with the Sheets API enabled and a service account granted Editor on the specific spreadsheet.

## Success Criteria

- [ ] Creating an order in the app appends a matching row in "Pedidos - Nueva" within a few seconds, with no operator action.
- [ ] Editing an order in the app updates the same row (never appends a second one).
- [ ] A Sheets API outage does not block or delay saving an order in the app.
- [ ] The webhook can be disabled in one step with zero impact on the app.

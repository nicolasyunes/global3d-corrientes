# Design: sheets-mirror-sync

## Sequence

```
OrderForm (any operator)     Supabase (orders table)      Database Webhook      Edge Function              Google Sheets API
      |                             |                            |                     |                          |
      | insert/update order         |                            |                     |                          |
      |----------------------------->|                            |                     |                          |
      |<-- save confirmed ----------|                            |                     |                          |
      |  (operator moves on;         | AFTER INSERT/UPDATE        |                     |                          |
      |   sync happens unseen)       |---------------------------->|                     |                          |
      |                             |                            | POST {record, type} |                          |
      |                             |                            |--------------------->|                          |
      |                             |                            |                     | fetch order+customer     |
      |                             |                            |                     | (service role)           |
      |                             |                            |                     | GET col K for order_id --|------------------------>|
      |                             |                            |                     |<--- row index or "none" -|
      |                             |                            |                     | UPDATE row  |  APPEND row |
      |                             |                            |                     |-------------------------->|
      |                             |                            |                     |<--- 200 --- |             |
      |                             |                            |<---- 200 -----------|                          |
```

Order save and sheet sync are decoupled by construction: the webhook fires only after the transaction that saved the order has already committed, so nothing about the sync path can affect whether an order save succeeds.

## Field mapping

| Sheet column | Source | Notes |
|---|---|---|
| `Columna 1` | *(left blank)* | matches the ~90% of existing rows with no manual number; no new numbering scheme invented |
| `CLIENTE` | `customers.name` | via `orders.customer_id` |
| `PRODUCTO` | `PRODUCT_TYPE_LABELS[orders.product_type]` | Spanish label (Vaso/Trofeo/Llavero/Otro) |
| `DESCRIPCION` | `personalization` + `measurements` + `observations`, joined with ` — ` | full text, no truncation — this is a mirror of the same unbounded `text` columns already in Postgres |
| `FECHA DE ENTREGA` | `due_date` | formatted `dd/mm/yyyy` to match existing rows |
| `Total (ARS)` | `total_amount` | formatted `$#.##0,00` to match existing rows |
| `SEÑA` | `deposit` | same format |
| `SALDO` | `pending_balance` | same format; stored value as-is, per `order-detail`'s source-of-truth rule |
| `CANAL` | `ORIGIN_CHANNEL_LABELS[orders.origin_channel]` | blank when null |
| `ESTADO` | mapped from `orders.status` — see below | |
| `K` *(new, hidden)* | `orders.id` | bookkeeping only; never shown to operators, never edited by hand |

### Status mapping — a gap worth flagging

The spreadsheet audit found `ESTADO = Entregado` on 36 of 77 rows (47%, the single most common value) and `Listo` on 7. The app's `order_status` enum stops at `finished` — there is no "delivered to customer" step distinct from "ready". For this sync, `finished` maps to `Listo`, since that is the closest true meaning; nothing maps to `Entregado`, because the app cannot currently express it.

This is flagged here rather than silently patched: adding a `delivered` step to `order_status` is a small, additive enum change (`ALTER TYPE ... ADD VALUE`), but it changes the `order-detail` status-progression capability, which is outside this change's scope. Recommend raising it as its own short follow-up once the team confirms "ready" and "delivered" are genuinely two different moments worth tracking separately (it looks that way from the data, but worth confirming — it may just mean "picked up" vs "shipped").

| `orders.status` | Sheet `ESTADO` |
|---|---|
| `new`, `in_queue`, `printing` | *(blank)* |
| `post_processing` | `Post-procesado` |
| `finished` | `Listo` |
| `cancelled` | `Cancelado` |

## Edge Function

`supabase/functions/sync-order-to-sheet/index.ts` (Deno):

1. Verify a shared-secret header (`X-Webhook-Secret`) against an Edge Function secret — Supabase Database Webhooks support a custom header, so an unauthenticated request to the function URL is rejected before doing any work.
2. Parse the payload for `record.id` and `type` (`INSERT` / `UPDATE`).
3. Query `orders` joined to `customers` for that id, using the Supabase service role key (server-side only; never shipped to the client) — RLS is bypassed here by design, the same pattern the `orders-core` dev-seed script already uses for service-role operations.
4. Call Sheets API `values.get` on column `K` to find the row with a matching order id.
5. `values.update` that row if found, else `values.append` a new one.
6. Return `200`. A non-2xx response makes Supabase's built-in webhook retry pick it up again — no custom retry logic needed.

## Credentials

- A Google Cloud service account, Sheets API enabled, granted **Editor** on the one spreadsheet only (never a broader Drive scope).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID` stored as Supabase Edge Function secrets (`supabase secrets set`), never committed, never in `.env` files that reach the client bundle.

## Manual setup (outside this repo, one-time)

1. Create the Google Cloud service account + enable the Sheets API.
2. Share "Pedidos - Nueva" with the service account's email as Editor.
3. Insert a new column `K`, header `_web_order_id`, hide it.
4. `supabase secrets set` the three credential values.
5. Create the Database Webhook in the Supabase dashboard pointing at the deployed function.

# Tasks: order-items-and-supplies-sales

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500–600 (excl. generated types + lockfile) |
| 400-line budget risk | High |
| 800-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR1 migration+RLS decision → PR2 order items form → PR3 sales capture + `/admin/ventas` |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: **Yes** — confirm the `transactions` RLS relaxation (see proposal.md "Decision needed") before Phase 1 ships.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migration: `order_items`, `transactions` columns, `consume_inventory()`, RLS change | PR1 | base `feature/order-items-and-supplies`; autonomous once RLS decision is confirmed |
| 2 | `order_items` capture in `OrderForm` + detail display | PR2 | base PR1; depends on regenerated types |
| 3 | Supplies sale capture (`SalesForm`) + `/admin/ventas` | PR3 | base PR1; independent of PR2, can run in parallel |

## Phase 1: Schema

- [ ] 1.1 Confirm the `transactions` RLS decision with the team (proposal.md).
- [ ] 1.2 Create `supabase/migrations/<ts>_order_items.sql` — `order_items` table, index, `updated_at` trigger, RLS enable + `order_items_all` policy.
- [ ] 1.3 Create `supabase/migrations/<ts>_supplies_sale_inventory_link.sql` — `transactions.inventory_id` / `quantity_grams`, `inventory.remaining_grams >= 0` CHECK, `consume_inventory()` function + trigger, `transactions_all` policy change (drop admin-only, recreate as `to authenticated`).
- [ ] 1.4 Apply migrations (`supabase db reset`), regenerate types (`npm run gen:types`, excluded from review).
- [ ] 1.5 Integration test: insufficient-stock sale is rejected and rolls back cleanly (no partial `transactions` row); sufficient-stock sale decrements `remaining_grams` by exactly `quantity_grams`.
- [ ] 1.6 Integration test: non-admin authenticated user can insert/select `transactions` (RLS regression guard for the policy change).

## Phase 2: Order items capture

- [ ] 2.1 `src/features/orders/orders.api.ts`: `listOrderItems(orderId)`, `replaceOrderItems(orderId, items[])` (delete-then-insert, simplest correct semantics for a short list).
- [ ] 2.2 `src/features/orders/OrderForm.tsx`: collapsed "+ agregar ítem" section; repeatable row (product type, description, personalization, quantity, unit price); removing the last row collapses back to single-product fields.
- [ ] 2.3 `src/features/orders/OrderDetail.tsx`: render items list (if any) below the order's own fields.
- [ ] 2.4 Unit tests: item-row add/remove logic; zero items still submits the existing single-product order unchanged.

## Phase 3: Supplies sales

- [ ] 3.1 Create `src/features/sales/sales.api.ts` — typed helpers: `listInventory()` (active spools), `createSale(input)` (inserts a `supplies_sale` transaction).
- [ ] 3.2 Create `src/features/sales/SalesForm.tsx` — spool picker (material/color/brand from `inventory`), grams sold, amount, payment method; surfaces the insufficient-stock error from 1.5 as an inline message, not a raw Postgres error.
- [ ] 3.3 Create `src/features/sales/SalesList.tsx` — `/admin/ventas`, reusing `OrdersList` row/empty-state visual pattern.
- [ ] 3.4 Mount `/admin/ventas` + `/admin/ventas/new` routes.
- [ ] 3.5 Unit tests: form validation (spool required, grams > 0, grams ≤ spool's `remaining_grams` client-side pre-check for fast feedback ahead of the DB round trip).

## Phase 4: Verify + cleanup

- [ ] 4.1 `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all pass.
- [ ] 4.2 Manual check: capture a 20-item trophy order end-to-end on a mobile viewport; confirm no truncation anywhere in the description field.

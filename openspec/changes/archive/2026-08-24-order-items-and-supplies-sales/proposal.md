# Proposal: order-items-and-supplies-sales — Multi-Item Orders + Linked Supplies Sales

## Intent

Two gaps surfaced from real usage of the spreadsheet this change replaces: (1) an order today is one product/personalization pair, but batch or custom jobs (e.g. 20 trophies, each with a different plaque text and category) need several distinct, fully-described pieces under one order; (2) the business also sells loose filament/supplies, and those sales need to be recorded against actual stock so remaining grams stay accurate, instead of a separate spreadsheet the operator has to reconcile by hand. Both gaps are additive on top of `orders-core`; neither changes how a simple, single-product order is captured today. **Deliverable: workshop app** (internal management).

## Scope

### In Scope

- `order_items`: an order MAY hold one or more line items, each with its own product type, full-length description, personalization, per-part color spec, quantity, and price. Quick-order capture is unchanged (still a single implicit item) — "add item" is an opt-in step, not a new required screen.
- Existing single-item fields on `orders` (`product_type`, `personalization`, `color_spec`, `measurements`) are kept for backward compatibility with orders created before this change, and remain the fast path for the common one-product order. They are NOT removed or migrated.
- `transactions.inventory_id` + `transactions.quantity_grams` (additive, nullable): a `supplies_sale` transaction MAY reference the exact `inventory` row (spool) sold and the grams sold.
- `consume_inventory()` trigger: on insert of a `supplies_sale` transaction with `inventory_id` set, decrements `inventory.remaining_grams` by `quantity_grams`; rejects the insert if it would go negative (can't sell more than what's on the shelf).
- `/admin/ventas`: a minimal list of `supplies_sale` transactions (date, spool, grams, amount, method) — the screen `transactions` has had no UI since it was deferred in `orders-core`. Scope here is capture + list only, not the full arqueo/finance-registry capability.
- Relax `transactions` RLS from admin-only to `to authenticated`, matching every other operational table (`orders_all`, `customers_all`, …). See **Decision needed** below.

### Out of Scope

- Estimating/decrementing filament automatically when an *order* (not a direct supplies sale) goes into production — that needs a per-product material-usage estimate, which does not exist yet. Flagged as a natural follow-up once `order_items` has real usage data.
- Full finance registry / cash reconciliation ("arqueos") — `finance-registry` stays deferred; `/admin/ventas` is a narrow slice of it (supplies sales only).
- Editing/deleting historical `order_items` rows once an order is `finished` (no lock/audit trail yet).
- Blank/adjustment inventory movements (breakage, spool swap mid-print) — only sale-driven consumption is in scope.

## Capabilities

### New

- `order-items`: multi-item capture inside an existing order; each item carries its own description/personalization/color/quantity/price.
- `supplies-sales`: record a sale against a specific `inventory` row; stock decrements automatically; minimal `/admin/ventas` list.

### Modified

- `database-schema`: additive `order_items` table; additive `transactions.inventory_id` / `transactions.quantity_grams`; new `consume_inventory()` trigger; `inventory.remaining_grams` gains a `>= 0` CHECK.
- `row-level-security`: `transactions_all` policy changed from `public.is_admin()` to `to authenticated` (see Decision needed).

## Decision needed

`transactions` was scoped admin-only in `orders-core`'s original RLS design, matching a single-owner-operator assumption. The team now confirmed three people share all workshop duties with no fixed roles — so gating supplies-sale capture to whichever profile happens to be `role = 'admin'` would block two of the three operators from recording a sale at the register. This proposal opens `transactions` to `to authenticated` (same policy shape as `orders_all`), keeping `is_admin()` available for a future stricter finance-registry screen if the team wants one later. **Confirm before merge.**

## Approach

- `order_items` is a child table (`order_id` FK, `on delete cascade`), not a JSON array column on `orders` — keeps each item queryable/orderable and consistent with how `product_variants` already relates to `products`.
- `OrderForm` gains an items section behind a collapsed "+ agregar ítem" affordance; zero items on submit falls back to the existing single-product fields untouched (no behavior change for the common case).
- `consume_inventory()` is a single `AFTER INSERT` trigger on `transactions`, mirroring the existing `set_updated_at()` trigger pattern already used on every table.
- No new page-load choreography or navigation restructuring: `/admin/ventas` is a peer route to `/admin/orders`, reusing `OrdersList`'s row/empty-state patterns.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/*` | New | additive `order_items` table, `transactions` columns, `consume_inventory()` trigger, RLS policy change |
| `src/features/orders/OrderForm.tsx` | Modified | optional multi-item section |
| `src/features/orders/orders.api.ts` | Modified | `order_items` CRUD helpers |
| `src/features/sales/*` | New | `SalesForm.tsx`, `SalesList.tsx`, `sales.api.ts` |
| `src/lib/domain-constants.ts` | Modified | no new enum (reuses `PRODUCT_TYPE`) |
| `src/lib/database.types.ts` | Modified | regenerated (excluded from review) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Negative-stock trigger blocks a legitimate correction (e.g. recording a sale made before the spool was logged) | Med | trigger only fires on `supplies_sale` with `inventory_id` set; a sale without a linked spool still records (amount-only), unblocking the operator |
| RLS relaxation on `transactions` widens write access | Low | matches the access level every other operational table already has; `is_admin()` stays available for a future stricter screen |
| `order_items` adds a join to every order read | Low | order list/detail keep reading `orders` alone; items are fetched only on the detail view, lazily |

## Rollback Plan

- Drop `order_items` (additive-only; no existing data references it).
- Drop `transactions.inventory_id` / `transactions.quantity_grams`; drop `consume_inventory()` trigger and function.
- Revert `transactions_all` policy to `public.is_admin()`.
- Remove `src/features/sales/*`; remove the items section from `OrderForm.tsx`.

## Dependencies

- `orders-core` archive (orders table, `OrderForm`, `orders.api.ts`).
- `data-model-core` archive (`inventory`, `transactions`, RLS baseline).

## Success Criteria

- [ ] A single-product order can still be captured in the current quick-order flow, unchanged.
- [ ] An order can hold 2+ items, each with its own full-length description/personalization/color/quantity/price, without truncation.
- [ ] A supplies sale linked to a spool decrements `inventory.remaining_grams` by the sold amount.
- [ ] Selling more grams than remain is rejected with a clear error, not a silent negative balance.
- [ ] `/admin/ventas` lists supplies sales with spool, grams, amount, date.
- [ ] `npm test`, `npm run build`, and `tsc` pass.

# Tasks: orders-core — Order Entry + Capture

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650–750 (excl. generated types + lockfile) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 migration+constants+tokens → PR2 order form → PR3 list+detail |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migration + constants + token reconciliation | PR1 | base `feature/orders-core`; autonomous |
| 2 | Order form (entry + quick-order) | PR2 | base PR1; depends on constants |
| 3 | List + detail | PR3 | base PR2; depends on `orders.api.ts` |

**Prerequisite**: seeded operator session (`dev-session.ts`) — RLS `orders_all`/`customers_all` are `to authenticated`; without a signed-in session `/admin` renders blank (0 rows). Dev-only auto sign-in seam; NO login UI.

## Phase 1: Foundation (migration + constants + tokens)

- [ ] 1.1 Create `supabase/migrations/20260820000000_orders_origin_channel.sql` — `alter table public.orders add column origin_channel text check (origin_channel in ('facebook','whatsapp','instagram','other'))`.
- [ ] 1.2 Apply migration (`supabase db reset`) then regenerate types: `npm run gen:types` (excluded from review).
- [ ] 1.3 `src/lib/domain-constants.ts`: add `PAYMENT_METHOD`, `PRODUCT_TYPE`, `ORIGIN_CHANNEL` (`as const` arrays + derived unions) + label maps.
- [ ] 1.4 Replace `ORDER_STATUS_COLORS` dead tokens (`--color-gray`/`--color-black`): new→amber, in_queue/printing/post_processing→orange, finished→teal, cancelled→carbon; add `URGENCY_COLORS` (red/amber/green/teal).
- [ ] 1.5 Reconcile `src/styles/tokens.css`: `--color-orange:#F37021`, `--color-carbon:#1D1D1B`, `--color-white:#FFFFFF`, `--color-teal:#0E7C66`, functional red/amber/green + carbon-soft/muted; remove gray/black.
- [ ] 1.6 Fix remaining hex literals / dead-token refs in `base.css` + components (grep `#` and `--color-gray|--color-black`).
- [ ] 1.7 Unit test: constants match CHECK lists; color maps reference tokens, not hex.

## Phase 2: Order entry (form + quick-order + data layer)

- [ ] 2.1 Create `src/features/orders/validation.ts` — required customer/product_type/due_date; numeric total/deposit; default `pending_balance = total − deposit`.
- [ ] 2.2 Create `src/features/orders/orders.api.ts` — typed helpers: upsert customer (match phone, else create), insert/update order, list `select('*, customers(name)')`.
- [ ] 2.3 Create `src/features/orders/OrderForm.tsx` — single mobile-first form + quick-order toggle; smart defaults (status=new, order_date=now, color_spec={}, due_date=lead time); sticky CTA; ≥44px targets; `inputmode`.
- [ ] 2.4 Create `src/features/admin/dev-session.ts` — env-gated dev-only seeded operator sign-in (service-role `auth.admin.createUser` + `signInWithPassword`).
- [ ] 2.5 Mount `/admin/orders/new` via internal `<Routes>` in `admin.route.tsx`; invoke dev-session seam.
- [ ] 2.6 Unit tests: validation + smart defaults (vitest/jsdom, no DB).

## Phase 3: List + detail

- [ ] 3.1 Create `src/features/orders/OrdersList.tsx` — Today/Upcoming tabs, `due_date ASC`, `status != cancelled`; row (name/product/due/status badge/pending); empty state; tap→detail.
- [ ] 3.2 Create `src/features/orders/OrderDetail.tsx` — view/edit (reuse `OrderForm`) + status progression (advance next enum step, cancel) + pending-balance as source of truth.
- [ ] 3.3 Mount `/admin/orders` (landing) + `/admin/orders/:id`; delete `AdminPage.tsx`; redirect `/admin` → `/admin/orders`.
- [ ] 3.4 Unit tests: status progression (next step), badge color mapping, list sort/filter.
- [ ] 3.5 Integration test (env-gated): seeded operator CRUD orders + `origin_channel` CHECK (reject `email`); anon blocked.

## Phase 4: Verify + cleanup

- [ ] 4.1 `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` all pass.
- [ ] 4.2 Confirm no raw hex outside `tokens.css`; `--color-gray`/`--color-black` fully removed.

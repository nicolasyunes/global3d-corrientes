# Verification Report: orders-core — Order Entry + Capture

- **Change**: `orders-core`
- **Mode**: Standard (strict_tdd: false)
- **Verdict**: **PASS WITH WARNINGS**
- **Branch**: `feature/orders-core` (commits `b533be1` → `fe8ae57` → `34941dc`; working tree clean)
- **Date**: 2026-08-20

## Completeness

| Dimension | Status | Evidence |
|---|---|---|
| Proposal | Present | `proposal.md` (intent/scope/capabilities/risks/rollback) |
| Specs (6 delta) | Present | `specs/{order-entry,orders-list,order-detail,design-tokens,database-schema,enum-constants}` |
| Design | Present | `design.md` (approach, decisions, data flow, file changes) |
| Tasks | Present | `tasks.md` — Phases 1–3 fully `[x]`; Phase 4 verify/cleanup `[ ]` (see below) |
| Source-of-truth specs | Present | `openspec/specs/` (8 capabilities) |
| Apply progress | Present | engram `sdd/orders-core/apply-progress` (obs #197) |

**Task completion**: Phase 1 (7/7), Phase 2 (6/6), Phase 3 (5/5) all `[x]`. Phase 4 `4.1`/`4.2` remain `[ ]` but are the verify-phase's own gates — this report now proves them (see Gate Evidence); tick them at archive.

## Gate Evidence (executed live)

| Gate | Result | Notes |
|---|---|---|
| `npm test` | ✅ **46/46 passed** (9 files) | Cloud integration tests RAN (not skipped): `orders.integration.test.ts` (operator CRUD + `origin_channel` CHECK rejects `email` + anon blocked), `operator-session.integration.test.ts`, `rls.integration.test.ts`, `supabase.smoke.test.ts` all green against `bukjmleercxlxbexekos` |
| `npm run typecheck` | ✅ pass | `tsc --noEmit` (app + node configs) |
| `npm run build` | ✅ pass (91 modules) | Admin chunk split (`admin.route-*.js`) from public entry; 1 benign vite warning (see W-2) |
| `npm run lint` | ✅ pass | `eslint .` |
| `npm run format:check` | ⚠️ fail on `DESIGN.md` only | Pre-existing (deviation #2); all `src/` files pass |

## Spec Compliance Matrix

Legend: ✅ passing runtime/unit test · 🧪 source-inspected (no component test, pure/UI logic) · ⚠️ deviation (non-spec-breaking)

### order-entry (NEW)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| Quick Order Capture — minimal taps | ✅ | `OrderForm.tsx` quick/full toggle; `createOrder` inserts `status:'new'`, `color_spec:{}`, `due_date` default |
| Quick Order Capture — smart defaults | ✅ | `status='new'` (code + DB default), `order_date=now()` (DB default), `color_spec={}` (DB default + code), `due_date=defaultDueDate()` (3 business days, weekend-safe) — `validation.test.ts` |
| Required Field Validation — block on missing | ✅ | `validateOrder` requires customer/product_type/due_date; `validation.test.ts` (19 tests) |
| Required Field Validation — complete submits | ✅ | `validation.test.ts` "passes when required fields are complete" |
| Optional Detail Fields — omitted on fast capture | ✅ | All optional fields nullable; quick mode hides Details section; `draftFromOrder`/insert pass null |
| Optional Detail Fields — refined later | ✅ | Edit flow persists all optional fields via `updateOrder` |
| Pending Balance Recorded — stored, not recomputed | ✅ | `resolvedPendingBalance` (total − deposit, override honored); `draftFromOrder` copies `pending_balance` verbatim; `validation.test.ts` |

### orders-list (NEW)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| Landing Due-Date List — tabs, sort ASC, hide cancelled | ✅ | `OrdersList.tsx` + `list.ts#shapeOrders` (filter cancelled, sort `due_date ASC`, split Today/Upcoming); `list.test.ts` (4 tests) |
| Empty state | 🧪 | `OrdersList.tsx` empty-state block ("No orders due today" / hint) — no component test, but pure rendering |
| Correct sort | ✅ | `list.test.ts` "sorts active orders by due_date ascending" |
| Cancelled orders hidden | ✅ | `list.test.ts` "hides cancelled orders" |
| Status Badge — mapped color token | ✅ | `StatusBadge.tsx` (label + `ORDER_STATUS_COLORS`); `domain-constants.test.ts` badge mapping |
| Tap to Open Detail | 🧪 | `Link to=/admin/orders/:id` on each row — no component test (routing integration) |
| "Today" includes overdue (`due_date <= today`) | ⚠️ deviation #4 | `shapeOrders` partitions `<= today` into Today (surfaces overdue, ASC) |

### order-detail (NEW)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| View and Edit — all fields shown | ✅ | `OrderDetail.tsx` reuses `OrderForm` in edit mode; `draftFromOrder` prefills all fields incl. pending balance |
| View and Edit — edit persists | ✅ | `updateCustomer` + `updateOrder`; `onSaved` → `refresh()` re-reads row |
| Status Progression — next enum step | ✅ | `status.ts#nextOrderStatus` walks `new→in_queue→printing→post_processing→finished`; `status.test.ts` (3 tests) |
| Status Progression — cancelled | ✅ | `OrderDetail` Cancel sets `cancelled`; hidden from list (shapeOrders filter) |
| Pending Balance Semantics — stored verbatim, no "wrong" flag | ✅ | `OrderDetail` renders `order.pending_balance` via `formatMoney`; `draftFromOrder` never recomputes |

### design-tokens (MODIFIED)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| Official Palette as CSS custom properties (orange/carbon/white/teal) | ✅ | `tokens.css`: `--color-orange:#f37021`, `--color-carbon:#1d1d1b`, `--color-white:#ffffff`, `--color-teal:#0e7c66` (lowercase = Prettier; case-insensitive per deviation #1) |
| Light-gray token removed | ✅ | grep `f0f0f0|light-gray|color-gray|color-black` → no matches in `src/` |
| No raw color literals outside tokens file | ✅ | Hex sweep: `#[0-9a-f]{3,8}` appears ONLY in `tokens.css` (7 values, all palette/status tokens) |

### database-schema (MODIFIED)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| CHECK for open lists + `origin_channel` (facebook/whatsapp/instagram/other, nullable) | ✅ | Migration `20260820000000_orders_origin_channel.sql` additive `text` + CHECK |
| Origin channel captured / unknown rejected / nullable | ✅ | **Live cloud proof**: `orders.integration.test.ts` inserted `facebook`+`whatsapp`, rejected `email` via CHECK; nullable (existing rows unaffected) |

### enum-constants (MODIFIED)
| Requirement / Scenario | Status | Evidence |
|---|---|---|
| Open-list constants match CHECK lists | ✅ | `PAYMENT_METHOD`/`PRODUCT_TYPE`/`ORIGIN_CHANNEL` in `domain-constants.ts`; `domain-constants.test.ts` asserts exact lists |
| Label + color mappings (status + urgency semaphore) | ✅ | `ORDER_STATUS_LABELS`, `ORDER_STATUS_COLORS` (token refs, not hex), `URGENCY_COLORS` (red/amber/green/teal); `domain-constants.test.ts` |

## Correctness

| Check | Result |
|---|---|
| Required fields enforced before insert | ✅ `validateOrder` gates `handleSubmit`; `noValidate` + client validation |
| `pending_balance` source-of-truth, not recomputed on read | ✅ `draftFromOrder` verbatim copy; detail renders stored value |
| Deposit ≤ total guarded in UI and DB | ✅ UI `validateOrder` (`deposit > total`), DB `orders_deposit_lte_total` CHECK |
| Constants typed from generated types | ✅ `OrderStatus`/`TransactionType` derive from `Database['public']['Enums']`; open-lists are `as const` (text+CHECK → `string`, no enum to derive — documented rationale) |
| No dead tokens / removed gray/black | ✅ grep clean; `ORDER_STATUS_COLORS` test asserts no `--color-(gray|black)` |
| Seeded session never ships service role to browser | ✅ `dev-session.ts`: browser seam gated on `VITE_ENABLE_DEV_SESSION`; service role only in Node `seedOperatorSession` (non-VITE env) |

## Design Coherence

| Decision | Implemented as designed | Notes |
|---|---|---|
| Single form + quick-order toggle | ✅ one `OrderForm`, `mode` toggle | |
| Seeded dev operator session, no login UI | ✅ `dev-session.ts` (env-gated) | browser seam conservative (VITE gate) — deviation #6 |
| `origin_channel` additive nullable + CHECK | ✅ | |
| `pending_balance` stored, editable, source-of-truth | ✅ | |
| Open-list TS types as literal unions | ✅ | |
| Route nesting inside lazy `admin.route.tsx` | ✅ internal `<Routes>`; `router.tsx` unchanged | |
| Create redirects to detail | ⚠️ deviation #3 | kept repeat-capture (banner + reset); `onSaved` exposed for future redirect |
| Status badge ~12% tint via color-mix | ✅ `StatusBadge` uses `color-mix(... 12%, white)` | deviation #5 (per DESIGN.md) |
| Mobile-first, ≥44px targets, `inputmode`, sticky CTA | ✅ `orders.css` + form | desktop only adds via `min-width` |

## Issues

### CRITICAL
None.

### WARNING
- **W-1 — `format:check` fails on `DESIGN.md`** (pre-existing, deviation #2). Not introduced by this change (planning commit `18cb825`). All `src/` files pass. **Fix path**: `npx prettier --write DESIGN.md`, or add `DESIGN.md` to `.prettierignore`.
- **W-2 — Vite build warning**: `@/lib/supabase` is both dynamically (dev-session) and statically (orders.api) imported in the admin chunk, so the dynamic import won't split it further. Benign — admin chunk already split from the public entry; no bundle regression.

### SUGGESTION
- **S-1**: Tick `tasks.md` `4.1`/`4.2` at archive (both now proven by this report).
- **S-2**: `dev-session.ts` comment claims the lazy import keeps the anon client out of the bundle "only when enabled" — but `supabase` is also statically imported by `orders.api.ts` in the same chunk. Harmless; optionally simplify to a static import.
- **S-3**: Empty-state / tap-to-detail / edit-persist behaviors are source-inspected, not component-tested. Optional component tests (React Testing Library) if the team wants runtime coverage of those UI scenarios.

## Archive Reconciliation Items

At archive, sync the 6 delta specs into `openspec/specs/`:

1. **database-schema** (MODIFIED): add `origin_channel` (nullable, `facebook|whatsapp|instagram|other`) to the "CHECK Constraints for Open Lists" requirement and its scenarios.
2. **design-tokens** (MODIFIED): replace the old palette requirement text (`black #000000`, `orange #FF6800`, `light gray #F0F0F0`) with the new palette (`orange #F37021`, `carbon #1D1D1B`, `white #FFFFFF`, `teal #0E7C66`) — the source-of-truth spec still carries the retired values.
3. **enum-constants** (MODIFIED): remove the "DEFERRED" markers on `payment_method`/`product_type`; add `origin_channel`; add `URGENCY_COLORS` + label/color mapping requirement.
4. **order-entry**, **orders-list**, **order-detail** (NEW): promote as three new capability specs.

No destructive deltas; archive is additive. No secrets captured.

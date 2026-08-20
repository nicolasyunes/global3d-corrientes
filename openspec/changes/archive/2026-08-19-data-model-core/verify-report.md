# Verification Report — data-model-core

**Change**: data-model-core (Supabase schema, RLS baseline, generated types)
**Version**: N/A (greenfield, no prior version)
**Mode**: Standard (strict_tdd: false)
**Executor**: sdd-verify — direct source inspection + live cloud schema introspection + re-run of all quality gates

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |

All 13 tasks marked `[x]` in `tasks.md`. Cross-checked against the 4 commits on `feature/data-model-core` (`ff4f3d5`, `932257c`, `56316bd`, `01ece54`) — commit contents match the task breakdown (schema, RLS, types+constants, openspec docs).

## Build & Tests Execution

**Build**: ✅ Passed
```text
npm run build  →  vite v6.4.3  ·  36 modules transformed  ·  built in 859ms
```

**Tests**: ✅ 8 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
npm test  →  vitest run
  ✓ src/lib/env.test.ts                       (4 tests)
  ✓ src/lib/supabase.smoke.test.ts            (1 test)  [ran against cloud — 764ms]
  ✓ src/lib/rls.integration.test.ts           (3 tests) [ran against cloud — 3038ms]
  Test Files  3 passed (3)
       Tests  8 passed (8)
```

**Typecheck**: ✅ `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json` — pass

**Lint**: ✅ `eslint .` — pass (0 errors)

**Format check**: ✅ `prettier --check .` — "All matched files use Prettier code style!"

**Drift gate**: ✅ CLEAN
```text
npm run gen:types  →  regenerated src/lib/database.types.ts
git diff --exit-code -- src/lib/database.types.ts  →  empty diff (in sync)
```
Note: `gen:types` reads `DATABASE_URL`/`SUPABASE_DB_URL`/`--db-url`. Neither is committed in `.env` (only `SUPABASE_DB_PASSWORD`). The drift gate was reproduced by reconstructing the session-pooler URL from the known ref/region + password. See SUGGESTION #1.

**Coverage**: ➖ Not available (`coverage: false` in config; threshold 0).

## Spec Compliance Matrix

Compliance established by: **(T)** passing automated test · **(L)** live cloud schema introspection (direct `pg` query against `bukjmleercxlxbexekos`) · **(S)** static source inspection.

### database-schema

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Core Tables | All core tables exist | **(L)** 7 tables present, UUID PKs | ✅ COMPLIANT |
| Enums | Order status accepts enum values only | **(L)** `order_status` = 6 values incl `cancelled`; column typed to enum | ✅ COMPLIANT |
| Enums | Transaction type uses the enum | **(L)** `transaction_type` = `3d_service`,`supplies_sale`; column typed to enum | ✅ COMPLIANT |
| CHECK (open lists) | Known value accepted | **(L)** `payment_method` CHECK = 6 values, `product_type` = 4 values | ✅ COMPLIANT |
| CHECK (open lists) | Unknown value rejected | **(L)** CHECK constraints present | ✅ COMPLIANT |
| Column Types | Color spec round-trips as JSON | **(S)** `color_spec jsonb not null default '{}'` | ✅ COMPLIANT |
| Column Types | Due date has no time component | **(S)** `due_date date not null` | ✅ COMPLIANT |
| Amount Validation | Over-deposit rejected | **(L)** CHECK `orders_deposit_lte_total` | ✅ COMPLIANT |
| FK Integrity | Deleting customer cascades to orders | **(L)** `orders_customer_id_fkey` on_delete=cascade | ✅ COMPLIANT |
| FK Integrity | Deleting order with transactions blocked | **(L)** `transactions_order_id_fkey` on_delete=restrict | ✅ COMPLIANT |
| Indexes | Agenda indexes exist | **(L)** `orders_due_date_status_idx`, `orders_customer_id_idx` | ✅ COMPLIANT |
| Triggers | Updated timestamp auto-refreshes | **(L)** 6 × `set_updated_at` BEFORE UPDATE triggers | ✅ COMPLIANT |
| Triggers | New auth user gets a profile | — `on_auth_user_created()` NOT implemented (deferred) | ❌ NOT IMPLEMENTED |

### row-level-security

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| RLS Enabled | Every core table has RLS | **(L)** `relrowsecurity=true` on all 7 tables | ✅ COMPLIANT |
| Security-Definer Fns | Role function hardened | **(L)** `security_definer=true`, `proconfig=[search_path=""]` on both fns | ✅ COMPLIANT |
| Security-Definer Fns | is_admin resolves from profiles | no auth user exists to exercise | ⚠️ UNTESTED |
| Anonymous Denied | Anon cannot read orders (negative) | **(T)** `rls.integration.test.ts > blocks anon read of orders` PASSED (0 rows, service_role sanity) | ✅ COMPLIANT |
| Anonymous Denied | Anon cannot read transactions (negative) | **(T)** `rls.integration.test.ts > blocks anon read of transactions` PASSED (0 rows) | ✅ COMPLIANT |
| Operator Matrix | Operator reads/writes orders | auth operator session unavailable | ⚠️ UNTESTED |
| Operator Matrix | Operator cannot read transactions (negative) | auth operator session unavailable | ⚠️ UNTESTED |
| Admin-Only Transactions | Admin reads/writes transactions | auth admin session unavailable | ⚠️ UNTESTED |
| Admin-Only Transactions | Non-admin cannot write transactions (negative) | auth admin session unavailable | ⚠️ UNTESTED |

Additional runtime coverage beyond spec: anon **write** (insert) to orders is blocked — `rls.integration.test.ts > blocks anon write (insert) to orders` PASSED.

### generated-types

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Known path | Types file exists | **(S)** `src/lib/database.types.ts` (425 lines), committed | ✅ COMPLIANT |
| Typed client | Client uses generated types | **(S)** `supabase.ts` imports `Database`, no placeholder | ✅ COMPLIANT |
| Drift detection | Types in sync | **(T)** drift gate re-run → empty diff | ✅ COMPLIANT |
| Drift detection | Drift flagged | **(S)** mechanism `gen:types` + `git diff --exit-code` present | ✅ COMPLIANT |

### enum-constants

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Order Status | Constants cover every status | **(S)** `ORDER_STATUS` + `ORDER_STATUS_LABELS` cover all 6, typed from `Database['public']['Enums']` | ✅ COMPLIANT |
| Transaction Type | Both types mapped | **(S)** `TRANSACTION_TYPE` + labels cover both values | ✅ COMPLIANT |
| Open-List | Payment methods match CHECK | — `payment_method`/`product_type` constants NOT implemented (deferred) | ❌ NOT IMPLEMENTED |
| Label/Color | Status resolves to label and color | **(S)** `ORDER_STATUS_LABELS` + `ORDER_STATUS_COLORS` (`Record<OrderStatus>` compile-time coverage) | ✅ COMPLIANT |

**Compliance summary**: 23/30 scenarios COMPLIANT · 5 UNTESTED · 2 NOT IMPLEMENTED (deferred, spec-drift).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| 7 tables + 2 enums | ✅ | `profiles`, `customers`, `orders`, `products`, `product_variants`, `inventory`, `transactions` + `order_status`(6), `transaction_type`(2) |
| UUID PKs via `gen_random_uuid()` | ✅ | every table except `profiles` (references `auth.users.id`) |
| CHECKs (open lists, amounts, deposit≤total) | ✅ | verified live: 9 CHECK constraints |
| FKs (CASCADE/RESTRICT) | ✅ | verified live: cascade on orders.customer_id, product_variants.product_id, profiles.id; restrict on transactions.order_id |
| `transactions.order_id` nullable | ✅ | no NOT NULL on `order_id` (supplies sales) |
| Indexes (agenda + FKs + unique phone/whatsapp) | ✅ | verified live: 8 non-PK indexes |
| `set_updated_at()` trigger | ✅ | function + 6 BEFORE UPDATE triggers, verified live |
| `private.current_user_role()` / `public.is_admin()` | ✅ | security definer + `set search_path=''`, verified live |
| RLS enabled on 7 tables | ✅ | verified live |
| Policy matrix (anon=none, operator=rw, transactions=admin) | ✅ | verified live: 8 policies |
| `Database` type wired into client | ✅ | `createClient<Database>` |
| Enum constants mirror enums | ✅ | compile-time `Record` coverage |
| Explicit GRANTs to anon/authenticated | ✅ | `grant ... on all tables in schema public` in rls migration |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| 1 · Two additive migrations, atomic graph | ✅ | `_enums_and_tables.sql` + `_rls.sql` |
| 2 · Enums vs text+CHECK | ✅ | `order_status`/`transaction_type` enum; `payment_method`/`product_type`/`method` text+CHECK |
| 3 · Single role seam (`private.current_user_role` + `is_admin`) | ✅ | both security definer + `search_path=''` |
| 4 · `handle_new_user` deferred | ✅ | not built; spec still lists it → reconciliation |
| 5 · Types `--schema public` | ✅ | `private` schema not in generated types; `is_admin` still exported |
| 6 · Enum constants derive unions from generated types | ✅ | `Record<OrderStatus, string>` compile-time coverage |
| Policy matrix | ✅ | matches design table exactly (anon=none, operator=rw on 5 tables, transactions admin-only, profiles select) |

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Operator/admin RLS matrix UNTESTED at runtime** (5 scenarios: is_admin resolution, operator rw orders, operator cannot read transactions, admin rw transactions, non-admin cannot write transactions). Deferred per sanctioned deviation — no live auth flow exists, so no operator/admin sessions can be created. The policies implementing this matrix are verified present and correctly scoped in the live DB (`transactions_all` uses `is_admin()`; operator tables use `to authenticated using(true)`), and the anon negative tests prove the RLS boundary is active. **Re-verify at runtime when the auth change lands.** Risk is bounded: anon (the highest-risk financial leak) is covered by passing tests; the untested matrix concerns already-authenticated workshop staff.
2. **`on_auth_user_created()` / `handle_new_user` trigger NOT implemented** — spec `database-schema` "Triggers" still requires it, but design decision #4 deferred it. Archive reconciliation item.
3. **Open-List Constants NOT implemented** — spec `enum-constants` "Open-List Constants" requires `payment_method`/`product_type` TS constants, but design Non-Goals deferred them to orders-core. Archive reconciliation item.

**SUGGESTION**:
1. `.env.example` documents only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. It omits `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and the `DATABASE_URL`/`SUPABASE_DB_URL` needed by `gen:types`. As committed, `npm run gen:types` fails with "Missing connection string" — the drift gate is only reproducible after manually reconstructing the session-pooler URL (`postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres`). Document this in `.env.example` or add a `.env`-aware loader to `gen-types.mjs`.
2. `db:reset` script (`supabase db reset`) requires Docker and will not run on this machine. Consider documenting the cloud-only workflow (`supabase db push`) as the primary reset path for this project.
3. `vitest` logs "Multiple GoTrueClient instances detected" during `npm test` (the smoke and RLS tests each create a Supabase client in the same jsdom context). Harmless, but future tests should share a client or set distinct `auth.storageKey`s.

## Verdict

**PASS WITH WARNINGS**

All quality gates pass with real execution evidence (8/8 tests including live RLS anon-negative + connectivity smoke against the cloud project; typecheck, build, lint, format check, and the type-drift gate all clean). The live cloud schema was independently introspected and matches the migration source of truth exactly (7 tables + 2 enums, UUID PKs, CHECKs, FKs with correct delete rules, agenda indexes, 6 `set_updated_at` triggers, security-definer role functions with `search_path=''`, RLS enabled on all 7 tables, correct policy matrix). Two spec items are knowingly deferred by design (`handle_new_user` trigger, Open-List constants) and require delta-spec reconciliation at archive; the operator/admin RLS matrix is implemented correctly but untested at runtime pending an auth flow.

## Archive Reconciliation Items

1. **`database-schema` spec · "Triggers" requirement** — amend the delta spec to mark `on_auth_user_created()` / `handle_new_user` as deferred (lands in the auth change), so archive does not record an unbuilt trigger as a delivered capability.
2. **`enum-constants` spec · "Open-List Constants" requirement** — amend the delta spec to move `payment_method`/`product_type` constants out of this change (deferred to orders-core per design Non-Goals), or explicitly accept the deferral as a recorded spec exception.

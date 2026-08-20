# Tasks: Data Model Core — Supabase schema, RLS baseline, generated types

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 reviewable (excludes generated `database.types.ts` + lockfile — no new npm deps) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1: enums+tables → PR2: RLS + pgTAP → PR3: types + wiring + constants |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Enums + 7 tables + indexes + `set_updated_at` triggers | PR 1 | base = feature/tracker branch |
| 2 | RLS migration + pgTAP negative tests | PR 2 | base = PR 1 branch |
| 3 | gen types + client wiring + enum constants + scripts | PR 3 | base = PR 2 branch |

## Phase 1: Environment + Supabase Init (Foundation)

- [x] 1.1 **BLOCKING prerequisite**: install Docker Desktop + Supabase CLI (or provide a cloud project). Apply/verify cannot run until satisfied (obs #170/#172). Record, do not skip. — **Resolved via cloud project** `bukjmleercxlxbexekos` (Docker still absent; see Deviations).
- [x] 1.2 Run `supabase init` in repo root → `supabase/config.toml`; set seed path to `supabase/seed.sql`.

## Phase 2: Migrations (Core Schema)

- [x] 2.1 `supabase migration new enums_and_tables` → enums `order_status`(6 values incl `cancelled`), `transaction_type`; 7 tables; CHECKs (`payment_method`, `product_type`, amounts ≥0, `deposit ≤ total_amount`); FKs (`ON DELETE CASCADE`/`RESTRICT`); indexes (`orders.due_date+status`, `orders.customer_id`, variants/transactions); `set_updated_at()` + 6 triggers.
- [x] 2.2 `supabase migration new rls` → `private` schema; `private.current_user_role()` + `public.is_admin()` (both `security definer set search_path = ''`); enable RLS on 7 tables; policies per design matrix (anon = none, operator read/write, transactions `is_admin()` only).
- [x] 2.3 `supabase/seed.sql` → `smoke` health table (anon-select policy) + `admin`/`operator` `profiles` fixtures for local tests. — **Deviated**: `smoke` table lives in the rls migration (cloud `db push` does not apply seed); seed.sql holds the smoke row + documented profile fixtures.

## Phase 3: RLS Negative Tests (pgTAP)

- [x] 3.1 `supabase/tests/rls.test.sql` → anon: 0 rows on `orders` + `transactions` (incl. financial cols); operator: `orders` readable, `transactions` = 0 rows; admin: `transactions` read/write. Use `set local role`. — **Deviated**: pgTAP needs Docker; replaced with vitest integration test `src/lib/rls.integration.test.ts` (anon 0-row + write-block assertions against cloud; operator/admin assertions deferred — need live auth users).
- [x] 3.2 `package.json` add `db:test` → `supabase test db`. — **Deviated**: no `db:test` (pgTAP unavailable); RLS tests run under `npm test` (vitest).

## Phase 4: Types + Wiring + Constants

- [x] 4.1 `npx supabase gen types typescript --local --schema public` → `src/lib/database.types.ts` (generated, committed, never hand-edited). — **Deviated**: official `gen types` needs Docker (`--local`/`--db-url`) or an access token (`--linked`/`--project-id`); replaced with `scripts/gen-types.mjs` (`pg` over the cloud session pooler), same `Database` shape.
- [x] 4.2 `src/lib/supabase.ts` → import generated `Database`, remove placeholder interface.
- [x] 4.3 `src/lib/domain-constants.ts` → `OrderStatus`/`TransactionType` unions from `database.types.ts` + label maps + `ORDER_STATUS_COLORS` (compile-time `Record` coverage).
- [x] 4.4 `package.json` add `gen:types`, `db:reset` scripts; run `npm run typecheck`.

## Phase 5: Verification

- [x] 5.1 `supabase db reset` applies both migrations clean; `npm test`, `npm run typecheck`, `npm run build` pass. — **Deviated**: `db reset` unavailable (no Docker); migrations applied via `supabase db push` to cloud. `npm test` (8 passing incl. RLS + smoke), `typecheck`, `build` all green.
- [x] 5.2 Drift gate: re-run `gen:types` then `git diff --exit-code -- src/lib/database.types.ts` (empty diff = in sync).

## Notes

- `handle_new_user` trigger DEFERRED (design note only — not built here). Profiles are seeded manually.
- Spec `enum-constants` "Open-List Constants" (`payment_method`/`product_type` TS) is deferred by design Non-Goals → `orders-core`. Flag to orchestrator for archive reconciliation of the delta spec.

## Deviations (apply)

1. **Environment**: Docker unavailable → cloud project `bukjmleercxlxbexekos` used for all DB work (`db push`, type generation, RLS tests). No `supabase start` / `supabase test db` / `supabase db reset`.
2. **RLS verification**: pgTAP → vitest integration test (`src/lib/rls.integration.test.ts`) using `@supabase/supabase-js` (anon + service_role). Operator/admin assertions deferred (require live auth users). Env-gated (`skipIf`).
3. **Type generation**: `supabase gen types` (all modes) unavailable → custom `scripts/gen-types.mjs` (`pg` over session pooler), same output shape, deterministic (drift gate passes). Added `pg` devDependency (lockfile excluded from review budget).
4. **`smoke` table**: moved from seed.sql to the rls migration so it exists on cloud (cloud `db push` does not apply seed); smoke test now passes against cloud.
5. **Explicit GRANTs**: added `grant ... on all tables in schema public to anon, authenticated` in the rls migration to keep "RLS is the sole gate" deterministic regardless of the project's default-privileges setting.

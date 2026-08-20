# Proposal: Data Model Core — Supabase schema, RLS baseline, generated types

## Intent

Land the persistence layer every later feature builds on: the six core tables plus `profiles`, the RLS security boundary, generated TypeScript types, and enum constants. No data-access layer, no auth UI. This unblocks orders-core, agenda-view, kanban-board, and finance-registry.

## Scope

### In Scope
- SQL migrations: enums (`order_status`, `transaction_type`); tables `customers`, `orders`, `products`, `product_variants`, `inventory`, `transactions`, `profiles(role)`; constraints, indexes, triggers.
- RLS: `anon` no access; `authenticated` read/write; admin-only `transactions`; `private.current_user_role()` / `public.is_admin()` security-definer functions.
- Generated types: `supabase gen types --local` → `src/lib/database.types.ts`, wired into `src/lib/supabase.ts`.
- `src/lib/domain-constants.ts` (order_status/transaction_type → labels/colors).
- `supabase/config.toml`, `seed.sql`, `gen:types` / `db:reset` scripts.

### Out of Scope
- Data-access layer / typed query helpers (deferred to orders-core).
- Column-level financial restriction on `orders` (deferred to roles-hardening).
- Supabase cloud project, auth UI, catalog tables.

## Capabilities

### New Capabilities
- `database-schema`: core tables, enums, constraints, indexes, triggers.
- `row-level-security`: role matrix, policies, security-definer functions, negative access tests.
- `generated-types`: `supabase gen types` workflow + up-to-date assertion.
- `enum-constants`: order_status/transaction_type → label/color mappings.

### Modified Capabilities
- None.

## Approach

Supabase CLI SQL migrations (single source of truth). UUID PKs (`gen_random_uuid()`); enums for closed sets; `text` + CHECK for open lists (`payment_method`, `product_type`); `timestamptz` timestamps; `date` for `due_date`; `jsonb` for `color_spec`; hard delete. `set_updated_at()` and `on_auth_user_created()` triggers. RLS enforced through ONE role function so roles-hardening later changes a single function body. Full schema in one change — tables are FK-coupled (transactions→orders→customers). Deliverable: shared persistence layer, consumed first by the workshop app.

### Required RLS negative-test scenario

GIVEN an `anon` session — WHEN it reads `orders` or `transactions` — THEN zero rows are returned (including `orders` financial columns `total_amount`/`deposit`/`pending_balance`). Operators may read `orders` (financial columns included, by design) but NOT `transactions`; only admin reads `transactions`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/` | New | `config.toml`, `migrations/`, `seed.sql` |
| `src/lib/database.types.ts` | New | generated types |
| `src/lib/supabase.ts` | Modified | replace placeholder `Database` |
| `src/lib/domain-constants.ts` | New | enum constants |
| `package.json` | Modified | `gen:types`, `db:reset` scripts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker + Supabase CLI missing blocks local verify | High | Environment gate below; `npx supabase` works, Docker daemon still required |
| RLS misconfig exposes financial data | Med | Negative RLS tests (anon/operator/admin assertions) |
| Type/schema drift | Med | verify asserts `database.types.ts` up to date |
| Security-definer recursion | Low | `security definer` + `set search_path = ''` |

## Environment Gate (BLOCKING)

apply/verify are BLOCKED on local verification until Docker Desktop + Supabase CLI are installed, or a cloud project is provided. This proposal records the gate explicitly — apply must NOT silently proceed with skipped RLS tests.

## Rollback Plan

Migrations are additive (greenfield). Revert = delete `supabase/`, `database.types.ts`, `domain-constants.ts`; restore placeholder `Database` in `supabase.ts`; remove scripts. No destructive DDL on existing data.

## Dependencies

- Docker Desktop + Supabase CLI installed before apply (environment gate).
- Existing `supabase-connectivity` smoke table (seeded locally).

## Success Criteria

- [ ] Migrations apply via `supabase db reset` (local).
- [ ] RLS negative tests pass (anon/operator/admin matrix above).
- [ ] `supabase gen types --local` emits `database.types.ts`; `tsc --noEmit` passes.
- [ ] `domain-constants.ts` covers every `order_status` value.

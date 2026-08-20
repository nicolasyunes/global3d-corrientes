# Exploration: orders-core — order entry + capture (spreadsheet replacement)

**Answer up front.** `orders-core` ships the ORDER ENTRY surface — a mobile-first single fast form (create + edit + detail) plus a minimal "today / upcoming" orders list sorted by `due_date` as the `/admin` landing view. It does NOT ship the urgency agenda, kanban board, or finance registry; those remain separate changes. Fast capture is a "quick order" subset of the same form (customer name + product type + due date + optional amount), entered manually — no social/WhatsApp API integration in v1. One additive migration adds `origin_channel`; no existing column needs relaxing because the schema already makes every amount/contact field nullable.

## Current State

The persistence layer is LIVE in cloud Supabase (`bukjmleercxlxbexekos`). `data-model-core` delivered the full schema (`profiles`, `customers`, `orders`, `products`, `product_variants`, `inventory`, `transactions`), RLS baseline (operator CRUD on workshop tables, `transactions` admin-only), generated types (`src/lib/database.types.ts`), and enum constants (`src/lib/domain-constants.ts`). The app shell routes `/` → public catalog, `/admin/*` → lazy admin boundary with an auth-guard seam (`src/features/admin/admin.route.tsx`), currently rendering a placeholder `<AdminPage />`. Design tokens are the 4-color palette (`--color-black/--color-orange/--color-gray/--color-white`).

**Confirmed `orders` columns** (from `database.types.ts` + `database-schema/spec.md`):

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `customer_id` | uuid FK→customers | **no** | ON DELETE CASCADE |
| `product_type` | text + CHECK | **no** | `cup,trophy,keychain,other` |
| `due_date` | date | **no** | critical field |
| `status` | order_status enum | **no** (default `new`) | `new→in_queue→printing→post_processing→finished` + `cancelled` |
| `color_spec` | jsonb | no (default `{}`) | per-part map e.g. `{"part_a":"black"}` |
| `personalization`, `measurements`, `observations` | text | yes | free text |
| `total_amount`, `deposit`, `pending_balance` | numeric | yes | CHECK ≥0; CHECK `deposit ≤ total_amount` |
| `payment_method` | text + CHECK | yes | `cash,transfer,uala,brubank,mercadopago,other` |
| `order_date` | timestamptz | no (default `now()`) | auto |
| `created_at`, `updated_at` | timestamptz | no | trigger-managed |

**Existing indexes**: `orders_due_date_status_idx (due_date, status)` and `orders_customer_id_idx (customer_id)` — already support the landing list sort/filter.

**Key finding**: the schema is *already fast-capture-ready*. Only `customer_id`, `product_type`, `due_date` are NOT NULL on `orders`; `status`/`order_date`/`color_spec` have defaults. Every amount, contact, and detail field is nullable. No schema relaxation is required — the only addition is `origin_channel` (optional, tracking-only).

## Affected Areas

- `openspec/specs/database-schema/spec.md` — additive migration: `origin_channel` column on `orders` (delta spec in orders-core).
- `openspec/specs/enum-constants/spec.md` — deferred `payment_method`/`product_type` TS constants land here (already flagged DEFERRED→orders-core in that spec).
- `src/lib/domain-constants.ts` — add `PAYMENT_METHOD`, `PRODUCT_TYPE`, `ORIGIN_CHANNEL` constants (label maps).
- `src/lib/database.types.ts` — regenerate after migration (generated, excluded from review count).
- `src/features/admin/*` — replace placeholder `<AdminPage />` with orders landing + form + detail routes under `/admin/orders`.
- `src/features/orders/*` — NEW feature area (list, form, detail, data-access helpers).
- `src/app/router.tsx` — no change needed (lazy `/admin/*` already wildcards); orders routes mount inside `admin.route.tsx`.

## Decisions (the 7 questions)

### 1. Scope boundary

| In orders-core | Deferred (separate changes) |
|----------------|------------------------------|
| Order create + edit + detail | Urgency agenda (traffic-light sections) → `agenda-view` |
| Minimal "today / upcoming" list sorted by `due_date` (landing) | Kanban columns + dnd → `kanban-board` |
| Quick-order (fast capture) mode | Finance registry / transactions / arqueos → `finance-registry` |
| `origin_channel` capture + `payment_method`/`product_type` constants | Column-level financial restriction → `roles-hardening` |

The landing view is deliberately the *sortable due-date list*, not the full urgency agenda. Traffic-light bucketing (Urgent/This-week/Flexible) and status-column drag are separate, higher-complexity changes already scheduled in the roadmap (#4/#5/#6).

### 2. Mobile-first entry UX

**Single fast form, not a wizard.** A wizard adds taps and context-switching on a phone for a form that is 90% optional. One scrollable form, sectioned by *spacing and token backgrounds* (clean-UI constraint), with a sticky bottom primary action on mobile.

| Field | Required? | Schema target | Mobile control |
|-------|-----------|---------------|----------------|
| Customer name | **yes** | `customers.name` | text, autocomplete by phone |
| Phone / WhatsApp | optional | `customers.phone` / `.whatsapp` | tel keyboard |
| Product type | **yes** | `orders.product_type` | segmented/chip (4 values) |
| Per-part color spec | optional | `orders.color_spec` jsonb | dynamic part rows, color picker |
| Personalization / Measurements / Observations | optional | free text columns | textarea |
| **Due date** | **yes** | `orders.due_date` | native date input, smart default |
| Total amount | optional | `orders.total_amount` | `inputmode="decimal"` |
| Deposit (seña) | optional | `orders.deposit` | `inputmode="decimal"` |
| Pending balance | optional (derived) | `orders.pending_balance` | computed `total − deposit`, editable |
| Payment method | optional | `orders.payment_method` | chips |
| Status | default `new` | `orders.status` | hidden on create, editable on detail |

**Smart defaults for speed**: `status = new`, `order_date = now()`, `color_spec = {}`, `pending_balance = total_amount − deposit` (auto-filled, overridable), `due_date` defaults to a business lead time (e.g. today + 3 days, configurable). Large touch targets (≥44px), `inputmode` numeric/decimal for money, native date picker, one primary CTA.

### 3. Fast-capture mode

A "quick order" minimal mode: **customer name + product type + due date + optional amount**, `status=new`, everything else left at defaults/null. Creates the order in seconds; detail fill-in later via the same edit form. It is a *collapsed subset of the same form*, not a second code path — a mode toggle reveals/hides optional sections.

**Social inquiry flow — pragmatic v1: manual fast entry, NO API integration.** WhatsApp/IG/FB messages arrive on the operator's phone; they tap "Quick order" and transcribe the minimum fields. No Meta Business/WhatsApp Cloud API, no webhooks, no inbound message parsing this change. **Recommended**: add a paste-friendly free-text field (map to existing `observations`) so the operator can paste the raw inquiry verbatim for reference.

**`origin_channel` — worth adding.** A nullable `text` column with CHECK `(facebook, whatsapp, instagram, other)` gives channel-mix tracking for near-zero cost (additive migration). It enables a future "where do orders come from" report and is the anchor for a later API-integration change. Accept the migration.

### 4. Data mapping

- **No existing column needs relaxing.** `total_amount`, `deposit`, `pending_balance`, `payment_method`, `personalization`, `measurements`, `observations`, `phone`, `whatsapp` are all already nullable. Fast capture works against the live schema unchanged.
- **Additions**: `orders.origin_channel text` (nullable, CHECK `facebook,whatsapp,instagram,other`) — the only schema change; additive, safe against live data.
- **CHECK sufficiency**: `payment_method` and `product_type` CHECK lists are sufficient for v1 (`other` escapes both). `origin_channel` mirrors the same open-list pattern (extensible via migration, not enum).
- **Integrity note (flag for spec/design)**: `pending_balance` is *not* constrained to equal `total_amount − deposit` — only `deposit ≤ total_amount` is enforced. Keep it that way: deposits arrive in installments over time, so `pending_balance` must stay a stored, editable value, not a derived CHECK. The form computes it by default; `finance-registry` owns reconciliation truth. Do NOT add a hard equality constraint.

### 5. List / detail scope

Minimal landing list at `/admin` (orders surface), sorted by `due_date ASC`:
- Tabs: **Today** · **Upcoming** · (optionally) **All** — filtered by `due_date` (and `status != cancelled`).
- Row: customer name, product type, due date, status badge (using `ORDER_STATUS_COLORS`), pending balance.
- Tap row → detail view (read + edit, including status change to the next enum step).
- **Deferred**: urgency traffic-light sections and kanban drag columns.

### 6. Device strategy

**Responsive web (mobile browser) is sufficient now.** The app is already mobile-first (320px+ no horizontal scroll). Fast entry is single-screen with native controls; no offline requirement blocks v1.

**PWA / offline — defer.** Rationale: v1 requires connectivity to read/write Supabase (RLS depends on an authenticated session), and an offline queue + sync engine is a large, risky slice that adds no value until the operator is demonstrably working in dead zones. *Flag as a risk*: if street signal is unreliable, offline capture becomes a real pain point and should be re-raised as its own change. An installable PWA shell (manifest + service-worker static caching) is a cheap later add that does not require offline data sync.

### 7. `impeccable` skill integration

- **Drives sdd-design**: `init` (capture product context in `PRODUCT.md`) + `shape` (plan UX/UI before code) produce the `DESIGN.md` + visual world for the orders surface; **mode = Operate** (task-completion surface — scanability, consistency, native expectations outrank expression).
- **Drives sdd-apply**: UI craft during implementation per the committed visual world.
- **Friction to flag**:
  1. **clean-UI vs bold defaults.** `impeccable` defaults toward "bold / award-winning / out-of-distribution" craft; the project's *pinned brief* (design-tokens spec + requirements doc) is explicitly clean, no nested boxes, 4-color palette. Per impeccable's own rule "the brief wins," the clean-UI constraint is the brief and MUST pin the craft — impeccable must not inject nested-card aesthetics or decorative overload. Make this explicit in `PRODUCT.md` at `init`.
  2. **Teal accent unresolved.** The deep teal (`~#0E7C66`) is "under consideration." It is either added as a 5th token (needs a `design-tokens` MODIFIED delta) or dropped — decide before `shape`, since status/urgency color semantics (`ORDER_STATUS_COLORS`) currently reuse the 4 tokens. Teal is a natural fit for "in-progress/attention" status but conflicts with the current 4-color-only rule.
  3. **No incumbent visual world.** `PRODUCT.md`/`DESIGN.md` do not exist yet; `impeccable`'s `context.mjs` will route through `init` + `new-work` (new surface), which is expected and correct for the first business surface.

## Approaches (where a real fork exists)

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A. Single fast form + mode toggle (recommended)** | One code path; quick-order is a collapsed subset; fewer states to test | Slightly more conditional rendering in one component | Low–Med |
| B. Separate "quick order" and "full order" forms | Simplest mental model per screen | Two forms drift; duplicate validation; more code | Med |
| C. Wizard (multi-step) | Isolates sections | More taps on mobile; slower capture; contradicts speed goal | Med |

| Device approach | Pros | Cons | Effort |
|-----------------|------|------|--------|
| **Responsive web (recommended)** | Zero new infra; matches app-shell spec | Requires connectivity at capture time | Low |
| PWA shell only (manifest + static cache) | Installable, fast reload | No offline data; separate change | Low (deferred) |
| Full offline queue + sync | Works in dead zones | Large, risky; conflicts with RLS/auth session; premature | High (deferred) |

## Recommendation

Build `orders-core` as: (1) additive `origin_channel` migration + regenerated types + `PAYMENT_METHOD`/`PRODUCT_TYPE`/`ORIGIN_CHANNEL` constants; (2) an `/admin/orders` feature area with a single mobile-first form (create/edit) that supports a quick-order collapsed mode; (3) a "today/upcoming" landing list sorted by `due_date`; (4) a detail view with status progression. Fast capture is manual, `origin_channel` is captured as a cheap tracking field, no API integration. Defer agenda/kanban/finance/PWA. `impeccable` runs `init`+`shape` in Operate mode with the clean-UI constraint pinned as the brief.

## Risks

- **Working tree is mid-archive.** `data-model-core` was moved to `openspec/changes/archive/2026-08-19-data-model-core/` but the move is *uncommitted* (git shows deleted `openspec/changes/data-model-core/*` + untracked archive + untracked `openspec/specs/*`). `orders-core` should branch from a clean archive commit; otherwise its diff will be polluted.
- **No auth flow exists yet.** The `/admin` boundary has an auth-guard seam but no `ProtectedRoute`; RLS requires an authenticated session. orders-core needs a decision on whether to (a) assume a seeded/manual operator session for local dev, or (b) pull a minimal auth slice forward. This is the single biggest unblocking unknown for apply/verify.
- **Street connectivity** — no offline capture; if signal is unreliable on-site, fast capture stalls (mitigation: PWA/offline deferred as its own change).
- **`pending_balance` drift** — stored value can diverge from `total − deposit` by design; must not be surfaced as "wrong" in UI (it is a source-of-truth field owned by finance-registry).
- **Teal accent ambiguity** — unresolved 5th color can block `shape`; decide before design.
- **impeccable craft creep** — risk of nested-box/decorative aesthetics violating the clean-UI spec if the brief is not pinned at `init`.
- **Review budget (800 lines)** — orders feature (form + list + detail + validation + tests + migration) is the largest UI change so far; likely High risk of exceeding budget. tasks-phase must forecast and possibly chain PRs (migration+constants PR → form PR → list/detail PR). Generated types + lockfile excluded per config.

## Ready for Proposal

**Yes** — all 7 questions answered with committed recommendations. The orchestrator should tell the user:
1. Scope confirmed: entry + list + detail; agenda/kanban/finance deferred.
2. Fast capture is manual (no social API); `origin_channel` is a cheap additive field — confirm OK.
3. One decision needed before sdd-design: **teal accent — adopt as 5th token or drop?**
4. One decision needed before sdd-apply: **auth** — assume seeded operator session, or pull a minimal auth slice forward into orders-core?
5. The data-model-core archive must be committed first so orders-core branches clean.

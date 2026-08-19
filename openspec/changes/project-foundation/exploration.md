# Exploration: project-foundation — Global3D scaffold & architecture decisions

Greenfield exploration for the first SDD change. The repo contains only `openspec/config.yaml` and `.atl/`; no source code exists. This document answers the 7 approach-shaping questions so the proposal phase can commit to a stack and slice boundary without re-litigating fundamentals. Requirements source of truth: engram `project/requirements-doc` (obs #146).

## Decision Summary

| # | Question | Decision | One-line rationale |
|---|----------|----------|--------------------|
| 1 | App topology | **ONE Vite app**, route-split: public `/` (catalog) + protected `/admin` (workshop) | The real security boundary is Supabase RLS, not app count; one app shares types, client, and design system for a tiny team |
| 2 | UI framework | **React** (v18+) on Vite + TS | Largest ecosystem; only stack with mature touch-capable dnd (`dnd-kit`) for the kanban; most Supabase examples |
| 3 | Data access | **Direct Supabase client + RLS**; Edge Functions reserved for Phase 2 webhooks | Mercado Pago webhooks run on Supabase Edge Functions (verified) — no separate backend is ever needed |
| 4 | Foundation scope | **Scaffold + connectivity smoke slice**, no business modules | Fits the 800-line review budget (~450–600 reviewable lines); adding the orders slice would reach 1,300–1,700 lines |
| 5 | Slicing roadmap | **8 follow-up changes**, internal-app value first (see roadmap table) | Each change is independently deliverable and sized against the 800-line budget |
| 6 | Auth | **Supabase Auth**, protected routes, role resolution behind a SQL function from day 1 | Adding admin/operator roles later changes one function, not every RLS policy |
| 7 | Deployment | **Vercel** (Netlify equivalent) static SPA + **Supabase Cloud** | Zero-config Vite deploys with preview URLs; free tiers cover Phase 1 |

## Current State

- Repo: greenfield. Only `openspec/config.yaml` and `.atl/` registry exist. No `package.json`, no git history, no test runner.
- SDD init done 2026-08-14 (engram `sdd-init/web-global-3d`, obs #148): `strict_tdd: false` — MUST be re-evaluated after this change lands tooling (expected: vitest, tsc, eslint/prettier).
- Testing capabilities (obs #149): all layers unavailable until scaffolding.
- Session config: `execution_mode: auto`, `artifact_store: both`, `delivery_strategy: auto-forecast`, `review_budget_lines: 800`.

## Affected Areas (planned — nothing exists yet)

- `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` — Vite + TS scaffold
- `src/main.tsx`, `src/app/` — React entry, router shell (public `/` + lazy `/admin`)
- `src/lib/supabase.ts` — typed client + env validation
- `src/styles/tokens.css` — palette as CSS custom properties (`#000000`, `#FF6800`, `#F0F0F0`, `#FFFFFF`)
- `vitest.config.ts`, flat `eslint.config.js`, `.prettierrc` — quality tooling
- `supabase/config.toml` — local dev config + future `[functions.*] verify_jwt` settings
- `openspec/config.yaml` — post-apply update: re-run testing detection, re-evaluate `strict_tdd`

## Approaches

### 1. App topology: one app vs two apps

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **ONE Vite app** — public catalog at `/`, workshop at `/admin/*` behind auth, route-level code splitting | Shared generated Supabase types and domain model (products/orders are shared entities); one design system honoring the strict palette; one repo, deploy, and CI; admin chunk lazy-loads so public users never download it | Careless imports can leak admin deps into the public bundle (guard: lazy route boundary + future bundle budget); one pipeline couples release cadence | Low |
| TWO apps (catalog + workshop) | Hard process boundary; independent deploys | Duplicated types/client/design system (or monorepo tooling tax); two deploys and env configs; RLS still required anyway — the second app buys no security, only overhead for a 1–2 person team | Medium-High |

**Key insight**: the frontend split is never the security mechanism — RLS on Postgres is. Since RLS is mandatory either way, a second app duplicates effort without adding protection. Choose ONE app; put `/admin` behind `React.lazy` plus an auth guard.

### 2. UI framework

| Framework | dnd ecosystem (kanban, touch) | Mobile-first component story | Supabase examples | Verdict |
|-----------|-------------------------------|------------------------------|-------------------|---------|
| **React** | `dnd-kit` (headless, PointerSensor touch support); Atlassian `pragmatic-drag-and-drop`. `react-beautiful-dnd` is deprecated — do not use | CSS tokens or Tailwind + headless primitives (Radix/Base UI); largest mobile ecosystem | Highest (official quickstarts) | **Recommended** |
| Vue | `vue-draggable-plus` / SortableJS wrappers — good, smaller | Solid (Vuetify/Quasar) but smaller headless ecosystem | Medium | Viable fallback |
| Svelte | `svelte-dnd-action` — single-maintainer risk | Smallest ecosystem; fewest ready-made CRUD/admin pieces | Lowest | Rejected for this team |

**Choose React.** The kanban with drag-and-drop on phones (workshop usage is mobile-first) is the riskiest UI requirement; React is the only framework with multiple actively maintained, touch-capable dnd libraries. Styling: CSS custom properties for the 4-color palette (no component library lock-in, easiest way to enforce the "no nested-box AI aesthetics" rule). Tailwind is optional — decide in design phase, not here.

### 3. Data access: direct Supabase client vs thin backend

| Approach | Phase 1 fit | Phase 2 fit (Mercado Pago webhooks) | Cost/ops | Verdict |
|----------|-------------|--------------------------------------|----------|---------|
| **Direct `supabase-js` + RLS** | Zero backend to build or host; anon key is public-by-design, RLS guards data; Supabase Auth integrates with RLS via `auth.uid()` | Webhook receiver = **Supabase Edge Function** (Deno): set `verify_jwt = false` in `supabase/config.toml`, verify MP signature inside the handler, write with service-role client — verified against current Supabase docs | Free tier; no extra infra | **Recommended** |
| Thin backend (Express/Nest on Render/Railway) | Extra service, CORS, duplicated auth, second deploy | Also works, but adds an always-on server the team must operate | Paid host + ops burden | Rejected |

Phase 2 note: Edge Functions cover webhooks and any privileged operation (e.g., payment reconciliation). A dedicated backend is only justified if logic outgrows SQL + RLS + functions — not on the horizon for this business. Generate TS types from the schema (`supabase gen types`) so the frontend stays end-to-end typed.

### 4. First-slice boundary for `project-foundation` (sizing vs 800-line budget)

| Option | Estimated reviewable lines | Verdict |
|--------|----------------------------|---------|
| Scaffold-only: Vite + TS + React + router shell + Supabase client + vitest + eslint + prettier + design tokens + env validation + one connectivity smoke test | ~450–600 | **Recommended** |
| Scaffold + orders vertical slice (migration ~150 SQL, generated types ~200, form ~250, list ~150, validation ~80, tests ~150, RLS ~80) | ~1,300–1,700 | Over budget — split out |

**Recommended boundary**: scaffold + a connectivity smoke slice (typed Supabase query against one smoke table or a health RPC, one vitest test, env validation). This proves the toolchain end-to-end (Vite build, TS, tests, lint, Supabase connectivity) and unblocks the `strict_tdd` re-evaluation required by the init report — without dragging a business module into the review.

**Budget gotcha**: the dependency lockfile (`package-lock.json`, typically 4,000–8,000 lines for this stack) will dominate the diff. It is machine-generated and non-reviewable; `sdd-tasks` auto-forecast MUST count reviewable lines excluding the lockfile, or every scaffold PR will falsely flag High risk.

### 5. Change slicing roadmap (each independently deliverable)

| # | Change | Delivers | Depends on | Size risk |
|---|--------|----------|------------|-----------|
| 1 | `project-foundation` (this one) | Toolchain, router shell, tokens, Supabase client, auth plumbing | — | Low |
| 2 | `data-model-core` | First migration: `customers`, `products`, `orders` (+ status enum), `transactions`; RLS baseline + role-resolution function; generated types | 1 | Medium (RLS review) |
| 3 | `orders-core` | Structured order form (customer, per-part colors, personalization, delivery date, amount, deposit, payment method) + orders list — replaces the spreadsheet | 2 | Medium |
| 4 | `agenda-view` | Urgency agenda auto-sorted by delivery date: Urgent / This week / Flexible with traffic-light statuses | 3 | Low |
| 5 | `kanban-board` | Workshop kanban: New → In Queue → Printing → Post-processing → Finished; dnd-kit with touch sensors | 3 | Medium-High (mobile dnd) |
| 6 | `finance-registry` | Income types (3D service linked to order vs supplies sale), pending balances per customer, account registry for daily cash reconciliation | 3 | Medium |
| 7 | `catalog-phase1` | Public catalog, variants, localStorage cart, checkout-to-WhatsApp (wa.me message builder), request-quote button | 2 (products table) + 3 patterns | Medium |
| 8 | `roles-hardening` | Admin vs operator roles; restrict financial visibility | 6 (when finance data is sensitive enough) | Low |
| — | (Phase 2, future) `payments-mercadopago` | MP gateway + webhook Edge Function syncing payments | 7 + 8 | Future |

Order rationale: the workshop's pain (spreadsheet replacement) comes first; catalog reuses the products table and UI patterns; roles are deferred until financial data justifies them (see Q6); MP is Phase 2 per the requirements doc.

### 6. Auth approach (prepare for roles, don't build them)

- **Now**: Supabase Auth (email/password) for workshop users only; catalog stays anonymous. All `/admin` routes behind a `ProtectedRoute` that checks for a valid session. No role checks anywhere in the UI.
- **The preparation trick**: create a `profiles` table (`id` FK to `auth.users`, `role text default 'admin'`) and a `security definer` SQL function `current_user_role()` / `is_staff()`. Write every RLS policy through that function from day 1 (today: any authenticated user is staff). Later, enabling admin/operator enforcement changes the function body — policies and frontend stay untouched.
- **Avoid**: service-role key in the frontend (never), a hand-rolled users/passwords table, and premature role-based UI branching.

### 7. Deployment targets

- **Frontend**: Vercel static hosting (Netlify is an equivalent alternative) — zero-config Vite detection, Git-based deploys, PR preview URLs (huge for reviewing mobile UI), free tier sufficient. Requires the SPA rewrite rule (`/* → /index.html`).
- **Backend**: Supabase Cloud project (free tier to start): Postgres + Auth + Storage (product images for the catalog) + Edge Functions for Phase 2.
- **Config**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as build-time env vars; the anon key is public-by-design — RLS is the guard. Custom domain when the catalog ships (change 7).

## Recommendation

Proceed to proposal with: **one Vite + React + TS app**, route-split public/protected with RLS as the security boundary; **direct Supabase data access** (Edge Functions reserved for Phase 2 webhooks); **scaffold + connectivity smoke slice** as this change's scope; **Supabase Auth with role resolution behind a SQL function**; **Vercel + Supabase Cloud** hosting; and the **8-change roadmap** above as the delivery sequence.

## Risks

- **Lockfile inflates the diff** (~4–8k lines) — auto-forecast must exclude it from the 800-line reviewable count, or every scaffold PR falsely flags High.
- **RLS misconfiguration exposes financial data** — `data-model-core` must include an RLS checklist and negative tests (anon cannot read orders/transactions).
- **Mobile dnd is the hardest UI requirement** — validate dnd-kit PointerSensor on real phones early in `kanban-board`.
- **Bundle leakage** — without a lazy `/admin` boundary, admin deps bloat the public catalog chunk; enforce the boundary in this change's router shell.
- **wa.me message limits** — checkout message must stay compact; validate on real devices in `catalog-phase1`.
- **Supabase free-tier inactivity pause** — acceptable now; note the paid upgrade path before catalog launch.
- **"No nested-box AI aesthetics" is a review concern, not a component one** — palette tokens land in this change so every later change inherits the identity.

## Ready for Proposal

**Yes.** All 7 questions are answered with committed recommendations and a sized slice boundary. The orchestrator should tell the user: foundation = scaffold + connectivity smoke (no business modules yet), React chosen for the mobile kanban ecosystem, one app for both surfaces, and an 8-change roadmap delivering spreadsheet replacement first.

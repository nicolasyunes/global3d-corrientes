# Proposal: project-foundation — Scaffold & Connectivity Smoke Slice

## Intent

Greenfield repo (only `openspec/` + `.atl/`). Land the toolchain and skeleton the 8-change roadmap (obs #151) builds on: one Vite + React + TypeScript app, route-split public/protected, with verified Supabase connectivity. Affects the **shared** deliverable (shells catalog `/` + workshop `/admin`).

## Scope

### In Scope
- Vite + TypeScript + React scaffold (dev/build/typecheck)
- Router shell: public `/` + lazy `/admin` boundary — admin deps never enter public bundle; auth guard seam
- Design tokens: palette `#000000` `#FF6800` `#F0F0F0` `#FFFFFF` as CSS custom properties; mobile-first base; strictly clean UI (no nested-box aesthetics)
- Supabase client + fail-fast env validation (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)
- Tooling: vitest, flat eslint, prettier
- Connectivity smoke test: one typed query (smoke table or health RPC)

### Out of Scope
- All business modules (orders, kanban, agenda, finance, catalog) — roadmap changes 2–8
- DB schema, migrations, RLS, generated Supabase types — change `data-model-core`
- Auth UI — preparation documented only (see Approach)
- Deploy provisioning (Vercel/Supabase Cloud); Tailwind decision (design phase)

## Capabilities

### New Capabilities
- `app-shell`: Vite+React+TS entry, router with public `/` and lazy `/admin` boundary
- `design-tokens`: palette custom properties + mobile-first base styles (clean-UI identity)
- `supabase-connectivity`: typed client factory, env validation, smoke check
- `quality-tooling`: vitest, eslint, prettier, typecheck gating the repo

### Modified Capabilities
None — greenfield; `openspec/specs/` is empty.

## Approach

Per approved exploration: ONE app (RLS, not app count, is the security boundary); React for its touch-capable dnd ecosystem (future kanban); direct `supabase-js` + RLS, Edge Functions reserved for Phase 2. `/admin` behind `React.lazy` + `ProtectedRoute` seam. Auth prep (documented, not built): Supabase Auth for workshop users; `profiles` + `security definer current_user_role()` land in `data-model-core`; all RLS policies go through that function from day 1 — roles later change one function, not policies.

**Post-completion trigger**: vitest/tsc/eslint/prettier land here — `openspec/config.yaml` MUST then be updated: re-run testing detection, re-evaluate `strict_tdd` (placeholder `false`, obs #148).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html` | New | Vite + TS + React scaffold |
| `src/main.tsx`, `src/app/` | New | Entry + router shell (lazy `/admin`) |
| `src/lib/supabase.ts`, `src/styles/` | New | Typed client + env validation; tokens + base styles |
| `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `src/**/*.test.*` | New | Tooling + smoke test |
| `openspec/config.yaml` | Modified | Testing re-detection + `strict_tdd` re-evaluation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Lockfile (~4–8k lines) dominates diff | High | Forecast MUST exclude lockfile + generated types from the 800-line count (obs #152); ~450–600 reviewable estimated |
| Admin deps leak into public bundle | Med | Lazy `/admin` enforced here; chunk check in verify |
| Missing env vars at runtime | Med | Fail-fast validation at client init |

## Rollback Plan

Greenfield: delete scaffolded files, restore `openspec/config.yaml` testing block. No data, users, or migrations — risk-free.

## Dependencies

- Node 18+; Supabase project (cloud or local) with URL + anon key for the smoke test

## Success Criteria

- [ ] `dev` / `build` / `test` / `lint` / `typecheck` pass clean
- [ ] Smoke test proves typed Supabase connectivity
- [ ] Build shows separate lazy admin chunk; public bundle has no admin deps
- [ ] Palette tokens + mobile-first base styles in use
- [ ] `openspec/config.yaml` updated: testing re-detected, `strict_tdd` re-evaluated

# Tasks: project-foundation — Scaffold & Connectivity Smoke Slice

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Reviewable changed lines (excl. lockfile, generated types) | 500–700 (proposal: 450–600) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR, 6 units |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scaffold + test infra | PR 1 | base main; Vite/TS configs |
| 2 | Router shell, lazy `/admin` | PR 1 | after unit 1 |
| 3 | Design tokens + base styles | PR 1 | after unit 2 |
| 4 | Supabase client + env validation | PR 1 | after unit 3; tests included |
| 5 | ESLint + Prettier gates | PR 1 | after unit 4 |
| 6 | Smoke test + config.yaml update | PR 1 | after unit 5 |

## Phase 1: Scaffold

- [ ] 1.1 Create `package.json` (Vite+React+TS deps; scripts dev/build/preview/test/typecheck/lint/format/format:check); `npm install` (lockfile excluded)
- [ ] 1.2 Create `vite.config.ts` (react plugin, `@/` alias), `tsconfig.json`/`tsconfig.node.json` (strict, `paths`), `index.html`, `.gitignore`, `.env.example`, `README.md`
- [ ] 1.3 Create `vitest.config.ts` (jsdom) + `src/test/setup.ts`
- [ ] 1.4 Verify: `npm run build` + `npm run typecheck` exit zero

## Phase 2: Router Shell

- [ ] 2.1 Create `src/main.tsx` (mount RouterProvider, import base.css) + `src/app/App.tsx`
- [ ] 2.2 Create `src/app/router.tsx`: `/` public eager, `/admin/*` route-object `lazy()`, ProtectedRoute seam, catch-all → not-found
- [ ] 2.3 Create `src/features/catalog/CatalogPage.tsx` + `src/features/admin/AdminPage.tsx`
- [ ] 2.4 Verify: separate `admin-*.js` chunk; entry chunk free of admin modules; `/admin` on-demand

## Phase 3: Design Tokens

- [ ] 3.1 Create `src/styles/tokens.css`: `--color-black:#000000`, `--color-orange:#FF6800`, `--color-gray:#F0F0F0`, `--color-white:#FFFFFF`
- [ ] 3.2 Create `src/styles/base.css`: reset/box-sizing/typography from tokens, `min-width` queries only, imports tokens.css
- [ ] 3.3 Verify: hex literals only in tokens.css; all queries `min-width`; no horizontal scroll at 320px

## Phase 4: Supabase Client

- [ ] 4.1 Create `src/vite-env.d.ts` (ImportMetaEnv) + `src/lib/env.ts` fail-fast validation (throws naming missing/malformed var)
- [ ] 4.2 Create `src/lib/supabase.ts`: singleton `createClient` typed against placeholder `Database`
- [ ] 4.3 Write `src/lib/env.test.ts`: missing URL, missing key, malformed URL, valid pass
- [ ] 4.4 Verify: `npm test` passes; import without env throws naming var

## Phase 5: Quality Tooling

- [ ] 5.1 Create `eslint.config.js` (flat: typescript-eslint, react-hooks, react-refresh) + `.prettierrc` with eslint-config-prettier
- [ ] 5.2 Verify: `npm run lint` + `npm run format:check` exit zero; seeded lint violation exits non-zero

## Phase 6: Smoke + Config

- [ ] 6.1 Create `src/lib/supabase.smoke.test.ts`: `skipIf(!env)`, one typed query (RPC or table count), fails on bad creds/unreachable, tolerates empty result
- [ ] 6.2 Verify: valid env passes; invalid key surfaces auth error
- [ ] 6.3 Update `openspec/config.yaml`: testing re-detection (vitest/tsc/eslint/prettier), record re-evaluated `strict_tdd`
- [ ] 6.4 Final gate: dev/build/test/lint/typecheck/format clean; chunk check re-run

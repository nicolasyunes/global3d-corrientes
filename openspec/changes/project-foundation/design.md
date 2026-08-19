# Design: project-foundation — Scaffold & Connectivity Smoke Slice

## Technical Approach

Greenfield scaffold per the approved exploration (obs #151): ONE Vite + React 18 + TypeScript app, route-split into a public `/` catalog shell and a lazily-loaded `/admin` workshop shell, with a typed Supabase client, fail-fast env validation, design tokens as CSS custom properties, and vitest/eslint/prettier gating. One connectivity smoke test proves the toolchain end-to-end. RLS — not app count — is the security boundary (deferred to `data-model-core`); this change lands the seam, not the guard.

## Architecture Decisions

### Decision: Folder layout & module conventions

**Choice**: Feature-area layout under `src/` with `@/` path alias:

```
src/
├── main.tsx            # entry: mounts <App/>, imports base.css
├── app/
│   ├── router.tsx      # createBrowserRouter: public routes eager, /admin lazy
│   └── App.tsx
├── features/
│   ├── catalog/        # public shell (placeholder page only)
│   └── admin/          # workshop shell — ONLY imported via lazy boundary
├── lib/
│   ├── supabase.ts     # client singleton + env validation
│   └── env.ts          # VITE_* parsing, fail-fast
├── styles/
│   ├── tokens.css      # palette custom properties
│   └── base.css        # mobile-first reset + base, imports tokens.css
└── test/setup.ts       # vitest jsdom setup
```

**Alternatives considered**: flat `components/` dumping ground; TS token module as single source.
**Rationale**: feature-areas scale to the 8-change roadmap without restructure; `@/` alias (tsconfig `paths` + `vite-tsconfig-paths` or manual `resolve.alias`) prevents relative-path rot. CSS custom properties are the single token source — no component library, strictest enforcement of the 4-color identity and the "no nested-box" rule; a TS mirror (`styles/tokens.ts`) is deferred until a component needs it.

### Decision: Lazy `/admin` boundary mechanism

**Choice**: React Router v6 `createBrowserRouter` with a `lazy()` route object for `/admin/*` (route-level lazy, not `React.lazy` at component level). The admin route module is never statically imported by the public tree; the future `ProtectedRoute` wrapper lives inside the lazy module, so auth libs also stay out of the public chunk.

**Alternatives considered**: `React.lazy` + `<Suspense>` per page; single eager router.
**Rationale**: route-object `lazy()` splits at exactly one seam, defers the whole admin subtree (deps included), and Suspense fallback is internal to the route. Verification: `npm run build` output inspection — a separate `admin-*.js` chunk MUST exist and the entry/index chunk MUST NOT contain admin module paths. This is a scripted verify-step check, not just eyeballing.

### Decision: Supabase client & env validation

**Choice**: `lib/env.ts` reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, validates presence + URL shape, and throws at module init with a message naming the missing variable. `lib/supabase.ts` creates one `createClient` singleton typed against a placeholder `Database` interface (real generated types land in `data-model-core`). `src/vite-env.d.ts` + a `ImportMetaEnv` interface give compile-time env typing.

**Alternatives considered**: per-feature client factories; runtime validation on first query.
**Rationale**: fail-fast at bootstrap turns "missing env" into an immediate, legible crash instead of a deferred network error; singleton prevents multiple GoTrue instances (Supabase warning).

### Decision: Quality tooling

**Choice**: vitest in `jsdom` environment (React Testing Library for the smoke-adjacent component tests), `tsc --noEmit` as the typecheck gate, flat `eslint.config.js` (typescript-eslint + react-hooks + react-refresh), prettier with eslint-config-prettier (no rule conflicts). npm scripts contract:

| Script | Command |
|--------|---------|
| `dev` / `build` / `preview` | vite |
| `test` | `vitest run` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `format` / `format:check` | prettier |

**Rationale**: jsdom matches a DOM-heavy React app (node env would break component tests later); flat config is the current eslint standard; prettier owns formatting, eslint owns code quality — zero overlap.

### Decision: Connectivity smoke test

**Choice**: `src/lib/supabase.smoke.test.ts` — an opt-in integration test that runs ONLY when env vars are present (`describe.skipIf(!env)`), executes one typed query against a `smoke` health RPC (fallback: `select count` from a smoke table), and asserts a successful typed response. A unit test in `src/lib/env.test.ts` covers validation branches hermetically.

**Rationale**: proves connectivity in verify without making CI/dev dependent on a live Supabase project; absent env → skipped, not failed.

### Design note: auth preparation (NOT built here)

Future `data-model-core` will add `profiles` (`id` FK → `auth.users`, `role`) plus a `security definer` SQL function `current_user_role()` / `is_staff()`. ALL RLS policies route through that function from day 1 (initially: any authenticated user is staff), so enabling admin/operator enforcement later changes ONE function body — never policies, never frontend. This change only reserves the seam: `/admin` lazy module + the `ProtectedRoute` insertion point. No auth UI, no session logic, no service-role key in the frontend (ever).

## Data Flow

```
main.tsx ──→ <RouterProvider router>
                 │
        ┌────────┴─────────┐
        ▼                  ▼
   public tree (eager)   /admin route (lazy chunk)
        │                  │ dynamic import on first visit
        ▼                  ▼
   catalog shell      admin shell → [future: ProtectedRoute]
        │                  │
        └──── lib/supabase (env-validated singleton) ────→ Supabase (RLS, later changes)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json`, `package-lock.json` | Create | Deps + scripts contract (lockfile excluded from review forecast) |
| `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/vite-env.d.ts` | Create | Vite + strict TS scaffold, `@/` alias |
| `src/main.tsx`, `src/app/{App,router}.tsx` | Create | Entry + router with lazy `/admin` |
| `src/features/catalog/`, `src/features/admin/` | Create | Placeholder shells per surface |
| `src/lib/{env,supabase}.ts`, `src/lib/*.test.ts` | Create | Client singleton, fail-fast env, unit + smoke tests |
| `src/styles/{tokens,base}.css` | Create | Palette custom properties + mobile-first base |
| `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `src/test/setup.ts` | Create | Quality tooling |
| `.env.example`, `.gitignore`, `README.md` | Create | Env contract, ignores, quickstart |
| `openspec/config.yaml` | Modify | Post-apply: re-run testing detection, re-evaluate `strict_tdd` |

## Interfaces / Contracts

```ts
// lib/env.ts — throws Error naming missing var at import time
export const env: { readonly supabaseUrl: string; readonly supabaseAnonKey: string };

// lib/supabase.ts — placeholder Database until `supabase gen types` (data-model-core)
export const supabase: SupabaseClient<Database>;

// vite-env.d.ts
interface ImportMetaEnv { readonly VITE_SUPABASE_URL: string; readonly VITE_SUPABASE_ANON_KEY: string; }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | env validation branches; token/base CSS presence via smoke render | vitest + jsdom, hermetic |
| Integration | Typed Supabase connectivity | opt-in smoke test, `skipIf` when env absent |
| E2E | — | Out of scope (no runner until a business slice exists) |
| Build | Separate `admin-*.js` chunk; no admin paths in entry chunk | verify-phase inspection of `vite build` output |

## Migration / Rollout

No migration required. Greenfield: rollback = delete scaffolded files, restore `openspec/config.yaml` testing block. Post-completion trigger: update `openspec/config.yaml` (testing re-detection, `strict_tdd` re-evaluation per obs #148).

## Open Questions

- [ ] Smoke target: dedicated `smoke` health RPC vs. count on a smoke table — resolved at apply time against the actual Supabase project; test tolerates either.
- [ ] Tailwind: deferred per exploration; default is tokens-only CSS. Revisit only if a later change's components justify it.

## Non-Goals (explicit)

Business modules (orders/kanban/agenda/finance/catalog), DB schema & migrations, generated Supabase types, RLS policies, auth UI/session logic, deploy provisioning (Vercel/Supabase Cloud config), Tailwind adoption.

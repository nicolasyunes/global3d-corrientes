# Exploration: auth-access — real authentication for the internal orders app

**Answer up front.** The orders app is built (form/list/detail) but unusable: RLS grants workshop access `to authenticated`, and the only path today is an env-gated dev seed (`dev-session.ts`). `auth-access` wires in **Supabase magic link (passwordless email)** for the single owner/operator, adds the deferred `handle_new_user()` trigger (first signup bootstraps `admin`), replaces the dev seam with a real `AuthProvider` + `ProtectedRoute` inside the lazy `/admin` boundary, and ships a minimal sign-in + sign-out surface. Public `/` stays unauthenticated and never downloads the admin chunk. **Roles-hardening (column-level financial restriction, operator-management UI) is explicitly out of scope.**

## Current State

The persistence and RLS layers are live in cloud Supabase. `data-model-core` delivered the full schema and the role seam; `orders-core` delivered the orders UI against a seeded operator session.

- **Schema** (`supabase/migrations/20260819195906_enums_and_tables.sql`): `profiles` already exists — `id uuid PK references auth.users on delete cascade`, `role text not null default 'operator' check (role in ('admin','operator'))`. Role is a **text + CHECK**, not an enum (generated type is `string`).
- **RLS** (`20260819195909_rls.sql`): RLS enabled on all seven tables. `private.current_user_role()` + `public.is_admin()` (`security definer`, `search_path = ''`) already exist. Policies: `profiles` select `to authenticated`; `customers`/`orders`/`products`/`product_variants`/`inventory` `for all to authenticated`; `transactions` `for all to authenticated using (is_admin())`. Nothing here changes — this change only guarantees a **real** authenticated session and a profile row.
- **Deferred trigger**: `database-schema/spec.md` documents `on_auth_user_created()` / `handle_new_user()` as **deferred to this change** (default `role = 'operator'`). It is not yet implemented; `seed.sql` keeps profile fixtures commented out for the same reason.
- **Dev seam** (`src/features/admin/dev-session.ts`), two env-gated halves:
  - `seedOperatorSession()` — Node/service-role: creates a throwaway operator via `auth.admin.createUser`, manually `upsert`s a `profiles` row, signs in with the anon client. Used by `src/lib/operator-session.integration.test.ts` to prove operator CRUD + anon block.
  - `ensureDevOperatorSession()` — browser: no-op unless `VITE_ENABLE_DEV_SESSION === '1'`; invoked from `admin.route.tsx` on mount so dev can exercise RLS without a login UI.
- **Admin boundary** (`src/features/admin/admin.route.tsx`): flat `<Routes>` (orders list/new/:id, `*`→orders). Commented auth-guard seam already flagged here; `router.tsx` lazy-loads the whole admin subtree so auth libs stay out of the public bundle.
- **Client** (`src/lib/supabase.ts`): `createClient` with defaults → `persistSession: true`, so the session already survives reloads in localStorage; only the login path is missing.
- **Auth config** (`supabase/config.toml`): `auth.enabled`, `auth.email.enable_signup = true`, `enable_confirmations = false`, `site_url = http://127.0.0.1:3000`, `additional_redirect_urls = [https://127.0.0.1:3000]`, `local_smtp.enabled = true` (Inbucket for local magic-link emails). Stack: `@supabase/supabase-js ^2.47.10`, `react-router-dom ^6.28.1`.

## Affected Areas

- `supabase/migrations/2026XXXX_handle_new_user.sql` — **new**: `handle_new_user()` + `on_auth_user_created` trigger (the deferred item).
- `src/features/admin/admin.route.tsx` — wrap routes in `AuthProvider` + `ProtectedRoute`; add `/admin/login`; drop the `ensureDevOperatorSession()` call.
- `src/features/admin/dev-session.ts` — remove the browser seam (`ensureDevOperatorSession` + `VITE_ENABLE_DEV_SESSION`); keep or relocate the Node `seedOperatorSession()` test helper.
- `src/features/auth/*` — **new** feature area: `AuthProvider`, `ProtectedRoute`, `LoginPage`, sign-out control.
- `src/lib/operator-session.integration.test.ts` — stop relying on the manual profile upsert; let `handle_new_user` create the profile (verifies the trigger end-to-end).
- `src/lib/rls.integration.test.ts` — optional: the "operator/admin assertions require live sessions" deferral can now be closed.
- `supabase/config.toml` + cloud Auth redirect allow-list — add the production `emailRedirectTo` URL.
- `openspec/specs/database-schema/spec.md` — resolve the DEFERRED trigger block (archive-time delta).

## Decisions (the 7 questions)

### 1. Auth method → **Magic link (passwordless email)**

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Magic link (recommended)** | One tap on mobile; no password to remember/reset; no reset flow or strength UI to build; Supabase-native (`signInWithOtp`); zero provider setup | Depends on email deliverability; auto-signup means anyone reaching the owner's inbox can get in | **Choose** |
| Email + password | No email round-trip | Adds password + "forgot password" + reset flow for a single user; more code, more support | Reject |
| Google OAuth | Familiar button | Requires Google Cloud OAuth console + consent screen; ties login to a Google account (owner's business email may not be one); extra "choose account" step | Defer |

**Rationale.** The owner is the *only* user and is mobile-first (street/workshop). Typing a password one-handed is friction; tapping a link in an email is one tap. Magic link removes an entire class of UI (password, reset, strength) for a single-user internal tool, and `signInWithOtp({ email })` is one call with no provider credentials. Google OAuth is the wrong shape — it assumes a Google identity and demands external console configuration for zero added value at this stage; revisit only if the owner asks for it.

**Tradeoff to flag (not blocking):** magic link depends on email arriving. Local dev is covered by Inbucket (`local_smtp`); on cloud, the free-tier built-in email provider works for the owner's own address — upgrade to custom SMTP only if deliverability becomes a problem. `shouldCreateUser` stays default (`true`) so the first link auto-creates the account (feeds Q3).

### 2. Route protection → **`AuthProvider` + `ProtectedRoute` inside the lazy `/admin` boundary**

- **Placement**: auth code lives *inside* the lazy admin chunk, satisfying the app-shell constraint that auth libraries never enter the public entry chunk. `router.tsx` is unchanged.
- **Structure** (react-router v6 nested routes inside `admin.route.tsx`):
  ```
  <AuthProvider>
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="orders" element={<OrdersList />} />
        <Route path="orders/new" element={<OrderForm />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="*" element={<Navigate to="/admin/orders" replace />} />
      </Route>
    </Routes>
  </AuthProvider>
  ```
- **Session bootstrap**: on `AuthProvider` mount, `supabase.auth.getSession()` (async) restores any persisted session; subscribe `supabase.auth.onAuthStateChange` for `INITIAL_SESSION`/`SIGNED_IN`/`SIGNED_OUT`. Until resolved, `ProtectedRoute` renders a loading state; no session → `<Navigate to="/admin/login" replace />`; session → children.
- **Persistence**: the existing client already persists to localStorage (`persistSession: true`), so reloads and link-click returns restore automatically.
- **Public `/`**: stays unauthenticated; `React.lazy` already guarantees it never downloads the admin chunk.

**Nuance (flag for design):** login currently shares the admin chunk with the orders form/list. If bundle size ever matters, `/admin/login` can be split into its own lazy route — but for one user this is a non-goal; keep it simple.

### 3. `handle_new_user` trigger + first-admin bootstrap

**Trigger** (resolves the database-schema deferral):
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id,
    case when (select count(*) from public.profiles) = 0
         then 'admin' else 'operator' end)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Default role + first-admin bootstrap:**

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **First signup = admin (recommended)** | Zero manual steps; owner signs in and gets full access immediately; deterministic | First email to arrive owns the tenant; a non-owner tester first = wrong admin (1-line SQL fixes it) | **Choose** |
| Always `operator`, manual promotion | Explicit; no accidental admin | Owner must run a service-role script or dashboard SQL before transactions are visible; breaks the "sign in on phone, done" goal | Reject |

The deferred spec scenario says `role = 'operator'` as the *default*, but a single-owner tool that can never see `transactions` (admin-only) until a manual SQL edit defeats the whole point. The COUNT check makes the first signup `admin`, everyone after `operator`, with a 1-line `update public.profiles set role='admin' where id=...` as the escape hatch. The race (two concurrent first signups) is a non-issue for a one-person business.

### 4. Login UI → **mobile-first, "check your email" state**

Single screen at `/admin/login`, matching `DESIGN.md` Operate mode (clean/no-boxes):
1. Wordmark "Global3D" + one email input (native, `inputmode="email"`).
2. Primary button "Send sign-in link" (orange fill, carbon text per contrast rule; ≥44px).
3. On submit → transition to a **"Check your email"** state ("We sent a sign-in link to …") with a resend link and a "use a different email" back action. This state is mandatory: magic link is asynchronous — the user leaves the app, taps the link in their inbox, and returns.
4. After tapping the link, the app reopens with the session; `onAuthStateChange` fires `SIGNED_IN` and `ProtectedRoute` renders the orders list.

`emailRedirectTo` must point at `/admin/orders` (or `/admin`, which forwards) so the post-link landing is inside the protected area, and that URL must be in the Auth redirect allow-list (`site_url` + `additional_redirect_urls` locally; the Vercel production URL on cloud).

**Flow note:** recommend the default implicit flow (token in URL hash, `detectSessionInUrl` handles it automatically) for v1 simplicity. PKCE is the harder-but-more-current default — it requires an email-template `{{ .TokenHash }}` change; defer PKCE to a later security pass (roles-hardening) unless the team prefers it now. Either way `onAuthStateChange` is the single source of truth.

### 5. Dev-seam retirement

- **Remove the browser seam**: delete `ensureDevOperatorSession()` and the `VITE_ENABLE_DEV_SESSION` gate; delete its call in `admin.route.tsx`. Real auth replaces it. This seam shipped no credential and is absent from production bundles already, but it must go so dev exercises the real login path.
- **Keep the Node seam (test-only)**: `seedOperatorSession()` stays useful for `operator-session.integration.test.ts` (RLS `to authenticated` proof) — **but** it should stop manually upserting `profiles`; after `handle_new_user` lands, `auth.admin.createUser` will fire the trigger and create the profile itself. Letting the test rely on the trigger turns it into a real end-to-end verification of Q3. Relocate it out of `src/features/admin/` (it is a test fixture, not a feature) — e.g. `src/test/seed-operator.ts` or keep in `src/lib/` — so the admin feature area only contains product code.

### 6. Sign-out

A sign-out affordance in the admin shell. There is no shared admin layout today (routes are flat), so add a minimal `AdminLayout` inside the lazy boundary that renders a consistent wordmark header + a sign-out control (≥44px, text/icon, no card) and wraps the orders routes via `<Outlet/>`. Sign-out calls `supabase.auth.signOut()`; `onAuthStateChange` fires `SIGNED_OUT`; `ProtectedRoute` redirects to `/admin/login`.

### 7. Scope boundary

| In auth-access | Deferred (separate changes) |
|---|---|
| Magic-link sign-in + login UI + "check your email" state | Column-level financial restriction on `orders`/`transactions` → `roles-hardening` |
| `handle_new_user` trigger + first-signup=admin | Operator-management UI (invite/remove/role switch) |
| `AuthProvider` + `ProtectedRoute` + sign-out | Google OAuth, MFA, PKCE flow, email-template branding |
| Dev-seam retirement | RLS policy changes (policies stay exactly as-is) |

**Non-goals reaffirmed:** no roles-hardening, no operator/team UI, no RLS edits. `transactions` remains admin-only via the *existing* `is_admin()` policy — this change merely ensures the owner actually lands with an `admin` profile so those rows are visible to them.

## Recommendation

Ship `auth-access` as: (1) `handle_new_user` trigger with first-signup=admin; (2) an `src/features/auth/*` area (`AuthProvider`, `ProtectedRoute`, `LoginPage`) mounted inside the lazy `/admin` boundary; (3) a minimal `AdminLayout` with sign-out; (4) removal of the browser dev seam and relocation of the Node test helper; (5) a config/allow-list addition for the production redirect URL. Magic link via the default implicit flow, `onAuthStateChange` as the single session source of truth.

## Risks

- **Email deliverability** — magic link is unusable if the owner's link doesn't arrive; local dev is Inbucket-covered, but cloud may need a custom SMTP if the free provider under-delivers. Mitigate early in apply/verify.
- **Wrong first admin** — if a non-owner email signs up first, they become `admin`; 1-line SQL corrects it, but it's a footgun worth a note in docs.
- **Redirect allow-list drift** — `emailRedirectTo` must be added to Auth redirect URLs on cloud (Vercel prod URL) or the link 302s back with an error; easy to miss until prod.
- **Bundle subtlety** — login shares the admin chunk with the orders form; acceptable for one user, split later only if size matters.
- **Test seam coupling** — `seedOperatorSession` currently assumes manual profile creation; if it isn't updated to rely on the trigger, the integration test will silently test the old path.
- **Review budget (800 lines)** — moderate slice (~350–500 reviewable lines: migration ~30, auth area ~250, dev-seam removal, tests); **Low** risk. Generated types + lockfile excluded per config.

## Ready for Proposal

**Yes** — all 7 questions answered with committed recommendations. The orchestrator should tell the user:
1. Auth method locked: magic link (passwordless email), default implicit flow; PKCE + Google OAuth deferred.
2. First signup becomes `admin` automatically; later signups are `operator`. Confirm the owner will be the first to sign in.
3. Scope confirmed: auth only — no roles-hardening, no operator-management UI, no RLS changes.

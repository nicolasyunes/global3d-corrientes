# Design: auth-access — Real authentication for the internal orders app

## Technical Approach

Magic-link (passwordless) sign-in via supabase-js `signInWithOtp`, mounted inside the lazy `/admin` boundary so auth code never enters the public chunk. `AuthProvider` is the single session source of truth (`getSession()` + `onAuthStateChange`); `ProtectedRoute` gates the orders subtree, `/admin/login` is the open sign-in surface. The deferred `handle_new_user` trigger creates a `profiles` row per signup (first signup = `admin`). The browser dev-seam is removed; the Node test helper relocates and relies on the trigger. Public `/` and all RLS policies are untouched.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Auth method | Magic link (`signInWithOtp`, implicit flow) | email+password; Google OAuth | Single owner, mobile-first, one tap; no password/reset UI; Supabase-native. PKCE deferred |
| Session source of truth | `getSession()` + `onAuthStateChange` in `AuthProvider` | polling `getSession()` | Reactive, single source; `persistSession: true` (existing client) already survives reloads |
| Guard placement | `AuthProvider` + `ProtectedRoute` inside lazy `admin.route.tsx` | top-level `router.tsx` guard | Keeps auth libs out of the public bundle; `router.tsx` unchanged |
| First-admin bootstrap | trigger `role = case when count(*)=0 then 'admin' else 'operator' end` | always-operator + manual SQL promotion | Owner signs in → full access immediately; 1-line `update profiles set role='admin'` escape hatch for a wrong first admin |
| Shell placement | `AdminLayout` in `src/features/admin/`; wordmark moves out of `OrdersList` | `AdminLayout` in `src/features/auth/` | Shell chrome is an admin concern; `auth/*` stays pure primitives; single wordmark source |
| Redirect target | `emailRedirectTo = ${origin}${from ?? '/admin/orders'}` | hardcoded env URL | Honors deep links; no new env; prod URL added to cloud Auth allow-list manually |
| Dev-seam | delete browser seam; relocate `seedOperatorSession` to `src/test/seed-operator.ts`, drop manual profile upsert | keep seam; keep manual upsert | Real auth replaces seam; trigger verified end-to-end |

## Data Flow (magic link)

```
LoginPage ── signInWithOtp({ email, emailRedirectTo }) ──▶ Supabase Auth ── email w/ link
                                                              │
Owner taps link (browser) ────────────────────────────────────┘
  │ full load /admin/orders#access_token=…
  ▼
admin.route.tsx (lazy) → AuthProvider mounts → supabase client created
  │ createClient: detectSessionInUrl parses hash → session set
  │ getSession() → session · onAuthStateChange(SIGNED_IN)
  ▼
ProtectedRoute: loading? spinner : session? <AdminLayout><Outlet/></AdminLayout> : <Navigate /admin/login>
```

Sign-out: `AdminLayout → signOut()` → `SIGNED_OUT` → `session=null` → `ProtectedRoute` redirects `/admin/login`.

## Supabase Schema / RLS Decision

`handle_new_user()` is `security definer set search_path=''`, matching `is_admin()`/`current_user_role()`. It inserts into `public.profiles` as postgres — required because `profiles` has no INSERT policy (RLS enabled) and no session exists at signup. RLS policies are UNCHANGED: operator CRUD via `to authenticated`; `transactions` admin-only via existing `is_admin()`. Migration is additive (function + trigger on `auth.users`), safe against live data.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260820120000_handle_new_user.sql` | Create | `handle_new_user()` + `on_auth_user_created` trigger (first-signup=admin, `on conflict do nothing`) |
| `src/features/auth/AuthProvider.tsx` | Create | Context: `session`/`user`/`loading`/`signOut`; `getSession()` + `onAuthStateChange` |
| `src/features/auth/useAuth.ts` | Create | `useAuth()` hook (throws outside provider) |
| `src/features/auth/ProtectedRoute.tsx` | Create | Loading state; redirects `/admin/login` with `state.from` |
| `src/features/auth/LoginPage.tsx` | Create | Email input → "check your email" (resend + change email); redirects if already signed in |
| `src/features/auth/auth.css` | Create | Login + shell styles (tokens only, ≥44px, no cards) |
| `src/features/admin/AdminLayout.tsx` | Create | Wordmark header + sign-out, `<Outlet/>` |
| `src/features/admin/admin.route.tsx` | Modify | Mount `AuthProvider` + nested routes; drop `ensureDevOperatorSession()` call |
| `src/features/admin/dev-session.ts` | Delete | Browser seam removed (helper relocated) |
| `src/test/seed-operator.ts` | Create | Relocated `seedOperatorSession` (no manual `profiles` upsert) |
| `src/features/orders/OrdersList.tsx` | Modify | Drop wordmark header (now owned by `AdminLayout`) |
| `src/lib/operator-session.integration.test.ts` | Modify | Import from new path; assert profile created by trigger |
| `.env.example` | Modify | Remove `VITE_ENABLE_DEV_SESSION` |

## Interfaces / Contracts

```ts
// useAuth.ts
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}
export function useAuth(): AuthContextValue

// LoginPage submit
supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${location.origin}${from ?? '/admin/orders'}` },
})
```

Nested routes (`admin.route.tsx`): `login` (open) → `ProtectedRoute` → `AdminLayout` (`orders`, `orders/new`, `orders/:id`, `*`→`/admin/orders`).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `ProtectedRoute` (no session→login, session→children, unresolved→loading); `LoginPage` check-email state + already-signed-in redirect | vitest + RTL, mock `useAuth`/supabase |
| Integration | Trigger creates profile end-to-end; operator CRUD + anon block | `operator-session.integration.test.ts` asserts a `profiles` row exists for the seeded user (role ∈ admin/operator), relies on the trigger |
| E2E | — | out of scope (config) |

## Migration / Rollout

Manual cloud step during verify: add the Vercel production URL to Auth → URL Configuration → Redirect URLs (config.toml already covers local via `site_url`). Rollback: `drop trigger on_auth_user_created on auth.users; drop function handle_new_user();` restore `admin.route.tsx`/`dev-session.ts`; delete `src/features/auth/*` + `src/test/seed-operator.ts`; remove prod redirect URL.

## Open Questions

- None blocking. Confirm the owner signs in first (first signup = admin). PKCE, Google OAuth, roles-hardening deferred.

# Proposal: auth-access — Real authentication for the internal orders app

## Intent

The orders app (form/list/detail) is built but unusable: RLS grants workshop access `to authenticated`, and the only session path today is an env-gated dev seed (`dev-session.ts`). This change wires Supabase **magic-link (passwordless email)** sign-in for the single owner/operator, implements the deferred `handle_new_user()` trigger (first signup bootstraps `admin`), replaces the dev seam with a real `AuthProvider` + `ProtectedRoute` inside the lazy `/admin` boundary, and ships a minimal sign-in + sign-out surface. Public `/` stays unauthenticated. **Deliverable: workshop app** (internal management).

## Scope

### In Scope
- Magic-link sign-in (`signInWithOtp`) + "check your email" state; default implicit flow.
- `handle_new_user()` trigger: profile row on signup, default `operator`, first signup `admin`.
- `AuthProvider` + `ProtectedRoute` inside lazy `/admin`; session persistence via `onAuthStateChange`.
- Minimal mobile-first `LoginPage` (no-boxes, orange primary, carbon text) + `AdminLayout` with sign-out.
- Retire browser dev-seam; relocate Node `seedOperatorSession()` (test-only) out of `features/admin`.

### Out of Scope
- Roles-hardening (column-level financial restriction); operator-management UI; RLS policy changes; Google OAuth / MFA / PKCE.

## Capabilities

### New Capabilities
- `auth-flow`: magic-link sign-in + check-email state.
- `route-protection`: `AuthProvider` + `ProtectedRoute` + session persistence + redirect.
- `admin-shell`: `AdminLayout` (wordmark header + sign-out control).

### Modified Capabilities
- `database-schema`: implement the deferred `handle_new_user` trigger (replace the DEFERRED block).

> `app-shell`, `row-level-security`, and `design-tokens` are unchanged at spec level: the route split, RLS policies, and palette stay exactly as-is.

## Approach

Mount `AuthProvider` inside `admin.route.tsx`; nested routes `/admin/login` (open) + protected orders routes under `ProtectedRoute`. Bootstrap via `getSession()` + `onAuthStateChange`; render loading until resolved, redirect to `/admin/login` with no session. New `src/features/auth/*`. Migration `supabase/migrations/2026XXXX_handle_new_user.sql`; add prod `emailRedirectTo` URL to Auth redirect allow-list.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/auth/*` | New | AuthProvider, ProtectedRoute, LoginPage, sign-out |
| `src/features/admin/admin.route.tsx` | Modified | wrap routes + `/admin/login`; drop dev-seam call |
| `src/features/admin/dev-session.ts` | Modified | remove browser seam; relocate Node helper |
| `supabase/migrations/2026XXXX_handle_new_user.sql` | New | trigger + function |
| `src/lib/operator-session.integration.test.ts` | Modified | rely on trigger, not manual profile upsert |
| `supabase/config.toml` + cloud Auth | Modified | prod redirect URL allow-list |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Email deliverability (magic link) | Med | Inbucket local; custom SMTP if free provider under-delivers |
| Wrong first admin | Low | 1-line SQL `update profiles set role='admin'` escape hatch |
| Redirect allow-list drift | Med | add prod URL during apply/verify |
| Test seam coupling | Med | update seed helper to rely on trigger |

## Rollback Plan

- Drop the `handle_new_user` migration (function + trigger).
- Restore `admin.route.tsx` + `dev-session.ts` from prior commit; delete `src/features/auth/*`.
- Remove prod redirect URL from allow-list. Feature branch; clean revert point at the last archive commit.

## Dependencies

- Supabase cloud project (live schema); `orders-core` archive (routes + dev-seam); `database-schema` deferred trigger.

## Success Criteria

- [ ] Owner taps a magic link on mobile and lands on `/admin/orders` signed in.
- [ ] First signup creates an `admin` profile; later signups `operator`.
- [ ] No session → `/admin/login`; sign-out returns to login.
- [ ] Public `/` never downloads the admin chunk (unchanged).
- [ ] Browser dev-seam removed; integration test proves trigger end-to-end.
- [ ] `npm test`, `npm run build`, and `tsc` pass.

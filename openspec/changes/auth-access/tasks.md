# Tasks: auth-access — Real authentication for the internal orders app

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 (excl. generated types + lockfile) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 trigger+seed-seam → PR2 auth primitives → PR3 login+shell+dev-seam retirement |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
800-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `handle_new_user` trigger + relocate Node seed helper | PR1 | base `feature/auth-access`; trigger proven by integration test |
| 2 | `AuthProvider` + `useAuth` + `ProtectedRoute` (primitives) | PR2 | base PR1; unit tests; not yet wired |
| 3 | `LoginPage` + `AdminLayout` + wiring + dev-seam removal | PR3 | base PR2; `.env.example` drop; wordmark moves to shell |

## Phase 1: Foundation — trigger + test-seam (PR 1)

- [ ] 1.1 Create `supabase/migrations/20260820120000_handle_new_user.sql` — `handle_new_user()` (`security definer set search_path=''`) inserting `profiles` (`role`: first signup `admin`, else `operator`; `on conflict do nothing`) + `on_auth_user_created` trigger on `auth.users`.
- [ ] 1.2 Apply via `npm run db:reset`. No type regen (function+trigger only; no table/column change).
- [ ] 1.3 Create `src/test/seed-operator.ts` — relocate `seedOperatorSession` + helpers from `dev-session.ts`, DROP the manual `profiles` upsert (trigger creates it).
- [ ] 1.4 Slim `src/features/admin/dev-session.ts` to `ensureDevOperatorSession` + `DEV_SESSION_ENABLED` only.
- [ ] 1.5 Update `src/lib/operator-session.integration.test.ts` — import from `src/test/seed-operator`; assert `profiles` row exists with `role ∈ {admin, operator}`.

## Phase 2: Auth context + route protection (PR 2)

- [ ] 2.1 Create `src/features/auth/AuthProvider.tsx` — context (`session`/`user`/`loading`/`signOut`); `getSession()` + `onAuthStateChange`.
- [ ] 2.2 Create `src/features/auth/useAuth.ts` — `useAuth()` hook (throws outside provider).
- [ ] 2.3 Create `src/features/auth/ProtectedRoute.tsx` — loading state; redirect `/admin/login` with `state.from`.
- [ ] 2.4 Unit test `src/features/auth/ProtectedRoute.test.tsx`: no-session→login, session→children, unresolved→loading.

## Phase 3: Login UI (PR 3)

- [ ] 3.1 Create `src/features/auth/LoginPage.tsx` — email → `signInWithOtp({ email, emailRedirectTo })` → "check your email" (resend + change email); redirect if already signed in.
- [ ] 3.2 Unit test `src/features/auth/LoginPage.test.tsx`: check-email transition, resend, change-email, already-signed-in redirect.

## Phase 4: Admin shell + dev-seam retirement (PR 3)

- [ ] 4.1 Create `src/features/admin/AdminLayout.tsx` — wordmark header + sign-out (`signOut()`), `<Outlet/>`.
- [ ] 4.2 Create `src/features/auth/auth.css` — login + shell styles (tokens only, ≥44px, no cards).
- [ ] 4.3 `src/features/orders/OrdersList.tsx` — remove wordmark header (now owned by `AdminLayout`).
- [ ] 4.4 `src/features/admin/admin.route.tsx` — mount `AuthProvider`; add `login` route; wrap orders in `ProtectedRoute`→`AdminLayout`; drop `ensureDevOperatorSession()` call.
- [ ] 4.5 Delete `src/features/admin/dev-session.ts`; remove `VITE_ENABLE_DEV_SESSION` from `.env.example`.
- [ ] 4.6 Unit test `src/features/admin/AdminLayout.test.tsx`: header + sign-out render; sign-out clears session.

## Phase 5: Verify

- [ ] 5.1 `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` pass.
- [ ] 5.2 NOTE (manual, not code): add Vercel prod URL to Supabase Auth → URL Configuration → Redirect URLs.

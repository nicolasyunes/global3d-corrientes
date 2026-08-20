# route-protection

Client-side session management and route guarding for the internal admin area: an `AuthProvider` context, a `ProtectedRoute` guard, session persistence via `onAuthStateChange`, and redirect to login. The public `/` route stays unauthenticated and auth code never enters the public chunk.

## Requirements

### Requirement: AuthProvider Session Context

The system MUST provide an `AuthProvider` that resolves the session on mount from `supabase.auth.getSession()` and stays in sync via `onAuthStateChange` (`INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`). The provider MUST expose the current session and a loading state, and MUST be mounted inside the lazy `/admin` boundary.

#### Scenario: Session restored on reload

- GIVEN a previously authenticated user with a persisted session
- WHEN the app reloads
- THEN the session is restored from the persisted store
- AND protected routes render without re-authentication

### Requirement: ProtectedRoute Guard

The system MUST gate protected admin routes behind a guard that renders children only when a session exists. While the session is unresolved, the guard MUST render a loading state; once resolved with no session, it MUST redirect to `/admin/login`.

#### Scenario: Unauthenticated access redirects to login

- GIVEN no active session
- WHEN the user navigates to a protected route such as `/admin/orders`
- THEN they are redirected to `/admin/login`

#### Scenario: Authenticated access is allowed

- GIVEN a valid session
- WHEN the user navigates to a protected route
- THEN the route renders

#### Scenario: Unresolved session shows loading

- GIVEN the session has not resolved yet on mount
- WHEN a protected route renders
- THEN a loading state is shown
- AND no premature redirect to login occurs

### Requirement: Sign-Out

The system MUST clear the session on sign-out via `supabase.auth.signOut()`.

#### Scenario: Sign-out clears the session

- GIVEN a valid session
- WHEN the user signs out
- THEN the session is cleared
- AND the user is redirected to `/admin/login`

### Requirement: Public Route Stays Unauthenticated

The public `/` route MUST remain unauthenticated. Authentication libraries and admin-only code MUST NOT appear in the public entry chunk.

#### Scenario: Public route requires no session

- GIVEN the app is running
- WHEN the user navigates to `/`
- THEN the public route renders without authentication
- AND no admin/auth module is downloaded

# auth-flow

Passwordless magic-link sign-in for the single owner/operator of the internal orders app, using Supabase `signInWithOtp` with the default implicit flow, plus the asynchronous "check your email" state.

## Requirements

### Requirement: Magic-Link Sign-In

The system MUST authenticate the owner/operator using Supabase passwordless email (`signInWithOtp`) with the default implicit flow. It MUST NOT require a password, password-reset, or OAuth-provider flow. A submitted valid email MUST trigger a sign-in link; the post-link landing MUST return the user to the protected admin area (`/admin/orders`).

#### Scenario: Valid email sends a sign-in link

- GIVEN the login screen is shown with no active session
- WHEN the user submits a valid email address
- THEN `signInWithOtp` is invoked for that email
- AND the UI transitions to the "check your email" state

#### Scenario: Already signed in skips sign-in

- GIVEN a valid session already exists
- WHEN the user navigates to `/admin/login`
- THEN they are redirected to the protected admin area
- AND no sign-in link is sent

### Requirement: Check-Your-Email State

The system MUST present a "check your email" state after a sign-in link is requested. The state MUST display the submitted email, MUST offer a resend action, and MUST offer a "use a different email" action that returns to the email input.

#### Scenario: Resend sign-in link

- GIVEN the "check your email" state is shown
- WHEN the user taps the resend action
- THEN a sign-in link is requested again for the same email

#### Scenario: Change email

- GIVEN the "check your email" state is shown
- WHEN the user taps "use a different email"
- THEN the UI returns to the email input
- AND the previously entered email can be replaced

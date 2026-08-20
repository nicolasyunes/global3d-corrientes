# Delta for database-schema

## MODIFIED Requirements

### Requirement: Triggers

The system MUST provide a `set_updated_at()` trigger that refreshes `updated_at` on update for every table carrying the column. The system MUST provide an `on_auth_user_created` trigger backed by a `handle_new_user()` function that inserts a `profiles` row for each new `auth.users` row. The trigger MUST assign `role = 'operator'` by default, and MUST assign `role = 'admin'` to the first signup when the `profiles` table is empty; it MUST NOT overwrite an existing profile row (`on conflict do nothing`).

(Previously: only `set_updated_at()` was delivered; `on_auth_user_created()` / `handle_new_user()` was documented as DEFERRED to the auth change and not implemented.)

#### Scenario: Updated timestamp auto-refreshes

- GIVEN a row exists
- WHEN the row is updated
- THEN `updated_at` reflects the update time

#### Scenario: New auth user gets a profile

- GIVEN at least one `profiles` row already exists
- WHEN a new auth user is created
- THEN a `profiles` row is created referencing the user with `role = 'operator'`

#### Scenario: First signup bootstraps admin

- GIVEN the `profiles` table is empty
- WHEN a new auth user is created
- THEN a `profiles` row is created referencing the user with `role = 'admin'`

#### Scenario: Existing profile is not overwritten

- GIVEN a `profiles` row already exists for an auth user
- WHEN the trigger fires for that same user
- THEN the existing profile row is preserved

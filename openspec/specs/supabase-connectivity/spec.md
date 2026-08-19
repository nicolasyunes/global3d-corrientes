# supabase-connectivity

Typed Supabase client factory with fail-fast environment validation and a connectivity smoke check.

## Requirements

### Requirement: Typed Supabase Client

The system MUST provide a single, reusable Supabase client factory used by all application code. The client SHALL be created from the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables. Application code MUST NOT instantiate Supabase clients ad hoc.

#### Scenario: Client factory returns a configured client

- GIVEN valid environment variables
- WHEN the client factory is invoked
- THEN it returns a Supabase client bound to the configured URL and anon key

#### Scenario: Single client instance is shared

- GIVEN the application is running
- WHEN multiple modules request the client
- THEN they receive the same client instance or factory output

### Requirement: Fail-Fast Environment Validation

The system MUST validate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at client initialization. If either variable is missing, empty, or malformed, initialization MUST throw a descriptive error naming the offending variable before any network call is made.

#### Scenario: Missing URL fails fast

- GIVEN `VITE_SUPABASE_URL` is unset
- WHEN the client factory is invoked
- THEN an error is thrown naming `VITE_SUPABASE_URL`
- AND no Supabase request is attempted

#### Scenario: Missing anon key fails fast

- GIVEN `VITE_SUPABASE_URL` is valid and `VITE_SUPABASE_ANON_KEY` is unset
- WHEN the client factory is invoked
- THEN an error is thrown naming `VITE_SUPABASE_ANON_KEY`

#### Scenario: Valid environment passes validation

- GIVEN both variables are set to well-formed values
- WHEN the client factory is invoked
- THEN validation passes and client creation proceeds

### Requirement: Connectivity Smoke Test

The system MUST include an automated smoke test that proves end-to-end connectivity: a single typed query against the Supabase project (a smoke table read or a health-check RPC). The test MUST fail if the project is unreachable or credentials are invalid, and SHOULD tolerate an empty result set as a successful connection.

#### Scenario: Smoke test proves connectivity

- GIVEN valid environment variables and a reachable Supabase project
- WHEN the smoke test runs
- THEN the query completes without an error response

#### Scenario: Smoke test fails on invalid credentials

- GIVEN an invalid anon key
- WHEN the smoke test runs
- THEN the test fails with the Supabase authentication error surfaced

#### Scenario: Smoke test fails when unreachable

- GIVEN an unreachable Supabase URL
- WHEN the smoke test runs
- THEN the test fails with a network error surfaced

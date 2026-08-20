# generated-types

TypeScript database types generated from the live Supabase schema, wired into the typed client, with a drift guard.

## Requirements

### Requirement: Generated Types at a Known Path

The system MUST generate TypeScript database types from the local Supabase schema via `supabase gen types --local` into `src/lib/database.types.ts`. The file MUST be checked in and reflect the current migration set.

#### Scenario: Types file exists at the known path

- GIVEN the local Supabase project is running
- WHEN the `gen:types` script runs
- THEN `src/lib/database.types.ts` is regenerated at the known path

### Requirement: Typed Client Wiring

The system MUST use the generated types as the `Database` generic for the Supabase client, replacing the placeholder `Database` interface in `src/lib/supabase.ts`.

#### Scenario: Client uses generated types

- GIVEN `src/lib/database.types.ts` exists
- WHEN `supabase.ts` is inspected
- THEN the client is created with the generated `Database` type, not an empty placeholder

### Requirement: Drift Detection

The system MUST provide a way to detect when `database.types.ts` is stale relative to migrations. Re-running `supabase gen types --local` against the current schema MUST produce no diff; any diff SHALL fail the verify phase.

#### Scenario: Types are in sync

- GIVEN migrations are applied and `database.types.ts` is committed
- WHEN `supabase gen types --local` runs again
- THEN the regenerated output produces no diff against the committed file

#### Scenario: Drift is flagged

- GIVEN a new migration is applied but types were not regenerated
- WHEN the drift check runs
- THEN the check fails, indicating the types are stale

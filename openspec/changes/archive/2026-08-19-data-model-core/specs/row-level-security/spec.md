# row-level-security

Role-based access boundary over the core schema: RLS enabled on every table, a single security-definer role function, and a matrix where `anon` sees nothing, operators manage workshop rows, and only admins touch `transactions`.

## Requirements

### Requirement: RLS Enabled on All Tables

The system MUST enable row-level security on `profiles`, `customers`, `orders`, `products`, `product_variants`, `inventory`, and `transactions`.

#### Scenario: Every core table has RLS enabled

- GIVEN the migrations are applied
- WHEN RLS status is inspected per table
- THEN RLS is enabled on all seven tables

### Requirement: Security-Definer Role Functions

The system MUST provide `private.current_user_role()` and `public.is_admin()` as `security definer` functions that read `public.profiles.role` for the current auth user. Both MUST set `search_path` to an empty value to prevent search-path injection and MUST NOT recurse into RLS checks. Policies needing a role MUST route through these functions rather than re-reading `profiles` directly.

#### Scenario: is_admin resolves from profiles

- GIVEN an authenticated user whose profile role is `admin`
- WHEN `is_admin()` is evaluated
- THEN it returns true

#### Scenario: Role function is hardened

- GIVEN the functions exist
- WHEN a function definition is inspected
- THEN the body sets `search_path = ''`
- AND the function is `security definer`

### Requirement: Anonymous Access Denied

The system MUST deny `anon` all read and write access to every core table.

#### Scenario: Anon cannot read orders (negative)

- GIVEN an `anon` session and existing `orders` rows
- WHEN the session queries `orders`
- THEN zero rows are returned, including the financial columns `total_amount`, `deposit`, and `pending_balance`

#### Scenario: Anon cannot read transactions (negative)

- GIVEN an `anon` session and existing `transactions` rows
- WHEN the session queries `transactions`
- THEN zero rows are returned

### Requirement: Operator Access Matrix

The system MUST allow authenticated operators (role `operator`) to read and write `customers`, `orders`, `products`, and `inventory`, and to read `profiles`. Operators MUST NOT read or write `transactions`. Operators SHALL read `orders` financial columns in this change; column-level restriction is deferred.

#### Scenario: Operator reads and writes orders

- GIVEN an authenticated operator
- WHEN they query and update `orders`
- THEN the operations succeed
- AND financial columns are readable

#### Scenario: Operator cannot read transactions (negative)

- GIVEN an authenticated operator and existing `transactions` rows
- WHEN they query `transactions`
- THEN zero rows are returned

### Requirement: Admin-Only Transactions

The system MUST restrict both read and write on `transactions` to the admin role via `is_admin()`.

#### Scenario: Admin reads and writes transactions

- GIVEN an authenticated admin
- WHEN they query and insert `transactions`
- THEN the operations succeed

#### Scenario: Non-admin cannot write transactions (negative)

- GIVEN an authenticated operator
- WHEN they attempt to insert a `transactions` row
- THEN the write is rejected

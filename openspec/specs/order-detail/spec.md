# order-detail

Order detail: view and edit, status progression through the enum, and pending-balance source-of-truth semantics.

## Requirements

### Requirement: View and Edit

The system MUST show an order's full detail and allow editing through the same fields as order entry. Status SHALL be hidden on create but editable on detail.

#### Scenario: Detail shows all fields

- GIVEN an existing order
- WHEN its detail view renders
- THEN all fields are displayed, including pending balance

#### Scenario: Edit persists

- GIVEN the detail view in edit mode
- WHEN the operator changes a field and saves
- THEN the change persists on the order

### Requirement: Status Progression

The system MUST support status progression through `new → in_queue → printing → post_processing → finished`, plus `cancelled`, advancing to the next enum step.

#### Scenario: Status advances to the next step

- GIVEN an order with `status = new`
- WHEN the operator advances status
- THEN status becomes `in_queue`, and each subsequent advance follows the enum order up to `finished`

#### Scenario: Order is cancelled

- GIVEN an order
- WHEN the operator cancels it
- THEN status becomes `cancelled`, and it no longer appears in the landing list

### Requirement: Pending Balance Semantics

The system MUST treat the stored `pending_balance` as the source of truth and MUST NOT recompute it or surface it as "wrong" when it diverges from `total_amount − deposit`.

#### Scenario: Stored value is the source of truth

- GIVEN an order whose stored `pending_balance` differs from `total_amount − deposit`
- WHEN the detail view renders
- THEN the stored `pending_balance` is displayed as-is, with no "wrong" or "incorrect" indication

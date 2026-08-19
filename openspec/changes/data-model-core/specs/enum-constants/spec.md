# enum-constants

Type-safe TypeScript constants mirroring the Postgres enums and open-list values, with label/color mappings for UI rendering.

## Requirements

### Requirement: Order Status Constants

The system MUST define a TypeScript constant `ORDER_STATUS` whose values exactly mirror the `order_status` enum (`new`, `in_queue`, `printing`, `post_processing`, `finished`, `cancelled`). Every enum value MUST be covered, and values MUST be typed from the generated database types rather than bare strings.

#### Scenario: Constants cover every status

- GIVEN `src/lib/domain-constants.ts`
- WHEN the `ORDER_STATUS` constant is inspected
- THEN it contains an entry for every `order_status` enum value

### Requirement: Transaction Type Constants

The system MUST define `TRANSACTION_TYPE` mirroring `3d_service` and `supplies_sale`, each with a label.

#### Scenario: Both transaction types are mapped

- GIVEN `src/lib/domain-constants.ts`
- WHEN `TRANSACTION_TYPE` is inspected
- THEN both `3d_service` and `supplies_sale` have label entries

### Requirement: Open-List Constants

The system MUST define constants for `payment_method` (`cash`, `transfer`, `uala`, `brubank`, `mercadopago`, `other`) and `product_type` (`cup`, `trophy`, `keychain`, `other`) matching the CHECK constraints, for use in forms and filters.

#### Scenario: Payment methods match the CHECK list

- GIVEN `src/lib/domain-constants.ts`
- WHEN the payment method constant is inspected
- THEN its values equal the CHECK constraint list

### Requirement: Label and Color Mappings

The system MUST provide label (and, where applicable, color) mappings for `order_status` values to support kanban and agenda traffic-light rendering.

#### Scenario: Status resolves to label and color

- GIVEN `src/lib/domain-constants.ts`
- WHEN a status such as `printing` is looked up
- THEN it resolves to a human-readable label and a color token

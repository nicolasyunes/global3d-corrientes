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

The system MUST define TypeScript constants for `payment_method` (`cash`, `transfer`, `uala`, `brubank`, `mercadopago`, `other`), `product_type` (`cup`, `trophy`, `keychain`, `other`), and `origin_channel` (`facebook`, `whatsapp`, `instagram`, `other`) matching the CHECK constraints, for use in forms and filters. Values MUST be typed from the generated database types rather than bare strings.

#### Scenario: Payment methods match the CHECK list

- GIVEN `src/lib/domain-constants.ts`
- WHEN the payment method constant is inspected
- THEN its values equal the CHECK constraint list

#### Scenario: Product types match the CHECK list

- GIVEN `src/lib/domain-constants.ts`
- WHEN the product type constant is inspected
- THEN its values equal the CHECK constraint list

#### Scenario: Origin channels match the CHECK list

- GIVEN `src/lib/domain-constants.ts`
- WHEN the origin channel constant is inspected
- THEN its values equal `facebook`, `whatsapp`, `instagram`, `other`

### Requirement: Label and Color Mappings

The system MUST provide label mappings for `order_status` values, and color mappings for status/urgency semantics: red for overdue/urgent, amber for upcoming, green for comfortable, and teal for success/finished. Color mappings MUST reference design tokens, not raw hex values, and SHALL support the future urgency semaphore.

#### Scenario: Status resolves to label and color

- GIVEN `src/lib/domain-constants.ts`
- WHEN a status such as `printing` is looked up
- THEN it resolves to a human-readable label and a color token

#### Scenario: Urgency/status bucket resolves to a semaphore color

- GIVEN `src/lib/domain-constants.ts`
- WHEN an overdue/urgent, upcoming, comfortable, or finished bucket is looked up
- THEN it resolves to red, amber, green, or teal respectively

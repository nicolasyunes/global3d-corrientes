# Delta for enum-constants

## MODIFIED Requirements

### Requirement: Open-List Constants

The system MUST define TypeScript constants for `payment_method` (`cash`, `transfer`, `uala`, `brubank`, `mercadopago`, `other`), `product_type` (`cup`, `trophy`, `keychain`, `other`), and `origin_channel` (`facebook`, `whatsapp`, `instagram`, `other`) matching the CHECK constraints, for use in forms and filters. Values MUST be typed from the generated database types rather than bare strings.

(Previously: `payment_method` and `product_type` constants were DEFERRED to `orders-core`; `origin_channel` did not exist.)

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

(Previously: only `order_status` label and color mappings; no urgency semaphore colors.)

#### Scenario: Status resolves to label and color

- GIVEN `src/lib/domain-constants.ts`
- WHEN a status such as `printing` is looked up
- THEN it resolves to a human-readable label and a color token

#### Scenario: Urgency/status bucket resolves to a semaphore color

- GIVEN `src/lib/domain-constants.ts`
- WHEN an overdue/urgent, upcoming, comfortable, or finished bucket is looked up
- THEN it resolves to red, amber, green, or teal respectively

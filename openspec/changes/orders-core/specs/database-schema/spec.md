# Delta for database-schema

## MODIFIED Requirements

### Requirement: CHECK Constraints for Open Lists

The system MUST constrain `payment_method`, `product_type`, and `origin_channel` as `text` columns with CHECK constraints. `payment_method` MUST allow at least `cash`, `transfer`, `uala`, `brubank`, `mercadopago`, `other`; `product_type` MUST allow at least `cup`, `trophy`, `keychain`, `other`; `origin_channel` MUST be nullable and MUST allow `facebook`, `whatsapp`, `instagram`, `other`. New values SHALL be extensible via a migration without altering an enum type.

(Previously: constrained only `payment_method` and `product_type`; `origin_channel` did not exist.)

#### Scenario: Known value is accepted

- GIVEN the migrations are applied
- WHEN an `orders` row is inserted with `payment_method = 'mercadopago'`
- THEN the insert succeeds

#### Scenario: Unknown value is rejected

- GIVEN the migrations are applied
- WHEN an `orders` row is inserted with a value outside the CHECK list
- THEN the insert is rejected by the CHECK constraint

#### Scenario: Origin channel is captured

- GIVEN the migrations are applied
- WHEN an `orders` row is inserted with `origin_channel = 'whatsapp'`
- THEN the insert succeeds
- AND a value outside the CHECK list (e.g. `email`) is rejected
- AND `origin_channel` may be null

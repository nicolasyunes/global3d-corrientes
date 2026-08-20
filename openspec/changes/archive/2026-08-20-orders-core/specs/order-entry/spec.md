# order-entry

Single mobile-first order form (create + edit) with a "quick order" collapsed mode. Fast capture from a social inquiry: customer + product type + due date + optional amount in seconds; optional detail fields refined later.

## Requirements

### Requirement: Quick Order Capture

The system MUST provide a single mobile-first form for creating and editing orders, with a "quick order" collapsed mode that captures the minimum fields — customer, product type, due date, and optional amount — in minimal taps. The system MUST apply smart defaults on create: `status = new`, `order_date = now()`, `color_spec = {}`, and `due_date` defaulting to a business lead time.

#### Scenario: Quick order in minimal taps

- GIVEN an operator on a mobile device with a social inquiry
- WHEN they open quick order and enter customer, product type, due date, and amount
- THEN the order is created with `status = new` and all other fields at defaults or null

#### Scenario: Smart defaults are applied

- GIVEN a new order form is opened
- WHEN no explicit values are entered for status, order date, or due date
- THEN status defaults to `new`, order date to now, and due date to a business lead time

### Requirement: Required Field Validation

The system MUST require customer, product type, and due date on every order. Submission SHALL be blocked until these fields are provided.

#### Scenario: Missing required fields block submission

- GIVEN the order form
- WHEN the operator submits without customer, product type, or due date
- THEN the form shows validation errors and no order is created

#### Scenario: Complete required fields submit

- GIVEN customer, product type, and due date are provided
- WHEN the operator submits
- THEN the order is created

### Requirement: Optional Detail Fields

The system MUST capture optional detail fields — phone/whatsapp, per-part color spec, personalization, measurements, observations, total amount, deposit, payment method, and origin channel — without blocking fast capture. Every optional field MAY be left empty.

#### Scenario: Optional details are omitted during fast capture

- GIVEN quick order mode
- WHEN the operator enters only the required fields
- THEN the order is created with optional fields null and origin/payment/product captured as null

#### Scenario: Optional details are refined later

- GIVEN an order created via quick order
- WHEN the operator edits the form and fills optional detail, payment, or origin fields
- THEN the values persist on the order

### Requirement: Pending Balance Recorded

The system MUST record `pending_balance` as a stored value, defaulting to `total_amount − deposit` and editable. The system SHALL NOT recompute `pending_balance` on read.

#### Scenario: Pending balance is recorded

- GIVEN total amount and deposit are entered
- WHEN the order is saved
- THEN `pending_balance` is stored (defaulting to `total_amount − deposit`) and is not recomputed on read

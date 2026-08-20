# orders-list

Minimal due-date list as the `/admin` landing view: Today / Upcoming tabs, sorted by `due_date` ascending, excluding cancelled orders.

## Requirements

### Requirement: Landing Due-Date List

The system MUST render an orders list at `/admin` as the landing view, with Today and Upcoming tabs, ordered by `due_date` ascending, and excluding orders with `status = cancelled`.

#### Scenario: Empty state

- GIVEN no orders match the active tab
- WHEN the list renders
- THEN an empty state message is shown

#### Scenario: Correct sort

- GIVEN orders with different due dates
- WHEN the list renders
- THEN orders appear in `due_date` ascending order

#### Scenario: Cancelled orders are hidden

- GIVEN orders including one with `status = cancelled`
- WHEN the list renders
- THEN the cancelled order is not shown

### Requirement: Status Badge

The system MUST render a status badge per row using the order status label and color mapping.

#### Scenario: Status badge renders with mapped color

- GIVEN an order with a status
- WHEN its row renders
- THEN a badge shows the status label with the mapped color token

### Requirement: Tap to Open Detail

The system MUST navigate to the order detail view when a row is tapped.

#### Scenario: Tap opens detail

- GIVEN a row in the list
- WHEN the operator taps the row
- THEN the order detail view opens for that order

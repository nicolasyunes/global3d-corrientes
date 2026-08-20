# admin-shell Specification

## Purpose

Minimal shared administrative layout inside the lazy `/admin` boundary: a wordmark header and a sign-out control, matching the mobile-first clean/no-boxes UI.

## Requirements

### Requirement: AdminLayout Shell

The system MUST provide an `AdminLayout` inside the lazy `/admin` boundary that renders a wordmark header and a sign-out control. The layout MUST wrap the protected orders routes via a nested outlet.

#### Scenario: Admin layout renders header and sign-out

- GIVEN a valid session and a protected admin route
- WHEN the route renders
- THEN the wordmark header is shown
- AND a sign-out control is shown

#### Scenario: Sign-out control clears the session

- GIVEN the `AdminLayout` is rendered
- WHEN the sign-out control is activated
- THEN sign-out is triggered
- AND the session is cleared

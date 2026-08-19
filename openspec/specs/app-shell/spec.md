# app-shell

Router shell for the single Vite + React + TypeScript app: public `/`, lazy `/admin` boundary, mobile-first base layout.

## Requirements

### Requirement: Application Entry and Build Shell

The system MUST provide a single-page application entry (HTML host + React root mount) that builds with Vite and passes TypeScript typechecking. The dev, build, and typecheck commands SHALL complete without errors.

#### Scenario: Production build succeeds

- GIVEN a fresh checkout with dependencies installed
- WHEN the build command runs
- THEN a production bundle is emitted without errors
- AND typechecking passes with no diagnostics

#### Scenario: Dev server serves the app

- GIVEN a fresh checkout with dependencies installed
- WHEN the dev command runs
- THEN the root document loads and mounts the React root without console errors

### Requirement: Public and Admin Route Split

The system MUST route `/` to a public area and `/admin/*` to an admin area loaded via a lazily imported module boundary (e.g., `React.lazy`). Admin-only dependencies MUST NOT appear in the public entry chunk. The admin boundary SHALL expose an auth-guard seam where a future `ProtectedRoute` can intercept navigation, without implementing authentication in this change.

#### Scenario: Public route renders the public placeholder

- GIVEN the application is running
- WHEN a user navigates to `/`
- THEN a public catalog placeholder view is rendered
- AND no admin module is requested by the browser

#### Scenario: Admin route loads lazily

- GIVEN the application is running
- WHEN a user navigates to `/admin`
- THEN the admin chunk is fetched on demand
- AND an admin placeholder view is rendered

#### Scenario: Public bundle excludes admin code

- GIVEN a production build
- WHEN bundle output is inspected
- THEN a separate chunk exists for the admin route
- AND the public entry chunk contains no admin-route modules

#### Scenario: Unknown routes resolve to the public shell

- GIVEN the application is running
- WHEN a user navigates to an undefined path
- THEN the router renders a not-found or redirect outcome within the public shell
- AND the admin chunk is not fetched

### Requirement: Mobile-First Base Layout

The system MUST provide a base layout that renders correctly at mobile viewport widths (320px and up) without horizontal scrolling, and SHOULD scale up to tablet and desktop widths. Layout styles MUST build on the design tokens defined by the `design-tokens` capability.

#### Scenario: Layout is usable on a phone viewport

- GIVEN a viewport of 320–480px width
- WHEN any route is rendered
- THEN no horizontal scrollbar appears
- AND primary content is readable without zooming

#### Scenario: Layout scales to desktop

- GIVEN a viewport of 1280px width or more
- WHEN any route is rendered
- THEN content is constrained and centered rather than stretched edge-to-edge

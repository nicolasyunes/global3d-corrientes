# Delta for design-tokens

Official Global3D visual identity as code: 4-color palette as CSS custom properties, mobile-first base styles, clean-UI constraint. Greenfield — all requirements are ADDED.

## ADDED Requirements

### Requirement: Official Palette as CSS Custom Properties

The system MUST define the official palette as CSS custom properties in a single shared tokens stylesheet: black `#000000` (structure, main text), Global3D orange `#FF6800` (actions, key accents), light gray `#F0F0F0` (backgrounds), and white `#FFFFFF` (cards, containers). All component and layout styles MUST consume these tokens instead of hard-coded color literals.

#### Scenario: Tokens are defined and available globally

- GIVEN the application is built
- WHEN the tokens stylesheet is loaded
- THEN custom properties for black, orange, light gray, and white exist with the exact hex values above

#### Scenario: No raw color literals outside the tokens file

- GIVEN the source tree
- WHEN stylesheets and component styles are inspected
- THEN hex color values appear only in the tokens stylesheet
- AND all other styles reference the custom properties

### Requirement: Mobile-First Base Styles

The system MUST provide global base styles (reset/normalize, box-sizing, typography defaults, background and text colors from tokens) that apply at the smallest supported viewport first, with wider-viewport rules added via min-width media queries only.

#### Scenario: Base styles render with the official palette

- GIVEN the application is running
- WHEN any route renders
- THEN the page background and default text color resolve to token values
- AND no unstyled flash or browser-default margins break the layout

#### Scenario: Mobile-first cascade

- GIVEN the base stylesheet
- WHEN media queries are inspected
- THEN all width-based media queries use `min-width`
- AND no `max-width` media query overrides base rules for small screens

### Requirement: Clean-UI Constraint

The system MUST NOT produce nested-box visual aesthetics (boxes inside boxes, excessive borders/shadows/cards). Surfaces SHOULD be separated by spacing and background contrast using the palette tokens, not stacked bordered containers. This requirement SHALL be enforced at design review for every UI change.

#### Scenario: Review checklist enforces clean UI

- GIVEN a UI change under review
- WHEN the change introduces a new visual surface
- THEN the reviewer verifies it uses spacing and token backgrounds for separation
- AND rejects nested bordered containers or decorative overload

# Delta for design-tokens

## MODIFIED Requirements

### Requirement: Official Palette as CSS Custom Properties

The system MUST define the official palette as CSS custom properties in a single shared tokens stylesheet: Global3D orange `#F37021` (actions, key accents), carbon `#1D1D1B` (structure, main text), white `#FFFFFF` (backgrounds, cards, containers), and teal accent `#0E7C66` (success/in-progress status; the added accent token). The light-gray `#F0F0F0` token SHALL be removed; backgrounds SHALL use white/neutral tones. All component and layout styles MUST consume these tokens instead of hard-coded color literals.

(Previously: palette was orange `#FF6800`, black `#000000`, light gray `#F0F0F0`, white `#FFFFFF`; no teal accent token.)

#### Scenario: Tokens are defined and available globally

- GIVEN the application is built
- WHEN the tokens stylesheet is loaded
- THEN custom properties for orange `#F37021`, carbon `#1D1D1B`, white `#FFFFFF`, and teal `#0E7C66` exist with the exact hex values above
- AND the light-gray token no longer exists

#### Scenario: No raw color literals outside the tokens file

- GIVEN the source tree
- WHEN stylesheets and component styles are inspected
- THEN hex color values appear only in the tokens stylesheet
- AND all other styles reference the custom properties

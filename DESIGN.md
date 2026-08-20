# DESIGN.md — Global3D Visual World

The committed visual world for the internal workshop app. Mode: **Operate** — the operator is mid-task; scanability, consistency, and native expectations outrank expression. Light surface, warm energy, zero decoration that costs a tap.

## Direction

- **Thesis**: a capture-first workshop tool. The list is a queue, the form is a single fast screen, and nothing needs a second screen to understand.
- **World**: warm orange on near-black carbon over white — the brand's "vibrant warm tech" energy — restrained to actions and state, never decoration.
- **First viewport (list)**: "Global3D" wordmark top-left, Today / Upcoming tabs, a flat due-date queue; the primary action is a sticky "Quick order" button within thumb reach.
- **Form**: one column, sectioned by spacing and token backgrounds; a sticky bottom save.

## Palette

Light surface (operator works outdoors in bright ambient light — white grounds maximize contrast).

| Token            | Hex       | Role                                               |
| ---------------- | --------- | -------------------------------------------------- |
| `--color-orange` | `#F37021` | Primary actions, focus rings, in-progress states   |
| `--color-carbon` | `#1D1D1B` | Structure, headings, body text, primary buttons    |
| `--color-white`  | `#FFFFFF` | Backgrounds and surfaces                           |
| `--color-teal`   | `#0E7C66` | Success / finished status; the one semantic accent |

**Color strategy**: Restrained (neutral ground + one accent) with a single _semantic_ second accent (teal) reserved for "finished/success". Orange is earned, not scattered.

Derived + functional tokens (also defined in `tokens.css` — no raw hex anywhere else):

| Token                  | Value                 | Role                              |
| ---------------------- | --------------------- | --------------------------------- |
| `--color-carbon-soft`  | `rgba(29,29,27,0.06)` | Hairline separators, subtle fills |
| `--color-carbon-muted` | `rgba(29,29,27,0.60)` | Secondary text on white           |
| `--status-red`         | `#C63D3D`             | Overdue / urgent                  |
| `--status-amber`       | `#C77D12`             | Upcoming / attention / new        |
| `--status-green`       | `#2E7D4F`             | Comfortable / on-track            |

Status/urgency colors are **warm and desaturated** so they sit beside orange/carbon rather than reading as default CSS red/green. `amber`/`green`/`teal` carry the future urgency semaphore (agenda-view); only `teal` (finished) maps to an order status today.

**Contrast rule (binding)**: orange `#F37021` + white text is ~2.9:1 and fails AA — so primary action buttons use **carbon text on orange** (~6.3:1). Secondary text on a colored surface is tinted from that surface's hue, never gray.

## Anti-references

These patterns are banned — no brief earns them back here:

- ❌ Purple-blue gradients.
- ❌ Nested cards / boxes inside boxes.
- ❌ Generic "Inter-everything" as an unthinking default.
- ❌ Rounded icon tiles sitting above headings (kickers/eyebrows).
- ❌ Gray text on colored backgrounds.
- ❌ Decorative borders, hard offset shadows, gradient text, emoji-as-icons.
- ❌ Modals for tasks that fit inline.

## Typography

One family: the **system UI stack** (`system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) — a deliberate workhorse choice for a fast internal tool: zero font download, native feel, maximum legibility in sunlight. Not a self-hosted display face.

- **Fixed rem scale**, tight ratio (~1.2): `0.875rem` labels · `1rem` body · `1.125rem` h3 · `1.25rem` h2 · `1.5rem` h1.
- Headings and body share the family; hierarchy comes from weight (600–700) and size, not a second face.
- Money, dates, and counts use `font-variant-numeric: tabular-nums` for alignment in list rows.

## Components

Every interactive component ships all states: default, hover, focus (orange ring), active, disabled, loading, error.

- **Primary button**: orange fill, carbon text, ≥44px, full-width in the mobile form. Carbon fill with white text is the secondary action.
- **Status badge**: small pill — semantic token at ~12% fill with the full token as text (solid fill for the current state). No colored side borders.
- **List row**: full-width tap target, hairline separator (`--color-carbon-soft`), customer · product · due date · badge · pending balance. No card frame.
- **Tabs** (Today / Upcoming): text + an orange underline indicator; the selected tab is unambiguous without chrome.
- **Form controls**: native inputs with `inputmode="decimal"`/`"tel"`, native date picker; product type / payment / origin are segmented chips (4–6 values). Large labels above fields, more space above a section than below it.
- **Empty states** teach: "No orders due today — tap Quick order to add one."

## Layout

- **Mobile-first, single column.** 320px and up with zero horizontal scroll.
- Sticky bottom primary action on the form; sticky top wordmark + tabs on the list.
- **Desktop** (≥1280px): content constrained and centered (max ~72rem); the list may widen to a table-like two-line row, the form may add a wider measure — but structure stays one logical column. Wider viewports only ever _add_ rules via `min-width` media queries.

## Logo

Text wordmark **"Global3D"** — system stack, weight 700, tight letter-spacing, carbon, with "3D" in orange. Placeholder until the owner supplies the final logo (shape/icon still undescribed).

## Motion

150–250ms, state-driven only: tab underline, badge change, save feedback, list item reveal. No page-load choreography.

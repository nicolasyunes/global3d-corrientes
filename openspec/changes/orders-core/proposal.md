# Proposal: orders-core — Order Entry + Capture

## Intent

Replace the operator's spreadsheet with fast, mobile-first order capture. Orders are the product's crown jewel: the operator creates an order in seconds from a social inquiry (WhatsApp/Facebook/Instagram) on their phone, then refines details later. This change ships the entry surface (create/edit/detail) plus a minimal "today/upcoming" due-date list as the `/admin` landing view. **Deliverable: workshop app** (internal management).

## Scope

### In Scope
- Single mobile-first order form (create + edit) with a "quick order" collapsed mode (customer + product type + due date + optional amount).
- Minimal orders list (Today / Upcoming tabs, `due_date ASC`, `status != cancelled`) as the `/admin` landing view.
- Order detail view with status progression (next enum step).
- Additive `origin_channel` migration (facebook/whatsapp/instagram/other) + `payment_method`/`product_type`/`origin_channel` TS constants.
- Palette reconciliation: `design-tokens` + `src/styles/tokens.css` → official brand (orange `#F37021`, carbon `#1D1D1B`, white `#FFFFFF`, teal `#0E7C66`).

### Out of Scope
- Urgency agenda (traffic-light sections) → `agenda-view`; kanban board → `kanban-board`.
- Finance registry / transactions / arqueos → `finance-registry`.
- Social API integration (manual transcription only); auth login UI (separate follow-up); PWA/offline.

## Capabilities

### New
- `order-entry`: form + quick-order mode, smart defaults, validation, origin/payment/product capture.
- `orders-list`: minimal due-date list (Today/Upcoming, sorted, status-filtered).
- `order-detail`: view/edit + status progression + pending-balance semantics.

### Modified
- `design-tokens`: official palette (orange/carbon/white + teal 5th token).
- `database-schema`: additive `orders.origin_channel` text nullable CHECK.
- `enum-constants`: land deferred `PAYMENT_METHOD`/`PRODUCT_TYPE` + add `ORIGIN_CHANNEL` + status color mappings.

> **`origin_channel` decision**: the schema migration is a **MODIFIED `database-schema` delta**, not a new `order-schema` capability and not folded into `order-entry`. `orders` and its CHECK lists already live in `database-schema`; a separate capability would fragment the schema source of truth, and `order-entry` is a UI/form capability. It is the ONLY schema change.

## Approach

- Exploration's recommended approach: single fast form with a mode toggle (quick-order is a collapsed subset — one code path).
- **Auth strategy**: RLS testing uses a seeded dev operator session; NO login UI. The real auth flow (magic link/email + `handle_new_user` trigger + profile seeding) is a separate follow-up.
- **UI craft**: `impeccable` skill drives sdd-design (init + shape, mode `Operate`) and sdd-apply craft-floor; the clean-UI no-boxes mobile-first brief WINS over any saturated-pattern default (pinned in `PRODUCT.md` at init).
- Additive migration is safe against live data (no column relaxation).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/orders/*` | New | list, form, detail, data-access helpers |
| `src/features/admin/*` | Modified | replace placeholder `<AdminPage />` with `/admin/orders` routes |
| `src/lib/domain-constants.ts` | Modified | PAYMENT_METHOD / PRODUCT_TYPE / ORIGIN_CHANNEL + colors |
| `src/lib/database.types.ts` | Modified | regenerated (excluded from review count) |
| `src/styles/tokens.css` | Modified | official palette values |
| `supabase/migrations/*` | New | additive `origin_channel` migration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 800-line review budget exceeded (largest UI change yet) | High | tasks-phase forecasts + chains PRs (migration+constants / form / list+detail) |
| No auth flow — RLS needs a session | High | seeded dev operator session; recorded as apply/verify strategy |
| `pending_balance` drift (stored ≠ total−deposit, by design) | Med | treat as source-of-truth; never surface as "wrong" |
| `impeccable` craft creep vs clean-UI spec | Med | pin brief in `PRODUCT.md` at init |
| Street connectivity (no offline) | Med | defer PWA/offline; re-raise if a real pain point |

## Rollback Plan

- Revert the additive `origin_channel` migration (drop column; no data risk).
- Revert `tokens.css` + `design-tokens` delta (restore old hex values).
- Restore `<AdminPage />` placeholder; delete `src/features/orders/*`.
- Feature branch; archive commit `b91f519` is the clean revert point.

## Dependencies

- Supabase cloud project `bukjmleercxlxbexekos` (live schema).
- `data-model-core` archive commit (schema + RLS + types + constants).

## Success Criteria

- [ ] Operator creates a quick order (name + product type + due date + amount) in < 30s on mobile.
- [ ] Full form + edit + detail work; status progresses to the next enum step.
- [ ] Landing list shows Today/Upcoming sorted by `due_date`, hides cancelled.
- [ ] `origin_channel` captured; constants compile against generated types.
- [ ] Palette renders the official brand; no raw hex outside `tokens.css`.
- [ ] `npm test`, `npm run build`, and `tsc` pass.

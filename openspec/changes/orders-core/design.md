# Design: orders-core — Order Entry + Capture

## Technical Approach

A single mobile-first order form (create + edit) with a "quick order" collapsed mode — one code path, a toggle reveals optional sections. Three routes mount under the lazy `/admin` boundary: `/admin/orders` (list), `/admin/orders/new` (form), `/admin/orders/:id` (detail). Data flows through the existing typed `supabase` client; RLS is the security boundary. No login UI — a seeded dev operator session satisfies RLS in dev/verify. One additive migration adds `orders.origin_channel`; three open-list TS constants land in `domain-constants.ts`; `tokens.css` reconciles to the official palette. Visual world is pinned in `DESIGN.md` (Operate mode, clean/no-boxes).

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Form structure | Single form + quick-order mode toggle | Separate quick/full forms; multi-step wizard | One code path, fewer states; quick-order is a collapsed subset; matches speed goal |
| Auth | Seeded dev operator session; no login UI | Pull auth slice forward | Magic-link + `handle_new_user` is a separate follow-up; RLS only needs an authenticated session |
| `origin_channel` | Additive nullable `text` + CHECK | New enum; new capability spec | Open-list mirrors `payment_method`; schema source-of-truth stays in `database-schema` |
| `pending_balance` | Stored, editable, source-of-truth | Derived CHECK `total − deposit` | Deposits arrive in installments; `finance-registry` owns reconciliation |
| Open-list TS types | Literal unions + `as const` arrays | Derive from generated types | `text`+CHECK columns expose `string`, not a union — no enum type to derive |
| Route nesting | Internal `<Routes>` inside lazy `admin.route.tsx` | Top-level router entries | Keeps admin code in the lazy chunk; `router.tsx` unchanged |

## Data Flow

```
OrdersList ── orders.select('*, customers(name)').eq('status != cancelled').order('due_date') ──▶ Supabase (RLS: authenticated)
     │ tap row
     ▼
OrderDetail ── load by id ── update / status advance ──▶ orders row
OrderForm ── upsert customer (match by phone, else create by name) ──▶ customers
           ── insert/update order ──▶ orders
```

Create (quick order):
```
Operator (mobile) → QuickOrder → validate(customer, product_type, due_date)
  → customers.upsert(name, phone?) → customer_id
  → orders.insert({ customer_id, product_type, due_date, origin_channel?, total_amount?, ... })
      defaults: status='new', order_date=now(), color_spec={}, pending_balance=total−deposit
  → redirect /admin/orders/:id
```

Status progression (detail):
```
Detail → tap "Advance" → next enum step (new→in_queue→printing→post_processing→finished)
       → orders.update({ status: next }).eq('id')
       → "Cancel" sets status='cancelled' (hidden from list)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/2026XXXX_orders_origin_channel.sql` | Create | Additive `origin_channel text` + CHECK |
| `src/lib/domain-constants.ts` | Modify | `PAYMENT_METHOD`/`PRODUCT_TYPE`/`ORIGIN_CHANNEL` + status/semaphore color maps |
| `src/lib/database.types.ts` | Modify | Regenerated (`npm run gen:types`; excluded from review) |
| `src/styles/tokens.css` | Modify | Official palette + semantic/status tokens |
| `src/features/admin/admin.route.tsx` | Modify | Mount orders routes; drop `AdminPage` |
| `src/features/admin/AdminPage.tsx` | Delete | Replaced by `OrdersList` |
| `src/features/admin/dev-session.ts` | Create | Dev-only seeded operator sign-in seam |
| `src/features/orders/OrdersList.tsx` | Create | Today/Upcoming tabs, `due_date ASC` |
| `src/features/orders/OrderForm.tsx` | Create | Single form + quick-order mode |
| `src/features/orders/OrderDetail.tsx` | Create | View/edit + status progression |
| `src/features/orders/orders.api.ts` | Create | Typed read/write helpers |
| `src/features/orders/validation.ts` | Create | Required-field + numeric validation |

## Interfaces / Contracts

```ts
// Open-list constants (text + CHECK → literal unions; not generated enums)
export const PAYMENT_METHOD = ['cash','transfer','uala','brubank','mercadopago','other'] as const
export const PRODUCT_TYPE  = ['cup','trophy','keychain','other'] as const
export const ORIGIN_CHANNEL = ['facebook','whatsapp','instagram','other'] as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[number]

export const ORDER_STATUS_COLORS: Record<OrderStatus, string>  // token refs, not hex
//   new→amber · in_queue/printing/post_processing→orange · finished→teal · cancelled→carbon
export const URGENCY_COLORS  // overdue→red · upcoming→amber · comfortable→green · finished→teal
```

Status/urgency color maps reference design tokens (see `DESIGN.md`); `teal` maps to `finished`, `red`/`amber`/`green` exist now to feed the future urgency semaphore.

## Mobile-First UI

- Single column; ≥44px touch targets; sticky bottom save/advance on form, sticky top tabs on list.
- Native controls + `inputmode` (decimal/tel); segmented chips for product/payment/origin.
- Desktop (≥1280px) only *adds* width via `min-width` queries; no `max-width` overrides.
- Full visual contract in `DESIGN.md`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | validation, smart defaults, status progression, constant coverage | vitest + jsdom, no DB |
| Integration | RLS: anon blocked; operator CRUD orders; `origin_channel` CHECK | env-gated cloud test (existing pattern); seeded operator via service-role `auth.admin.createUser` + `signInWithPassword` |
| E2E | — | out of scope (config) |

## Migration / Rollout

Additive migration — nullable, no relaxation, safe against live data. Regenerate types after applying. Rollback: drop column; restore old tokens; restore `AdminPage`; delete `src/features/orders/*`.

## Open Questions

- None blocking. Teal adopted as 5th token; auth = seeded operator session; logo = text wordmark (final asset pending owner).

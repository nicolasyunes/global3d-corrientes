# Proposal: order-images-and-link — Reference Images + External Product Link on Orders

## Intent

Orders often arrive with visual context the current text-only fields can't hold: a
reference photo the customer sends, an AI-generated mockup of what they want, a logo
that still needs to be recreated as vector art, or a link to an existing product on a
site like MakerWorld. Today the operator has nowhere to put any of this except a free-text
`observations` field. This change adds a per-order image gallery (with an optional note
per image and a full-size viewer) and a single external reference link field, so the shop
floor can see exactly what's being made without hunting through a chat thread.
**Deliverable: workshop app** (internal management).

## Scope

### In Scope

- `orders.reference_link`: a single optional URL column (e.g. a MakerWorld product page)
  shown as a clickable link on the order detail view.
- `order_images`: a new child table — one or more images per order, each with an optional
  free-text note ("foto que mandó el cliente", "logo a vectorizar"). No image-type
  categorization; a flat gallery covers reference photos, generated mockups, and logos
  alike.
- `order-images` storage bucket (public, mirroring the existing `product-images` pattern),
  holding the uploaded files.
- `OrderImages` UI: upload control, thumbnail grid, delete-per-image, and a full-size
  image viewer (lightbox) with prev/next navigation and the image's note — mounted on the
  order detail page, since it needs an existing `order_id`.
- Client-side upload guardrails: `image/*` only, 8MB size cap, with an inline error
  message on rejection (no server-side format/size enforcement in this pass).

### Out of Scope

- Per-item images (an order may hold several `order_items`; images stay at the order
  level, not per line item — confirmed with the team as sufficient for now).
- Image-type categorization/tagging (reference vs. generated vs. logo) — a free-text note
  covers it; revisit only if the gallery grows unwieldy in practice.
- Multiple reference links — one `reference_link` column is enough for the common case of
  one external product page per order.
- Signed URLs / private bucket — the team chose the public-bucket pattern already used by
  `product-images` over the extra complexity of expiring signed URLs, accepting that an
  order image's URL is reachable by anyone who has it, same trust model as `product-images`.
- Image editing/cropping — upload-as-is only.

## Capabilities

### New

- `order-images`: per-order image gallery with note and full-size viewer, plus a single
  external reference link field.

### Modified

- `database-schema`: additive `orders.reference_link`; additive `order_images` table; new
  `order-images` storage bucket + policies.
- `order-detail`: gains an images section and a reference-link display.
- `order-entry`: `OrderForm`'s "Detalles" section gains the `reference_link` field.

## Approach

- `order_images` is a child table (`order_id` FK, `on delete cascade`), matching the
  existing `order_items` / `order_production_tasks` shape — not a JSON array column,
  so rows stay orderable and independently deletable.
- The storage bucket follows the `product-images` precedent exactly (public bucket,
  `storage.objects` policies scoped to the bucket), except write access is granted to
  any authenticated operator — not admin-only — matching `order_items`' own RLS shape,
  since any operator can already create/edit orders.
- Images are order-level, not item-level: simpler data model and UI, and the team
  confirmed a single gallery per order is sufficient even for multi-item orders.
- No new page/route: the gallery and viewer mount inside the existing `OrderDetail` page,
  the same way `ProductionChecklist` already does.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/*` | New | `orders.reference_link` column; `order_images` table; `order-images` storage bucket + RLS policies |
| `src/features/orders/orderImages.api.ts` | New | list/upload/delete helpers for `order_images` + storage |
| `src/features/orders/OrderImages.tsx` | New | upload control, thumbnail grid, delete, full-size viewer |
| `src/features/orders/OrderDetail.tsx` | Modified | mounts `OrderImages`; shows the reference link |
| `src/features/orders/OrderForm.tsx` | Modified | `reference_link` field in the "Detalles" section |
| `src/features/orders/validation.ts` | Modified | `referenceLink` on `OrderDraft` |
| `src/features/orders/orders.api.ts` | Modified | `OrderRow`/insert/update types pick up the new column (regenerated types) |
| `src/lib/database.types.ts` | Modified | regenerated (excluded from review) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Public bucket exposes an order image URL to anyone who has the link | Low–Med | Accepted trade-off (team decision); same trust model as `product-images`; can be revisited (migrate to a private bucket + signed URLs) without a breaking change to the `order_images` table shape |
| Unbounded image uploads inflate storage usage | Low | 8MB per-file client-side cap; no server-side enforcement in this pass — acceptable for a small shop's order volume |
| Orphaned storage objects if a DB delete fails after a partial upload | Low | `deleteOrderImage` removes the storage object first, then the row; a failed row delete after a successful storage delete just leaves a dangling DB row pointing at nothing, caught by the "image fails to load" state in the gallery rather than corrupting data |

## Rollback Plan

- Drop `order_images` (additive-only; no existing data references it).
- Drop `orders.reference_link` column.
- Remove the `order-images` bucket and its storage policies.
- Remove `OrderImages.tsx`, `orderImages.api.ts`; remove the reference-link field from
  `OrderForm.tsx` and the images section from `OrderDetail.tsx`.

## Dependencies

- `order-detail` archive (`OrderDetail.tsx`, detail page shell).
- `order-entry` archive (`OrderForm.tsx`, `OrderDraft`, `validation.ts`).
- `database-schema` / storage precedent from the `product-images` bucket (see
  `supabase/migrations/20260825120000_product_stock_images.sql`).

## Success Criteria

- [ ] An operator can upload one or more images to an existing order, each with an
      optional note.
- [ ] Clicking a thumbnail opens a full-size viewer with prev/next navigation and the
      image's note.
- [ ] An operator can delete an image (storage object + row both removed).
- [ ] An order can hold an optional external reference link, shown as a clickable link on
      the detail view.
- [ ] Uploading a non-image file or a file over 8MB is rejected with a clear inline
      message, not a silent failure or a raw error.
- [ ] `npm test`, `npm run build`, and `tsc` pass.

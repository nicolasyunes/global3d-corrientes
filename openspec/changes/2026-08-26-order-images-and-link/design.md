# Design: order-images-and-link

## Schema

### `orders.reference_link` (additive)

```sql
alter table public.orders
  add column reference_link text;
```

Nullable, unvalidated free text (not a strict URL check at the DB level — the form's
`type="url"` input and a light client-side check are enough for an internal tool; a
malformed value simply fails to render as a clickable link, no worse than any other
free-text field on `orders`).

### `order_images` (new)

```sql
create table public.order_images (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  storage_path text not null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index order_images_order_id_idx on public.order_images (order_id);

alter table public.order_images enable row level security;
create policy order_images_all
  on public.order_images for all to authenticated using (true) with check (true);
```

No `updated_at`/trigger — rows are immutable once created (delete + re-upload to change
an image; only `note` could theoretically be edited in place, deferred since the upload
flow lets the operator just re-add it with a corrected note). `storage_path` is the full
object key (`{order_id}/{uuid}-{filename}`), not a full URL, so a future bucket
rename/migration to a private bucket only touches the URL-resolution helper, not stored
data.

### `order-images` storage bucket (new)

```sql
insert into storage.buckets (id, name, public)
values ('order-images', 'order-images', true)
on conflict (id) do nothing;

create policy order_images_bucket_read
  on storage.objects for select
  using (bucket_id = 'order-images');

create policy order_images_bucket_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'order-images');

create policy order_images_bucket_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'order-images');
```

Same shape as `product-images` (see
`supabase/migrations/20260825120000_product_stock_images.sql`), except write/delete are
open to any authenticated operator rather than gated by `public.is_admin()` — `orders`
and `order_items` are already writable by any operator, so gating image upload to admins
only would be an inconsistent, unrequested restriction. No `update` policy: an image is
replaced by delete + re-upload, never edited in place.

## API — `orderImages.api.ts`

```ts
export interface OrderImageRow {
  id: string
  order_id: string
  storage_path: string
  note: string | null
  position: number
  created_at: string
}

export function publicImageUrl(storagePath: string): string
// supabase.storage.from('order-images').getPublicUrl(storagePath).data.publicUrl

export async function listOrderImages(orderId: string): Promise<OrderImageRow[]>
// select * from order_images where order_id = :orderId order by position asc

export async function uploadOrderImage(
  orderId: string,
  file: File,
  note: string | null,
): Promise<OrderImageRow>
// 1. storage.from('order-images').upload(`${orderId}/${crypto.randomUUID()}-${file.name}`, file)
// 2. insert into order_images (order_id, storage_path, note, position)
//    position = current max position for this order + 1

export async function deleteOrderImage(image: OrderImageRow): Promise<void>
// 1. storage.from('order-images').remove([image.storage_path])
// 2. delete from order_images where id = :id
```

Client-side upload guardrails (enforced in `OrderImages.tsx` before calling
`uploadOrderImage`, so a rejected file never reaches the network):

- `file.type` must start with `image/`.
- `file.size` must be ≤ 8 * 1024 * 1024 bytes.

## Sequence — uploading an image

```
Operator                  OrderImages                 orderImages.api          Supabase
   |                          |                              |                     |
   | pick file + note         |                              |                     |
   |------------------------->|                              |                     |
   |                          | validate type/size            |                     |
   |                          | (reject inline if invalid)    |                     |
   |                          |------------------------------>|                     |
   |                          |                              | storage.upload(path) |
   |                          |                              |-------------------->|
   |                          |                              |<-- object stored ----|
   |                          |                              | insert order_images  |
   |                          |                              |-------------------->|
   |                          |                              |<-- row (id, path) ---|
   |                          |<-- OrderImageRow -------------|                     |
   | thumbnail appears        |                              |                     |
   |<-------------------------|                              |                     |
```

If the storage upload succeeds but the `order_images` insert fails, the operator sees the
save error and can retry the upload — the orphaned storage object is harmless (never
referenced, cleaned up manually if it ever matters at this scale) and is the accepted
trade-off over adding a two-phase-commit-style compensation step for a low-volume
internal tool.

## UI — `OrderImages` (mounted in `OrderDetail`, alongside `ProductionChecklist`)

- **Upload row**: file input + optional note text input + "Agregar imagen" button.
  Disabled while an upload is in flight; inline error banner on validation failure or a
  failed request (same `form-banner form-banner--error` pattern used elsewhere).
- **Thumbnail grid**: each thumbnail is a button (not a link — no navigation, opens the
  viewer) showing the image via `publicImageUrl(storage_path)`, with a small delete
  affordance — a plain delete button, no confirmation dialog, consistent with
  `ProductionChecklist`'s task removal.
- **Viewer (lightbox)**: opens on thumbnail click; full-size image, its note (if any),
  prev/next buttons cycling through the order's images, close via an explicit button,
  the Escape key, and a click on the backdrop. Keyboard-reachable (focus moves into the
  viewer on open, Escape and arrow keys work without a mouse) per the project's existing
  accessibility bar (focus-visible outlines, `aria-label`s on icon-only controls).

## Order detail — reference link

Rendered as a labeled link ("Ver producto ↗", `target="_blank" rel="noopener noreferrer"`)
in the order header area when `order.reference_link` is set; hidden entirely when null —
no "no link" placeholder, matching how the rest of the detail view omits empty optional
fields rather than showing them blank.

## Form — `OrderForm` reference link field

A single `type="url"` input in the existing "Detalles" section (full-form mode only,
alongside `measurements`/`observations`), saved as `draft.referenceLink.trim() || null`
— same null-when-empty convention every other optional `orders` column already follows
in `validation.ts`.

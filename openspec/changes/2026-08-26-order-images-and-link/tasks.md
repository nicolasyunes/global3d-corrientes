# Tasks: order-images-and-link

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350–450 (excl. generated types) |
| 400-line budget risk | Med |
| 800-line budget risk | Low |
| Chained PRs recommended | No — single PR is manageable |
| Delivery strategy | single-pr |

## Phase 1: Schema + storage

**Files:**
- Create: `supabase/migrations/20260826140000_order_reference_link.sql`
- Create: `supabase/migrations/20260826140001_order_images.sql`

- [ ] 1.1 Write `20260826140000_order_reference_link.sql`:

  ```sql
  alter table public.orders
    add column reference_link text;
  ```

- [ ] 1.2 Write `20260826140001_order_images.sql`:

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

- [ ] 1.3 Apply migrations (`supabase db push` or the project's existing migration
  command — check `package.json` scripts / `supabase/config.toml` for the exact
  invocation used by prior changes), then regenerate types
  (`npm run gen:types` if present, otherwise the command used for the last
  `database.types.ts` regeneration — check `git log -- src/lib/database.types.ts`
  for precedent). Regenerated types are excluded from review.
- [ ] 1.4 Confirm in the Supabase dashboard (or via `execute_sql`) that
  `orders.reference_link` and `order_images` exist and that the `order-images`
  bucket is listed as public.

## Phase 2: `orderImages.api.ts`

**Files:**
- Create: `src/features/orders/orderImages.api.ts`
- Test: `src/features/orders/orderImages.test.ts`

**Interfaces:**
- Produces: `OrderImageRow` (`{ id, order_id, storage_path, note, position, created_at }`),
  `publicImageUrl(storagePath: string): string`,
  `listOrderImages(orderId: string): Promise<OrderImageRow[]>`,
  `uploadOrderImage(orderId: string, file: File, note: string | null): Promise<OrderImageRow>`,
  `deleteOrderImage(image: OrderImageRow): Promise<void>`,
  `validateImageFile(file: File): string | null` (pure — returns an error message or
  `null` if the file passes; the guardrails from design.md: `image/*` only, ≤ 8MB).

- [ ] 2.1 Write the failing test for `validateImageFile` in
  `src/features/orders/orderImages.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { validateImageFile } from './orderImages.api'

  function fakeFile(type: string, sizeBytes: number): File {
    return new File([new Uint8Array(sizeBytes)], 'test.png', { type })
  }

  describe('validateImageFile', () => {
    it('accepts a small image file', () => {
      expect(validateImageFile(fakeFile('image/png', 1024))).toBeNull()
    })

    it('rejects a non-image file', () => {
      expect(validateImageFile(fakeFile('application/pdf', 1024))).toBe(
        'Elegí un archivo de imagen (JPG, PNG, WEBP, GIF).',
      )
    })

    it('rejects a file over 8MB', () => {
      const eightMB = 8 * 1024 * 1024
      expect(validateImageFile(fakeFile('image/png', eightMB + 1))).toBe(
        'La imagen no puede superar los 8MB.',
      )
    })

    it('accepts a file exactly at the 8MB boundary', () => {
      const eightMB = 8 * 1024 * 1024
      expect(validateImageFile(fakeFile('image/png', eightMB))).toBeNull()
    })
  })
  ```

- [ ] 2.2 Run: `npx vitest run src/features/orders/orderImages.test.ts`
  Expected: FAIL (`validateImageFile` not defined / module not found)

- [ ] 2.3 Create `src/features/orders/orderImages.api.ts` with the full module.
  Model the Supabase calls on the existing patterns in
  `src/features/orders/orders.api.ts` (thin typed helpers, no repository layer,
  `if (error) throw error`):

  ```ts
  import { supabase } from '@/lib/supabase'
  import type { Database } from '@/lib/database.types'

  export type OrderImageRow = Database['public']['Tables']['order_images']['Row']

  const MAX_IMAGE_BYTES = 8 * 1024 * 1024

  // Pure — no network/DOM — so the upload flow can reject a bad file before
  // ever touching the network. Mirrors the "reject inline, cheap check first"
  // shape validation.ts already uses for parseMoney/parseQuantity.
  export function validateImageFile(file: File): string | null {
    if (!file.type.startsWith('image/')) {
      return 'Elegí un archivo de imagen (JPG, PNG, WEBP, GIF).'
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'La imagen no puede superar los 8MB.'
    }
    return null
  }

  export function publicImageUrl(storagePath: string): string {
    return supabase.storage.from('order-images').getPublicUrl(storagePath).data
      .publicUrl
  }

  export async function listOrderImages(
    orderId: string,
  ): Promise<OrderImageRow[]> {
    const { data, error } = await supabase
      .from('order_images')
      .select('*')
      .eq('order_id', orderId)
      .order('position', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  // Uploads the file to storage first, then records the row — see design.md's
  // "Sequence — uploading an image" for why a failed insert after a successful
  // storage write is an accepted, harmless trade-off at this scale.
  export async function uploadOrderImage(
    orderId: string,
    file: File,
    note: string | null,
  ): Promise<OrderImageRow> {
    const path = `${orderId}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('order-images')
      .upload(path, file)
    if (uploadError) throw uploadError

    const existing = await listOrderImages(orderId)
    const position =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((row) => row.position)) + 1

    const { data, error } = await supabase
      .from('order_images')
      .insert({ order_id: orderId, storage_path: path, note, position })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  export async function deleteOrderImage(image: OrderImageRow): Promise<void> {
    const { error: storageError } = await supabase.storage
      .from('order-images')
      .remove([image.storage_path])
    if (storageError) throw storageError

    const { error } = await supabase
      .from('order_images')
      .delete()
      .eq('id', image.id)
    if (error) throw error
  }
  ```

- [ ] 2.4 Run: `npx vitest run src/features/orders/orderImages.test.ts`
  Expected: PASS (4 tests)
- [ ] 2.5 Run `tsc --noEmit` to confirm `Database['public']['Tables']['order_images']`
  resolves against the regenerated types from Phase 1.
- [ ] 2.6 Commit:

  ```bash
  git add src/features/orders/orderImages.api.ts src/features/orders/orderImages.test.ts
  git commit -m "feat(orders): add order_images data layer"
  ```

## Phase 3: `OrderImages` component

**Files:**
- Create: `src/features/orders/OrderImages.tsx`
- Modify: `src/features/orders/orders.css` (append a new section, following the
  file's existing pattern of one comment-headed block per component)

**Interfaces:**
- Consumes: `listOrderImages`, `uploadOrderImage`, `deleteOrderImage`,
  `publicImageUrl`, `validateImageFile`, `OrderImageRow` from
  `./orderImages.api`.
- Produces: `export default function OrderImages({ orderId }: { orderId: string })`
  — a self-contained section, mounted by `OrderDetail.tsx` in Phase 4 exactly
  like `<ProductionChecklist orderId={order.id} />` is today.

- [ ] 3.1 Create `src/features/orders/OrderImages.tsx`:

  ```tsx
  import { useEffect, useRef, useState } from 'react'
  import {
    deleteOrderImage,
    listOrderImages,
    publicImageUrl,
    uploadOrderImage,
    validateImageFile,
    type OrderImageRow,
  } from './orderImages.api'

  interface OrderImagesProps {
    orderId: string
  }

  // Per-order image gallery: reference photos, generated mockups, logos to
  // create — one flat gallery with an optional note per image (see
  // openspec/changes/2026-08-26-order-images-and-link/design.md). Mounted on
  // the order detail page, next to ProductionChecklist, since it needs an
  // existing order_id.
  export default function OrderImages({ orderId }: OrderImagesProps) {
    const [images, setImages] = useState<OrderImageRow[]>([])
    const [loading, setLoading] = useState(true)
    const [note, setNote] = useState('')
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [viewerIndex, setViewerIndex] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
      let cancelled = false
      listOrderImages(orderId)
        .then((rows) => {
          if (!cancelled) setImages(rows)
        })
        .catch(() => {
          // Non-fatal: the rest of the order detail page still works without
          // its image gallery.
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [orderId])

    async function handleFileChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      const validationError = validateImageFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setUploading(true)
      setError(null)
      try {
        const uploaded = await uploadOrderImage(orderId, file, note.trim() || null)
        setImages((prev) => [...prev, uploaded])
        setNote('')
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se pudo subir la imagen.',
        )
      } finally {
        setUploading(false)
      }
    }

    async function handleDelete(image: OrderImageRow) {
      try {
        await deleteOrderImage(image)
        setImages((prev) => prev.filter((row) => row.id !== image.id))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se pudo eliminar la imagen.',
        )
      }
    }

    function closeViewer() {
      setViewerIndex(null)
    }

    function showNext() {
      setViewerIndex((prev) =>
        prev === null ? null : (prev + 1) % images.length,
      )
    }

    function showPrev() {
      setViewerIndex((prev) =>
        prev === null ? null : (prev - 1 + images.length) % images.length,
      )
    }

    function handleViewerKeyDown(event: React.KeyboardEvent) {
      if (event.key === 'Escape') closeViewer()
      if (event.key === 'ArrowRight') showNext()
      if (event.key === 'ArrowLeft') showPrev()
    }

    if (loading) return null

    return (
      <section className="order-images">
        <h2 className="order-images__heading">Imágenes</h2>

        <div className="order-images__upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="order-images__file-input"
            onChange={(e) => void handleFileChange(e)}
            disabled={uploading}
            aria-label="Elegir imagen"
          />
          <input
            type="text"
            className="field__input order-images__note-input"
            placeholder="Nota (opcional) — ej: foto que mandó el cliente"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={uploading}
          />
        </div>

        {error && (
          <p className="form-banner form-banner--error" role="alert">
            {error}
          </p>
        )}

        {images.length > 0 && (
          <ul className="order-images__grid">
            {images.map((image, index) => (
              <li key={image.id} className="order-images__thumb-wrap">
                <button
                  type="button"
                  className="order-images__thumb"
                  onClick={() => setViewerIndex(index)}
                >
                  <img
                    src={publicImageUrl(image.storage_path)}
                    alt={image.note ?? 'Imagen del pedido'}
                  />
                </button>
                <button
                  type="button"
                  className="order-images__delete"
                  aria-label="Eliminar imagen"
                  onClick={() => void handleDelete(image)}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        {viewerIndex !== null && images[viewerIndex] && (
          <div
            className="order-images__viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Visor de imagen"
            tabIndex={-1}
            onKeyDown={handleViewerKeyDown}
            onClick={closeViewer}
          >
            <div
              className="order-images__viewer-content"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={publicImageUrl(images[viewerIndex].storage_path)}
                alt={images[viewerIndex].note ?? 'Imagen del pedido'}
              />
              {images[viewerIndex].note && (
                <p className="order-images__viewer-note">
                  {images[viewerIndex].note}
                </p>
              )}
              <div className="order-images__viewer-controls">
                <button
                  type="button"
                  aria-label="Imagen anterior"
                  onClick={showPrev}
                  disabled={images.length < 2}
                >
                  ←
                </button>
                <button type="button" aria-label="Cerrar" onClick={closeViewer}>
                  Cerrar
                </button>
                <button
                  type="button"
                  aria-label="Imagen siguiente"
                  onClick={showNext}
                  disabled={images.length < 2}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }
  ```

- [ ] 3.2 Append the CSS section to `src/features/orders/orders.css` (mirrors the
  `.production-checklist`/`.task-*` block already in the file — same
  `max-width: 44rem`, `min-height: 44px` touch targets, tokens-only colors):

  ```css
  /* ---------------------------------------------------------------------------
     Order images — per-order gallery (reference photos, generated mockups,
     logos to create) with a full-size viewer. Sits on the detail page next to
     the production checklist, sharing its 44rem measure.
  --------------------------------------------------------------------------- */

  .order-images {
    max-width: 44rem;
    margin-inline: auto;
    padding: 1rem 1rem 0;
  }

  .order-images__heading {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .order-images__upload {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .order-images__file-input {
    min-height: 44px;
  }

  .order-images__note-input {
    flex: 1 1 12rem;
  }

  .order-images__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
    list-style: none;
  }

  .order-images__thumb-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .order-images__thumb {
    border: 0;
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--color-carbon-soft);
    cursor: pointer;
    aspect-ratio: 1;
    padding: 0;
  }

  .order-images__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .order-images__thumb:focus-visible {
    outline: 2px solid var(--color-orange);
    outline-offset: 2px;
  }

  .order-images__delete {
    min-height: 32px;
    border: 0;
    background: transparent;
    color: var(--status-red);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .order-images__delete:focus-visible {
    outline: 2px solid var(--color-orange);
    outline-offset: 2px;
  }

  .order-images__viewer {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: color-mix(in srgb, var(--color-carbon) 80%, transparent);
  }

  .order-images__viewer-content {
    max-width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .order-images__viewer-content img {
    max-width: 100%;
    max-height: 70vh;
    border-radius: var(--radius-sm);
  }

  .order-images__viewer-note {
    color: var(--color-white);
    font-size: 0.875rem;
    text-align: center;
  }

  .order-images__viewer-controls {
    display: flex;
    gap: 0.75rem;
  }

  .order-images__viewer-controls button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 1rem;
    border: 0;
    border-radius: 0.75rem;
    background: var(--color-white);
    color: var(--color-carbon);
    font-weight: 700;
    cursor: pointer;
  }

  .order-images__viewer-controls button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .order-images__viewer-controls button:focus-visible {
    outline: 2px solid var(--color-orange);
    outline-offset: 2px;
  }
  ```

- [ ] 3.3 Run `tsc --noEmit` and `npx eslint src/features/orders/OrderImages.tsx`
  to confirm the new component compiles and lints clean.
- [ ] 3.4 Commit:

  ```bash
  git add src/features/orders/OrderImages.tsx src/features/orders/orders.css
  git commit -m "feat(orders): add OrderImages gallery and viewer component"
  ```

## Phase 4: Wire into `OrderDetail` + reference link in `OrderForm`

**Files:**
- Modify: `src/features/orders/OrderDetail.tsx`
- Modify: `src/features/orders/OrderForm.tsx`
- Modify: `src/features/orders/validation.ts`
- Modify: `src/features/orders/validation.test.ts`

**Interfaces:**
- Consumes: `OrderImages` from `./OrderImages` (Phase 3);
  `Database['public']['Tables']['orders']['Row']['reference_link']` (from the
  regenerated types in Phase 1).

- [ ] 4.1 Write the failing test for the `referenceLink` draft field in
  `src/features/orders/validation.test.ts` (append near the existing
  `draftFromOrder`/`emptyDraft` tests):

  ```ts
  it('emptyDraft starts with an empty referenceLink', () => {
    expect(emptyDraft().referenceLink).toBe('')
  })

  it('draftFromOrder carries over a stored reference_link', () => {
    const order = {
      ...baseOrder, // reuse whatever local order fixture the existing
                    // draftFromOrder tests already build in this file
      reference_link: 'https://makerworld.com/en/models/12345',
    }
    expect(draftFromOrder(order).referenceLink).toBe(
      'https://makerworld.com/en/models/12345',
    )
  })

  it('draftFromOrder maps a null reference_link to an empty string', () => {
    const order = { ...baseOrder, reference_link: null }
    expect(draftFromOrder(order).referenceLink).toBe('')
  })
  ```

  Note for the implementer: check the existing test file for the exact name of
  its local order-fixture builder (the `list.test.ts` file in this same
  directory uses a helper called `order(overrides)` — `validation.test.ts` may
  have its own, differently-named one; use whatever it already defines rather
  than introducing a second fixture builder).

- [ ] 4.2 Run: `npx vitest run src/features/orders/validation.test.ts`
  Expected: FAIL (`referenceLink` is `undefined`, not `''`)

- [ ] 4.3 In `src/features/orders/validation.ts`:
  - Add `referenceLink: string` to the `OrderDraft` interface (after
    `originChannel`, before `personalization`, matching the field's position
    in the form's "Detalles" section from design.md).
  - Add `referenceLink: '',` to `emptyDraft()`'s return object.
  - Add `referenceLink: order.reference_link ?? '',` to `draftFromOrder()`'s
    return object.

- [ ] 4.4 Run: `npx vitest run src/features/orders/validation.test.ts`
  Expected: PASS

- [ ] 4.5 In `src/features/orders/OrderForm.tsx`, add the reference link field
  to the "Detalles" section (inside the existing
  `{mode === 'full' && (...)}` block, after the `originChannel` ChipGroup and
  before the `color-spec` fieldset):

  ```tsx
  <div className="field">
    <label className="field__label" htmlFor="reference-link">
      Link de referencia
    </label>
    <input
      id="reference-link"
      className="field__input"
      type="url"
      placeholder="https://makerworld.com/..."
      value={draft.referenceLink}
      onChange={(e) => setField('referenceLink', e.target.value)}
    />
  </div>
  ```

- [ ] 4.6 In the same file's `handleSubmit`, add
  `reference_link: draft.referenceLink.trim() || null,` to both the
  `updateOrder(...)` call's patch object and the `createOrder(...)` call's
  insert object (same line position as `observations` in each).

- [ ] 4.7 In `src/features/orders/OrderDetail.tsx`:
  - Import `OrderImages` from `./OrderImages`.
  - In the `<header className="order-detail__header">` block, after the
    `order-detail__status-row` div, conditionally render the reference link:

    ```tsx
    {order.reference_link && (
      <a
        href={order.reference_link}
        target="_blank"
        rel="noopener noreferrer"
        className="link-btn"
      >
        Ver producto ↗
      </a>
    )}
    ```

  - After `<ProductionChecklist orderId={order.id} />` and before
    `<OrderForm .../>`, add `<OrderImages orderId={order.id} />`.

- [ ] 4.8 Run `tsc --noEmit` — confirms `draft.referenceLink`,
  `order.reference_link`, and the `OrderImages` import all typecheck against
  the Phase 1 regenerated types.
- [ ] 4.9 Run the full unit suite: `npx vitest run`
  Expected: all tests pass, including the new ones from 4.1 and Phase 2.
- [ ] 4.10 Commit:

  ```bash
  git add src/features/orders/OrderDetail.tsx src/features/orders/OrderForm.tsx \
    src/features/orders/validation.ts src/features/orders/validation.test.ts
  git commit -m "feat(orders): add reference link field and mount OrderImages on detail"
  ```

## Phase 5: Verify + manual check

- [ ] 5.1 `npm test`, `npm run build`, `tsc --noEmit` all pass.
- [ ] 5.2 Manual check in the browser (requires a logged-in operator session):
  open an existing order's detail page, upload an image with a note, confirm
  the thumbnail appears; click it, confirm the viewer opens with the note and
  prev/next work when 2+ images exist; press Escape, confirm it closes; delete
  an image, confirm it disappears from the grid; set a reference link on the
  order form, save, confirm "Ver producto ↗" appears on the detail page and
  opens the link in a new tab.
- [ ] 5.3 Manual check: try uploading a non-image file and a file over 8MB;
  confirm both are rejected with the inline message from `validateImageFile`
  and never reach the network (check the Network tab — no `storage.upload`
  request fired).

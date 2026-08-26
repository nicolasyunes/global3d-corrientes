# Design: order-items-and-supplies-sales

## Schema

### `order_items` (new)

```sql
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_type text not null
    check (product_type in ('cup', 'trophy', 'keychain', 'other')),
  description text not null,
  personalization text,
  color_spec jsonb not null default '{}'::jsonb,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) check (unit_price >= 0),
  line_total numeric(12, 2) check (line_total >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items (order_id);
create trigger trg_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

alter table public.order_items enable row level security;
create policy order_items_all
  on public.order_items for all to authenticated using (true) with check (true);
```

`description` is `text` (unbounded), not `varchar(n)` — this is the column that directly answers the "queda corto en la planilla" complaint: a trophy's plaque text, a cup's name/phrase, whatever the customer specifies, in full. `position` orders items within an order for display (trophy #1, #2, … in entry order) without depending on `created_at` precision.

Why a child table and not a `jsonb` array column on `orders`: the existing `color_spec` per-part map already shows the failure mode of jsonb-for-structured-data — it can't be indexed, validated per-field, or joined against `product_variants` later. `order_items` follows the same shape `product_variants` already uses against `products`.

### `transactions` (modified, additive)

```sql
alter table public.transactions
  add column inventory_id uuid references public.inventory (id) on delete restrict,
  add column quantity_grams numeric(10, 2) check (quantity_grams > 0);

alter table public.inventory
  add constraint inventory_remaining_grams_nonneg check (remaining_grams >= 0);
```

`inventory_id` is nullable: a `supplies_sale` transaction MAY record which spool was sold, but recording just the amount (no linked spool) remains valid — the trigger below only fires when both `inventory_id` and `quantity_grams` are present.

### `consume_inventory()` trigger (new)

```sql
create or replace function public.consume_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'supplies_sale' and new.inventory_id is not null and new.quantity_grams is not null then
    update public.inventory
      set remaining_grams = remaining_grams - new.quantity_grams
      where id = new.inventory_id;
    if not found then
      raise exception 'inventory row % not found', new.inventory_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_transactions_consume_inventory
  after insert on public.transactions
  for each row execute function public.consume_inventory();
```

The `remaining_grams >= 0` CHECK on `inventory` is what actually blocks an oversell — the `update` above fails the CHECK and the whole `insert` on `transactions` rolls back, so a rejected sale never partially commits. `security definer` + `set search_path = ''` mirrors the existing `current_user_role()` / `is_admin()` functions in `rls.sql`.

### RLS change

```sql
drop policy transactions_all on public.transactions;
create policy transactions_all
  on public.transactions for all to authenticated using (true) with check (true);
```

Same shape as `orders_all` / `customers_all` / `inventory_all`. `public.is_admin()` is untouched and still available if a future finance-registry screen needs a stricter policy on a *different* table or a *different* transaction type.

## Sequence — recording a supplies sale

```
Operator (any of the 3)          SalesForm                  Supabase
        |                            |                            |
        | pick spool + grams sold    |                            |
        |--------------------------->|                            |
        |                            | insert transactions row    |
        |                            | (type=supplies_sale,       |
        |                            |  inventory_id, quantity_g) |
        |                            |--------------------------->|
        |                            |                            | trg_transactions_consume_inventory
        |                            |                            | UPDATE inventory SET remaining_grams -= qty
        |                            |                            | CHECK remaining_grams >= 0
        |                            |                            |   fails -> whole insert rolled back
        |                            |<-- error: "No alcanza el   |
        |                            |    stock de este color"    |
        |                            |    (if insufficient)       |
        |                            |<---------------------------|  (on success)
        |<-- sale recorded, stock    |                            |
        |    updated                |                            |
```

## Form behavior — `OrderForm` items section

- Default (unchanged): the existing single product/personalization/color fields, exactly as `orders-core` shipped them. This stays the fast path — most orders are one product.
- "+ agregar ítem" reveals a repeatable row: product type, description (multiline, unbounded), personalization, quantity, unit price. Removing the last item collapses back to the single-product fields.
- On save: if any items were added, they're written to `order_items`; the single-product fields on `orders` are left as entered (or blank) — they are not auto-derived from items, so an order's "headline" fields and its item list can both exist without one overwriting the other. Detail view shows items (if any) below the order's own fields.
- `line_total` is optional on entry (`unit_price × quantity` is suggested but editable), following the same "stored value is the source of truth, never recomputed on read" rule `order-detail` already established for `pending_balance`.

## `/admin/ventas`

Peer route to `/admin/orders`, same list-row visual language as `OrdersList` (no new component pattern): date · spool (material/color/brand) · grams · amount · method. No tabs/filtering in this first cut — chronological, newest first. Reuses `StatusBadge`'s pill styling for `method` instead of introducing a new badge type.

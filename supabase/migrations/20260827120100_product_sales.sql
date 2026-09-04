-- Direct product sale support on `transactions`. Mirrors the supplies-sale /
-- inventory link (20260824160001): a `product_sale` row can point at a
-- catalog `products` row + quantity, and a trigger decrements its stock,
-- rolling the whole insert back if it would go negative. A sale of something
-- not in the catalog (free text) leaves `product_id`/`quantity` null and just
-- records the amount — the trigger no-ops. `customer_id` is optional (a
-- counter sale often has no customer).

alter table public.transactions
  add column product_id uuid references public.products (id) on delete restrict,
  add column quantity integer check (quantity > 0),
  add column customer_id uuid references public.customers (id) on delete set null;

create index transactions_product_id_idx on public.transactions (product_id);
create index transactions_customer_id_idx on public.transactions (customer_id);

-- Same shape as consume_inventory(): security definer so an operator without
-- products write access (products_write is admin-only, below) can still
-- trigger the stock decrement. The `stock_quantity >= 0` CHECK from
-- 20260825120000 is what rolls back an oversell.
create or replace function public.consume_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'product_sale' and new.product_id is not null and new.quantity is not null then
    update public.products
      set stock_quantity = stock_quantity - new.quantity
      where id = new.product_id;
    if not found then
      raise exception 'product row % not found', new.product_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_transactions_consume_product_stock
  after insert on public.transactions
  for each row execute function public.consume_product_stock();

-- RLS: `/admin/ventas-pedidos` is an operator screen (not admin-gated), so the
-- product-sale form needs to read `products` to populate its picker. Split the
-- admin-only `products_all` policy into read-for-any-operator + write-for-admin
-- (stock/pricing/image edits stay admin-only, per 20260825120000).
drop policy products_all on public.products;
create policy products_read
  on public.products for select to authenticated using (true);
create policy products_write
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Links a `supplies_sale` transaction to the exact `inventory` row (spool)
-- sold, so remaining grams stay accurate automatically instead of a separate
-- spreadsheet reconciled by hand. Additive on `transactions`; the trigger
-- only fires when both new columns are set, so a sale without a linked spool
-- (amount-only) still records.

alter table public.transactions
  add column inventory_id uuid references public.inventory (id) on delete restrict,
  add column quantity_grams numeric(10, 2) check (quantity_grams > 0);

alter table public.inventory
  add constraint inventory_remaining_grams_nonneg check (remaining_grams >= 0);

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

-- RLS: three operators share all workshop duties with no fixed roles, so
-- gating supplies-sale capture to whichever profile happens to be admin
-- would block two of three from recording a sale at the register. Same
-- policy shape as orders_all / customers_all / inventory_all. is_admin()
-- stays available for a future stricter finance-registry screen.
drop policy transactions_all on public.transactions;
create policy transactions_all
  on public.transactions for all to authenticated using (true) with check (true);

-- order_production_tasks: a lightweight checklist for what's left to make on
-- an order while it's in production — e.g. "Tapa — Casa — pendiente",
-- "Base — Local — hecho". Split out as its own child table (not folded into
-- order_items) because it tracks WHO/WHERE/DONE for arbitrary sub-parts of a
-- job, independent of whether the order has priced line items at all — most
-- orders don't. Mirrors order_items' shape (position, RLS, updated_at
-- trigger) for consistency with the rest of the orders subtree.

create table public.order_production_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  label text not null,
  location text check (location in ('casa', 'local')),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_production_tasks_order_id_idx
  on public.order_production_tasks (order_id);
create trigger trg_order_production_tasks_updated_at
  before update on public.order_production_tasks
  for each row execute function public.set_updated_at();

alter table public.order_production_tasks enable row level security;
create policy order_production_tasks_all
  on public.order_production_tasks for all to authenticated using (true) with check (true);

-- Gestor MercadoLibre: órdenes de ML registradas en el libro de ventas.
-- Aplicada en Supabase el 2026-11-11 vía MCP. Las funciones ml_register_sale / ml_void_sale se crearon acá
-- y se reemplazaron en la migración siguiente (gestor_ml_ventas_stock_seguro), que tiene la versión vigente.

create table public.ml_orders (
  ml_order_id bigint primary key,
  pack_id bigint,
  sale_id uuid references public.sales(id) on delete set null,
  status text,
  buyer_id bigint,
  buyer_nickname text,
  shipping_id bigint,
  shipping_status text,
  handling_limit timestamptz,
  items jsonb,
  stock_applied boolean not null default false,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ml_orders (pack_id);
create trigger ml_orders_touch before update on public.ml_orders
  for each row execute function public.ml_touch_updated_at();
alter table public.ml_orders enable row level security;
create policy ml_orders_read on public.ml_orders for select to authenticated using (true);

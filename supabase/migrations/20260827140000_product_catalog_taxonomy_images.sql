-- Catálogo respaldado por la DB: taxonomía de categorías, galería de imágenes
-- por producto, y campos de e-commerce sobre `products`. Aditivo. RLS sigue
-- admin-only (el select público del storefront es una spec posterior).

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  position integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

insert into public.categories (slug, name, icon, position, featured) values
  ('vasos-ferneteros', 'Vasos Ferneteros',          '🍺', 0, true),
  ('vasos-milkshake',  'Vasos Milkshake',           '🥤', 1, true),
  ('figuras',          'Figuras y Coleccionables',  '🧸', 2, false),
  ('mates',            'Mates',                     '🧉', 3, false),
  ('golosineros',      'Alcancías y Golosineros',   '💰', 4, false),
  ('llaveros',         'Llaveros y Merch',          '🔑', 5, false),
  ('trofeos',          'Trofeos y Premios',         '🏆', 6, false),
  ('hogar',            'Hogar y Decoración',        '🏠', 7, false),
  ('juegos',           'Juegos y Juguetes',         '🎲', 8, false),
  ('combos',           'Combos',                    '🎁', 9, false),
  ('impresion-3d',     'Impresión 3D',              '🖨️', 10, false);

-- ---------------------------------------------------------------------------
-- product_images (galería; la portada se espeja en products.image_url)
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  url text not null,
  position integer not null default 0,
  alt text,
  created_at timestamptz not null default now(),
  unique (product_id, path)
);

create index product_images_product_id_position_idx
  on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- products: campos de e-commerce
-- ---------------------------------------------------------------------------
alter table public.products
  add column slug text unique,
  add column sku text,
  add column compare_at_price numeric(12, 2),
  add column custom_on_request boolean not null default false,
  add column personalizable boolean not null default false,
  add column weight_grams integer check (weight_grams is null or weight_grams >= 0),
  add column category_id uuid references public.categories (id) on delete set null,
  add column subcategory text;

create unique index products_sku_key on public.products (sku) where sku is not null;
create index products_category_id_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
-- RLS: admin-only, igual patrón que products_all. Sin select público (Spec 2).
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.product_images enable row level security;

create policy categories_all on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_all on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Recursos del taller: webs que se usan seguido (modelos, IA, personalizar,
-- reparar, proveedores, guías) y búsquedas guardadas para abrir la misma
-- búsqueda en varios sitios. Nunca se guardan contraseñas.

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  url text not null,
  category text not null
    check (category in ('modelos', 'ia', 'personalizar', 'reparar', 'proveedores', 'guias')),
  description text,
  price text not null default 'gratis' check (price in ('gratis', 'mixto', 'pago')),
  needs_account boolean not null default false,
  account_hint text,
  search_url text check (search_url is null or position('{q}' in search_url) > 0),
  pinned boolean not null default false,
  position int not null default 0,
  created_by uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  query text not null check (length(trim(query)) > 0),
  resource_ids uuid[] not null default '{}',
  collection_id uuid references public.idea_collections (id) on delete set null,
  last_used_at timestamptz,
  created_by uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;
create policy resources_all
  on public.resources for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.resources to authenticated;

alter table public.saved_searches enable row level security;
create policy saved_searches_all
  on public.saved_searches for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.saved_searches to authenticated;

insert into public.resources
  (name, url, category, description, price, needs_account, search_url, pinned, position)
values
  ('MakerWorld', 'https://makerworld.com', 'modelos',
   'Modelos listos para imprimir, con perfiles de impresión.', 'gratis', true,
   'https://makerworld.com/es/search/models?keyword={q}', true, 1),
  ('Printables', 'https://www.printables.com', 'modelos',
   'Modelos gratis de la comunidad.', 'gratis', false,
   'https://www.printables.com/search/models?q={q}', true, 2),
  ('Cults3D', 'https://cults3d.com', 'modelos',
   'Modelos gratis y pagos; muchos diseños exclusivos.', 'mixto', true,
   'https://cults3d.com/es/b%C3%BAsqueda?q={q}', false, 3),
  ('Thingiverse', 'https://www.thingiverse.com', 'modelos',
   'El repositorio clásico de modelos gratis.', 'gratis', false,
   'https://www.thingiverse.com/search?q={q}&type=things', false, 4),
  ('Yeggi', 'https://www.yeggi.com', 'modelos',
   'Busca en muchos sitios de modelos a la vez.', 'gratis', false,
   'https://www.yeggi.com/q/{q}/', false, 5),
  ('Hunyuan 3D', 'https://3d.hunyuan.tencent.com', 'ia',
   'Genera un modelo 3D a partir de una foto o un texto.', 'gratis', true,
   null, true, 1),
  ('Crea en 3Di', 'https://3dinsumos.com.ar', 'personalizar',
   'Generadores para personalizar: posavasos, cajas, litofanías, engranajes.', 'gratis', false,
   null, true, 1),
  ('Reparar STL (Aspose)', 'https://products.aspose.app/3d/es/repairing/stl', 'reparar',
   'Arregla archivos STL con errores antes de laminar.', 'gratis', false,
   null, false, 1);

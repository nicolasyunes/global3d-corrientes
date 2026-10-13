-- Diseños de los generadores 3D (letra caja, y más adelante llavero y vaso):
-- los parámetros para volver a abrirlo tal cual, el pedido al que pertenece
-- y los archivos generados (3MF, SVG original, miniatura) en el depósito
-- `design-files`.

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('letra_caja', 'llavero', 'vaso')),
  name text not null check (length(trim(name)) > 0),
  params jsonb not null default '{}'::jsonb,
  order_id uuid references public.orders (id) on delete set null,
  -- [{ "path": "…/letra.3mf", "name": "letra.3mf", "kind": "3mf" | "svg" | "png" }]
  files jsonb not null default '[]'::jsonb,
  thumbnail_path text,
  created_by uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_order_id_idx on public.designs (order_id);
create index designs_created_at_idx on public.designs (created_at desc);

create trigger trg_designs_updated_at
  before update on public.designs
  for each row execute function public.set_updated_at();

alter table public.designs enable row level security;
create policy designs_all
  on public.designs for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.designs to authenticated;

-- Storage: lectura pública como idea-files y order-images; 50 MB por archivo
-- porque los 3MF pesan. Update para poder pisar los archivos al volver a guardar.
insert into storage.buckets (id, name, public, file_size_limit)
values ('design-files', 'design-files', true, 52428800)
on conflict (id) do nothing;

create policy design_files_bucket_read
  on storage.objects for select
  using (bucket_id = 'design-files');

create policy design_files_bucket_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'design-files');

create policy design_files_bucket_update
  on storage.objects for update to authenticated
  using (bucket_id = 'design-files');

create policy design_files_bucket_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'design-files');

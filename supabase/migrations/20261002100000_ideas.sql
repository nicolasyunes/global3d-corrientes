-- Ideas: cosas que el taller podría imprimir (links, fotos, archivos 3D),
-- agrupadas en colecciones temáticas con fecha opcional.
-- Ver docs/superpowers/specs/2026-09-30-ideas-design.md.

create table public.idea_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  target_date date,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  url text,
  source text not null default 'other'
    check (source in ('makerworld', 'cults', 'printables', 'thingiverse',
                      'instagram', 'tiktok', 'pinterest', 'photo', 'other')),
  preview_image_url text,
  preview_author text,
  collection_id uuid references public.idea_collections (id) on delete set null,
  status text not null default 'idea'
    check (status in ('idea', 'to_test', 'tested')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high')),
  notes text,
  created_by uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_collection_id_idx on public.ideas (collection_id);

create trigger trg_ideas_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

create table public.idea_files (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video', 'model')),
  file_name text not null,
  size_bytes bigint,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index idea_files_idea_id_idx on public.idea_files (idea_id);

alter table public.idea_collections enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_files enable row level security;

create policy idea_collections_all
  on public.idea_collections for all to authenticated using (true) with check (true);
create policy ideas_all
  on public.ideas for all to authenticated using (true) with check (true);
create policy idea_files_all
  on public.idea_files for all to authenticated using (true) with check (true);

grant select, insert, update, delete
  on public.idea_collections, public.ideas, public.idea_files to authenticated;

-- Storage: depósito público de lectura, como order-images; 50 MB por archivo
-- porque los 3MF pesan.
insert into storage.buckets (id, name, public, file_size_limit)
values ('idea-files', 'idea-files', true, 52428800)
on conflict (id) do nothing;

create policy idea_files_bucket_read
  on storage.objects for select
  using (bucket_id = 'idea-files');

create policy idea_files_bucket_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'idea-files');

create policy idea_files_bucket_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'idea-files');

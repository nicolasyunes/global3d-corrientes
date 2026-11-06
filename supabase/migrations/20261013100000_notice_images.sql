-- notice_images: archivos (imagen o PDF) adjuntos a una tarea del tablero,
-- pensados para las del sector Presupuesto (fotos del cliente, referencias,
-- diseños). Misma forma que order_images; la nota lleva el tipo.

create table public.notice_images (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices (id) on delete cascade,
  storage_path text not null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index notice_images_notice_id_idx on public.notice_images (notice_id);

alter table public.notice_images enable row level security;
create policy notice_images_all
  on public.notice_images for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.notice_images to authenticated;

-- Storage: lectura pública como order-images; escribe y borra cualquier
-- operador autenticado.
insert into storage.buckets (id, name, public)
values ('notice-images', 'notice-images', true)
on conflict (id) do nothing;

create policy notice_images_bucket_read
  on storage.objects for select
  using (bucket_id = 'notice-images');

create policy notice_images_bucket_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notice-images');

create policy notice_images_bucket_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'notice-images');

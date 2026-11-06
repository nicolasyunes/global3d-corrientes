-- Avisos de Hoy: cosas para leer (avisos) y para hacer (tareas) del local y del
-- taller. Un aviso queda hasta que alguien lo archiva; una tarea se tilda al
-- hacerla y guarda quién y cuándo. Archivar no borra la fila.

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'notice' check (kind in ('notice', 'task')),
  body text not null check (length(trim(body)) > 0),
  important boolean not null default false,
  created_by uuid references public.operators (id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references public.operators (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.operators (id) on delete set null
);
create index notices_open_idx on public.notices (created_at desc)
  where archived_at is null;

alter table public.notices enable row level security;
create policy notices_all
  on public.notices for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.notices to authenticated;

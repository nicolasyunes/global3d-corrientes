-- Gestor MercadoLibre: registro de cada corrida de la tarea diaria (ventas y sync), para mostrarlo en el admin.
-- Aplicada en Supabase el 2026-11-11 vía MCP.

create table public.ml_task_runs (
  id uuid primary key default gen_random_uuid(),
  task text not null check (task in ('ventas','sync')),
  ran_at timestamptz not null default now(),
  ok boolean not null default true,
  summary jsonb
);
create index on public.ml_task_runs (task, ran_at desc);
alter table public.ml_task_runs enable row level security;
-- El admin solo lee; escriben los scripts del gestor con la secret key.
create policy ml_task_runs_read on public.ml_task_runs for select to authenticated using (true);

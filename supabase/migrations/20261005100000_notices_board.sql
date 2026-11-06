-- Avisos y tareas, segunda parte: tablero por sector, importancia, persona
-- asignada, fecha, repetición y vínculo para las tareas; color, chinche y
-- fecha "hasta" para los avisos. Los datos cargados no se pierden: las
-- marcadas como importantes pasan a importancia alta.

alter table public.notices
  add column sector text not null default 'local'
    check (sector in ('local', 'taller', 'compras', 'presupuesto')),
  add column priority text not null default 'media'
    check (priority in ('alta', 'media', 'baja')),
  add column assignee_id uuid references public.operators (id) on delete set null,
  add column due_on date,
  add column repeat text check (repeat in ('day', 'week', 'month')),
  add column link text,
  add column color text not null default 'amarillo'
    check (color in ('amarillo', 'rosa', 'celeste', 'verde', 'lila')),
  add column pinned boolean not null default false,
  add column expires_on date,
  add column last_done_at timestamptz,
  add column last_done_by uuid references public.operators (id) on delete set null;

update public.notices set priority = 'alta' where important;

-- Instagram de la tienda: token de la API y caché de las últimas
-- publicaciones. Solo la lee y escribe la edge function `instagram-feed`
-- con la service role; anon y authenticated no tienen acceso.
--
-- El token arranca en el secret INSTAGRAM_TOKEN de las edge functions; la
-- función lo renueva antes de que venza (dura 60 días) y guarda el nuevo acá.

create table public.shop_instagram (
  id smallint primary key default 1 check (id = 1),
  token text,
  token_expires_at timestamptz,
  feed jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.shop_instagram enable row level security;
revoke all on public.shop_instagram from anon, authenticated;

insert into public.shop_instagram (id) values (1);

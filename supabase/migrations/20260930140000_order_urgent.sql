-- "Urgente": an order the workshop pins above everything else (an event, a
-- promise) regardless of its date or what else is late.
alter table public.orders
  add column if not exists urgent boolean not null default false;
